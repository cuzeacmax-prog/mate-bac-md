/**
 * ETAPA 75 FAZA H — MĂSURAREA DE DUPĂ: simulează profilurile prin NOILE rute.
 *
 * 20 de mesaje mixte (14 simple + 6 grele, în 4 conversații — cache-ul
 * incremental lucrează) + 2 lecții canonice servite, pe userul de audit
 * (free). Apoi citește api_usage_log pe fereastra simulării și scoate
 * TABELUL-REGE: metrică × înainte (FAZA 0) × după × Δ%.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa75-after-sim.ts
 */
import { readFileSync } from 'node:fs';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];

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

const SIMPLE = [
  'Cât face 15% din 240?',
  'Ce înseamnă DVA?',
  'Cum aflu aria unui cerc cu raza 3?',
  'x = 5 e soluția corectă?',
  'Mai explică-mi o dată pasul 2, te rog.',
  'Care e formula ariei triunghiului?',
  'Ce e un număr prim?',
];
const HARD = [
  'Demonstrați că funcția $f(x) = x^3 + 3x$ este strict crescătoare pe $\\R$.',
  'Calculați $\\int_0^1 (2x+1)e^x dx$ folosind integrarea prin părți.',
  'a) Aflați domeniul funcției $f(x) = \\sqrt{x^2-4}$; b) studiați paritatea; c) calculați $f(3)$.',
];

async function chat(cookies: string, message: string, conversationId?: string): Promise<string | undefined> {
  const resp = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ message, mode: 'study', ...(conversationId ? { conversationId } : {}) }),
  });
  if (!resp.ok || !resp.body) fail(`/api/chat HTTP ${resp.status}`);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let convId: string | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    for (const line of buf.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.conversationId) convId = ev.conversationId;
      } catch { /* parțial */ }
    }
  }
  return convId;
}

async function lesson(cookies: string, concept: string): Promise<void> {
  const resp = await fetch(`${BASE}/api/lesson/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ concept }),
  });
  if (!resp.ok || !resp.body) fail(`/api/lesson/start HTTP ${resp.status}`);
  const reader = resp.body.getReader();
  for (;;) {
    const { done } = await reader.read();
    if (done) break;
  }
}

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.from('profiles').update({ subscription_status: 'free' }).eq('id', user.id);
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);
  const cookies = buildAuthCookies(signIn.session);

  const t0 = new Date().toISOString();
  console.log('simulez profilul: 20 mesaje mixte (4 conversații) + 2 lecții canonice…');
  // 4 conversații a câte 5 mesaje (cache-ul incremental pe istoric lucrează)
  let sent = 0;
  for (let conv = 0; conv < 4; conv++) {
    let convId: string | undefined;
    for (let i = 0; i < 5; i++) {
      const isHard = (conv === 1 && i >= 3) || (conv === 3 && i >= 1 && i <= 4) || (conv === 2 && i === 4);
      const pool = isHard ? HARD : SIMPLE;
      const msg = pool[(conv * 5 + i) % pool.length];
      convId = await chat(cookies, msg, convId);
      sent++;
      process.stdout.write(`\r  mesaje: ${sent}/20`);
    }
  }
  console.log('\n  lecții canonice: g12-piramida, g10-aria-discului…');
  await lesson(cookies, 'g12-piramida');
  await lesson(cookies, 'g10-aria-discului');

  await new Promise((r) => setTimeout(r, 3000));
  const { data: rows } = await svc
    .from('api_usage_log')
    .select('task_name, endpoint, tokens_input, tokens_output, cached_input_tokens, cost_usd, routed_difficulty')
    .eq('user_id', user.id)
    .gte('created_at', t0);
  const chatRows = (rows ?? []).filter((r) => r.endpoint === '/api/chat');
  const lessonRows = (rows ?? []).filter((r) => r.endpoint === '/api/lesson/start');
  const cachedPct = Math.round((100 * chatRows.filter((r) => (r.cached_input_tokens ?? 0) > 0).length) / (chatRows.length || 1));
  const avgChat = chatRows.reduce((a, r) => a + Number(r.cost_usd), 0) / (chatRows.length || 1);
  const hardCount = chatRows.filter((r) => (r.routed_difficulty ?? '').startsWith('hard')).length;
  const haikuPct = Math.round((100 * chatRows.filter((r) => !(r.routed_difficulty ?? '').startsWith('hard')).length) / (chatRows.length || 1));
  const lessonCost = lessonRows.reduce((a, r) => a + Number(r.cost_usd), 0);

  // baseline-ul FAZEI 0
  const baseline = JSON.parse(readFileSync('docs/etapa75-baseline.json', 'utf8')) as {
    unit: { chatFreeMsg: number; lessonServed: number };
  };
  const d = (before: number, after: number) =>
    before > 0 ? `${after <= before ? '-' : '+'}${Math.abs(Math.round(((before - after) / before) * 100))}%` : 'n/a';

  console.log('\n══ TABELUL-REGE (măsurat pe simulare vs baseline FAZA 0) ══');
  console.log(`  metrică                     | înainte    | după       | Δ`);
  console.log(`  cost/mesaj chat (free)      | $${baseline.unit.chatFreeMsg.toFixed(6)} | $${avgChat.toFixed(6)} | ${d(baseline.unit.chatFreeMsg, avgChat)}`);
  console.log(`  cost/lecție servită         | $${baseline.unit.lessonServed.toFixed(6)} | $${(lessonCost / 2).toFixed(6)} | ${d(baseline.unit.lessonServed, lessonCost / 2)}`);
  console.log(`  % apeluri chat cu cache     | 0%         | ${cachedPct}%`);
  console.log(`  mesaje rutate hard (Sonnet) | 0 (nu exista) | ${hardCount}/${chatRows.length}`);
  console.log(`  % mesaje pe Haiku           | 100%       | ${haikuPct}%`);
  console.log(`  apeluri LLM pe lecția canonică | n/a (live) | ${lessonRows.length} (țintă 0)`);
  if (lessonRows.length > 0) fail('lecțiile canonice au făcut apeluri LLM!');
  console.log('\n✅ simularea de după: cifre măsurate (nu estimate) în tabel.');
}
main().catch((e) => { console.error(e); process.exit(1); });
