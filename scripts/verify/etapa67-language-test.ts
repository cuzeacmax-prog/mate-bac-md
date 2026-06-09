/**
 * ETAPA 67 FAZA E — testul limbajului dozat: aceeași cerere de lecție,
 * distribuția lungimii blocurilor (toate sub limitele din schemă) vs un
 * răspuns VECHI de chat (perete de markdown) pe același concept.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa67-language-test.ts
 */
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';
import { countSentences, type LessonBlock } from '../../src/lib/lesson/blocks';

const BASE = process.env.BASELINE_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const CONCEPT = 'g12-integrala-nedefinita';

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

async function sse(cookies: string, url: string, body: unknown): Promise<{ events: Array<Record<string, unknown>>; text: string }> {
  const resp = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) fail(`${url} HTTP ${resp.status}`);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  const events: Array<Record<string, unknown>> = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        events.push(ev);
        if (typeof ev.text === 'string') text += ev.text;
      } catch { /* parțial */ }
    }
  }
  return { events, text };
}

function blockTextLen(b: LessonBlock): { sentences: number; chars: number } {
  const texts: string[] = [];
  if (b.tip === 'intro') texts.push(b.ideea_mare);
  if (b.tip === 'step') texts.push(b.corp);
  if (b.tip === 'formula') texts.push(b.explicatie);
  if (b.tip === 'example') texts.push(...b.pasi.map((p) => p.text));
  if (b.tip === 'recap') texts.push(...b.puncte);
  if (b.tip === 'quiz') texts.push(b.intrebare);
  const joined = texts.join(' ');
  return { sentences: Math.max(...texts.map(countSentences), 0), chars: joined.length };
}

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

  // ── lecția structurată ──────────────────────────────────────────────────
  console.log(`lecție structurată pe: ${CONCEPT}`);
  const lesson = await sse(cookies, '/api/lesson/start', { concept: CONCEPT });
  if (lesson.events.some((e) => e.fallback)) fail('lecția a căzut pe fallback');
  const blocks = lesson.events.filter((e) => e.block).map((e) => e.block as LessonBlock);
  if (blocks.length < 6) fail(`prea puține blocuri: ${blocks.length}`);

  const distLines: string[] = [];
  let maxSentences = 0;
  let maxChars = 0;
  const perTip = new Map<string, { n: number; sMax: number; cMax: number }>();
  for (const b of blocks) {
    const { sentences, chars } = blockTextLen(b);
    maxSentences = Math.max(maxSentences, sentences);
    maxChars = Math.max(maxChars, chars);
    const agg = perTip.get(b.tip) ?? { n: 0, sMax: 0, cMax: 0 };
    agg.n++; agg.sMax = Math.max(agg.sMax, sentences); agg.cMax = Math.max(agg.cMax, chars);
    perTip.set(b.tip, agg);
  }
  console.log('\n── distribuția blocurilor (toate au TRECUT validatorul de schemă) ──');
  for (const [tip, a] of perTip) {
    distLines.push(`  ${tip}: ${a.n} blocuri, max ${a.sMax} propoziții/câmp, max ${a.cMax} chars text`);
    console.log(distLines[distLines.length - 1]);
  }
  console.log(`  TOTAL: ${blocks.length} blocuri; max propoziții/câmp = ${maxSentences}; max chars/bloc = ${maxChars}`);
  if (maxSentences > 3) fail(`bloc cu ${maxSentences} propoziții a scăpat de validator`);

  // ── răspunsul VECHI de chat pe aceeași cerere ───────────────────────────
  console.log('\nrăspuns vechi de chat (markdown) pe aceeași temă…');
  const chat = await sse(cookies, '/api/chat', {
    message: 'Explică-mi integrala nedefinită ca la lecție: teorie, formule și un exemplu.',
    mode: 'study',
  });
  const paragraphs = chat.text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const paraSentences = paragraphs.map((p) => countSentences(p));
  const worst = Math.max(...paraSentences, 0);
  console.log(`  chat vechi: ${chat.text.length} chars, ${paragraphs.length} paragrafe, max ${worst} propoziții/paragraf`);

  console.log('\n── comparația (lecție structurată vs perete de chat) ──');
  console.log(`  lecție: ecranul arată UN bloc ≤3 propoziții odată (${blocks.length} pași)`);
  console.log(`  chat:   un singur ecran cu ${chat.text.length} chars; cel mai gras paragraf are ${worst} propoziții`);

  console.log('\n✅ FAZA E dovedită: limitele țin (validator), distribuția raportată, peretele vechi cuantificat.');
}
main().catch((e) => { console.error(e); process.exit(1); });
