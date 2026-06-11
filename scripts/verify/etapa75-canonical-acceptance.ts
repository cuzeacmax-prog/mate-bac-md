/**
 * ETAPA 75 B5 — ACCEPTANȚA lecțiilor canonice.
 *
 *  1. O lecție pe un concept CU canonică = ZERO apeluri LLM pe schelet:
 *     dovada în api_usage_log — niciun rând /api/lesson/start după start;
 *  2. blocurile vin din DB (stream-ul SSE livrează scheletul + canonical.status);
 *  3. quiz-ul funcționează (mesaj persistat → /api/lesson/quiz verifică);
 *  4. costul per lecție servită: înainte (FAZA 0: $0.0267 măsurat) vs după (0$
 *     pe schelet + doar evaluările).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa75-canonical-acceptance.ts
 *   (serverul cu codul nou pe BASE_URL)
 */
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const CONCEPT = process.env.CONCEPT ?? 'g12-piramida';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const BASELINE_LESSON_COST = 0.026743; // FAZA 0, docs/etapa75-baseline.json

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

async function main() {
  const svc = createServiceClient();
  // conceptul de test TREBUIE să aibă canonică
  const { data: concept } = await svc.from('concepts').select('id, name').eq('slug', CONCEPT).single();
  if (!concept) fail(`conceptul ${CONCEPT} lipsește`);
  const { data: canon } = await svc
    .from('lesson_canonical').select('id, status').eq('concept_id', concept.id).limit(1).maybeSingle();
  if (!canon) fail(`conceptul ${CONCEPT} nu are lecție canonică — rulează generatorul`);

  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);
  const cookies = buildAuthCookies(signIn.session);

  const t0 = new Date().toISOString();
  console.log(`pornesc lecția pe '${CONCEPT}' (are canonică, status=${canon.status})…`);
  const resp = await fetch(`${BASE}/api/lesson/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ concept: CONCEPT }),
  });
  if (!resp.ok || !resp.body) fail(`/api/lesson/start HTTP ${resp.status}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let blocks = 0;
  let canonicalStatus: string | null = null;
  let messageId: string | null = null;
  let quizSeen = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.canonical) canonicalStatus = ev.canonical.status;
        if (ev.block) { blocks++; if (ev.block.tip === 'quiz') quizSeen = true; }
        if (ev.done) messageId = ev.messageId;
        if (ev.fallback) fail('servirea canonică a căzut pe fallback');
      } catch { /* parțial */ }
    }
  }
  if (blocks < 6) fail(`prea puține blocuri: ${blocks}`);
  if (!canonicalStatus) fail('evenimentul canonical.status lipsește din stream');
  if (!quizSeen) fail('niciun quiz în lecția canonică servită');
  if (!messageId) fail('messageId lipsește (persistarea a eșuat)');
  console.log(`  ✓ ${blocks} blocuri din canonică, status=${canonicalStatus}, messageId=${messageId.slice(0, 8)}`);

  // quiz-ul funcționează pe mesajul persistat (răspuns greșit intenționat e ok)
  const quizResp = await fetch(`${BASE}/api/lesson/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ messageId, quizId: 'q1', answer: 'a' }),
  });
  if (!quizResp.ok) fail(`/api/lesson/quiz HTTP ${quizResp.status}`);
  const quizData = await quizResp.json();
  if (typeof quizData.correct !== 'boolean') fail('quiz-ul nu a întors verdict');
  console.log(`  ✓ quiz q1 verificat pe server (correct=${quizData.correct})`);

  // ZERO apeluri LLM pe schelet: niciun rând /api/lesson/start după t0
  await new Promise((r) => setTimeout(r, 2000));
  const { data: rows } = await svc
    .from('api_usage_log')
    .select('task_name, endpoint, cost_usd')
    .eq('user_id', user.id)
    .gte('created_at', t0);
  const lessonRows = (rows ?? []).filter((r) => r.endpoint === '/api/lesson/start');
  if (lessonRows.length > 0) {
    fail(`scheletul a făcut ${lessonRows.length} apeluri LLM (trebuia 0)`);
  }
  const evalCost = (rows ?? []).reduce((a, r) => a + Number(r.cost_usd), 0);
  console.log(`  ✓ ZERO apeluri LLM pe schelet (în log: doar ${rows?.length ?? 0} rânduri de evaluare, $${evalCost.toFixed(6)})`);

  console.log(
    `\n✅ B5 acceptată: lecția canonică servită fără LLM.` +
      `\n   cost/lecție servită: înainte $${BASELINE_LESSON_COST.toFixed(4)} → după $${evalCost.toFixed(4)} (doar evaluările)`
  );
}
main().catch((e) => { console.error(e); process.exit(1); });
