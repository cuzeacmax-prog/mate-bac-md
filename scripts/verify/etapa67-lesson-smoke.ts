/**
 * ETAPA 67 FAZA B — smoke test live: POST /api/lesson/start pe un concept cu
 * exerciții servibile → blocuri validate streamate + lecția persistată +
 * quiz verificabil pe server (mastery se mișcă).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa67-lesson-smoke.ts
 */
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASELINE_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const CONCEPT = process.env.LESSON_CONCEPT ?? 'g12-volumul-piramidei';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

function buildAuthCookies(session: Session): string {
  const name = `sb-${REF}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0; i * MAX < value.length; i++) parts.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  return parts.join('; ');
}

interface SseEvent { block?: { tip: string; quiz_id?: string }; done?: boolean; fallback?: boolean; retrying?: number; messageId?: string; invalidCount?: number; blocks?: number; error?: string }

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);
  const cookies = buildAuthCookies(signIn.session);
  await svc.from('rate_limits').delete().eq('user_id', user.id);

  console.log(`lecție pe conceptul: ${CONCEPT}`);
  const resp = await fetch(`${BASE}/api/lesson/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ concept: CONCEPT }),
  });
  if (!resp.ok || !resp.body) fail(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const tipuri: string[] = [];
  let done: SseEvent | null = null;
  let sawFallback = false;
  let firstQuizId: string | null = null;
  let clientSawCorecta = false;
  for (;;) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let ev: SseEvent;
      try { ev = JSON.parse(line.slice(6)); } catch { continue; }
      if (ev.error) fail(`SSE error: ${ev.error}`);
      if (ev.fallback) sawFallback = true;
      if (ev.retrying) console.log(`  (re-cerere pentru ${ev.retrying} blocuri respinse)`);
      if (ev.block) {
        tipuri.push(ev.block.tip);
        if (ev.block.tip === 'quiz') {
          if (!firstQuizId) firstQuizId = ev.block.quiz_id ?? null;
          if ('corecta' in (ev.block as Record<string, unknown>)) clientSawCorecta = true;
        }
      }
      if (ev.done) done = ev;
    }
  }

  if (sawFallback) fail('stream-ul structurat a căzut pe fallback (vezi log server)');
  if (!done) fail('fără eveniment done');
  console.log(`\nblocuri primite (${tipuri.length}): ${tipuri.join(' → ')}`);
  console.log(`invalidCount raportat: ${done.invalidCount}; messageId: ${done.messageId}`);
  if (tipuri.length < 6) fail(`prea puține blocuri valide: ${tipuri.length}`);
  if (!tipuri.includes('intro')) fail('lipsește intro');
  if (!tipuri.includes('quiz')) fail('lipsește quiz');
  if (!tipuri.includes('recap')) fail('lipsește recap');
  if (clientSawCorecta) fail('SECURITATE: corecta a ajuns la client!');
  if (!done.messageId || !firstQuizId) fail('fără messageId sau quiz_id');

  // lecția persistată conține corecta (server-side)
  const { data: saved } = await svc.from('messages').select('content').eq('id', done.messageId).single();
  const parsed = JSON.parse(saved!.content as string);
  const quizzes = parsed.blocks.filter((b: { tip: string }) => b.tip === 'quiz');
  if (!quizzes.length || !quizzes[0].corecta) fail('lecția persistată nu are corecta pe quiz');
  console.log(`lecție persistată: ${parsed.blocks.length} blocuri, ${quizzes.length} quiz-uri (corecta DOAR pe server ✓)`);

  // quiz: răspuns GREȘIT deliberat → corect=false + mastery mișcat
  const wrong = quizzes[0].corecta === 'a' ? 'b' : 'a';
  const before = await masteryOf(svc, user.id, CONCEPT);
  const qr = await fetch(`${BASE}/api/lesson/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ messageId: done.messageId, quizId: firstQuizId, answer: wrong }),
  });
  const qd = await qr.json();
  if (qr.status !== 200) fail(`quiz HTTP ${qr.status}`);
  if (qd.correct !== false) fail(`răspunsul greșit deliberat a fost marcat correct=${qd.correct}`);
  await new Promise((r) => setTimeout(r, 1200));
  const after = await masteryOf(svc, user.id, CONCEPT);
  console.log(`quiz greșit deliberat: correct=false ✓; mastery ${before.toFixed(4)} → ${after.toFixed(4)}`);
  if (after >= before && before > 0) fail('mastery nu a scăzut după răspuns greșit');

  console.log('\n✅ FAZA B smoke: blocuri validate streamate, corecta doar pe server, quiz determinist mișcă mastery.');
}

async function masteryOf(svc: ReturnType<typeof createServiceClient>, uid: string, slug: string): Promise<number> {
  const { data: c } = await svc.from('concepts').select('id').eq('slug', slug).single();
  const { data: m } = await svc
    .from('concept_mastery').select('mastery').eq('user_id', uid).eq('concept_id', c!.id).maybeSingle();
  return (m?.mastery as number | undefined) ?? 0;
}
main().catch((e) => { console.error(e); process.exit(1); });
