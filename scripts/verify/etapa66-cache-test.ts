/**
 * ETAPA 66 FAZA B2 — DOVADA prompt caching-ului.
 *
 * 3 mesaje în ACEEAȘI conversație (PREMIUM/Sonnet) prin dev server:
 *  - mesajul 1 scrie cache-ul (cache_write, cached_input_tokens=0 la citire)
 *  - mesajele 2-3 TREBUIE să aibă cached_input_tokens > 0 în api_usage_log
 * Raport: % din input servit din cache + cost/mesaj vs baseline FAZA A.
 *
 * MARCAT: free/Haiku NU se cache-uiește azi — prefixul static (3003 tok) e sub
 * minimul cache-abil al lui Haiku 4.5 (4096, verificat empiric: 3052→0 scris,
 * 5983→scris+citit). Fără umplutură artificială; contractul ETAPA 67 va trece
 * prefixul peste prag natural.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa66-cache-test.ts
 */
import { readFileSync } from 'node:fs';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASELINE_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];

const MESSAGES = [
  'Calculează aria unui pătrat cu latura 4 cm.',
  'Dar perimetrul aceluiași pătrat?',
  'Și diagonala lui, cât e?',
];

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

async function sendMessage(cookies: string, message: string, conversationId?: string): Promise<string | undefined> {
  const resp = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ message, conversationId, mode: 'study' }),
  });
  if (!resp.ok || !resp.body) fail(`/api/chat HTTP ${resp.status}`);
  const convId = resp.headers.get('X-Conversation-Id') ?? conversationId;
  const reader = resp.body.getReader();
  for (;;) { const { done } = await reader.read(); if (done) break; }
  return convId ?? undefined;
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
  await svc.from('profiles').update({ subscription_status: 'premium' }).eq('id', user.id);

  const testStart = new Date().toISOString();
  let convId: string | undefined;
  for (const [i, m] of MESSAGES.entries()) {
    convId = await sendMessage(cookies, m, convId);
    console.log(`mesaj ${i + 1} trimis (conv ${convId?.slice(0, 8)}…)`);
  }
  await new Promise((r) => setTimeout(r, 2500));

  await svc.from('profiles').update({ subscription_status: 'free' }).eq('id', user.id);
  const { data: rows } = await svc
    .from('api_usage_log')
    .select('task_name, tokens_input, tokens_output, cached_input_tokens, cost_usd, created_at')
    .eq('task_name', 'chat_premium')
    .gte('created_at', testStart)
    .order('created_at');
  if ((rows?.length ?? 0) < 3) fail(`așteptam 3 rânduri chat_premium, găsite ${rows?.length}`);

  console.log('\n── rândurile chat_premium ──');
  for (const [i, r] of rows!.entries()) {
    const pct = r.tokens_input ? Math.round(((r.cached_input_tokens ?? 0) / r.tokens_input) * 100) : 0;
    console.log(`  msg${i + 1}: input=${r.tokens_input} cached=${r.cached_input_tokens} (${pct}%) cost=$${Number(r.cost_usd).toFixed(6)}`);
  }

  const second = rows![1];
  const third = rows![2];
  if ((second.cached_input_tokens ?? 0) <= 0) fail('mesajul 2 nu are cached_input_tokens > 0');
  if ((third.cached_input_tokens ?? 0) <= 0) fail('mesajul 3 nu are cached_input_tokens > 0');

  // comparație cu baseline-ul FAZEI A
  let baselineCost = 0.027395;
  try {
    const baseline = JSON.parse(readFileSync('docs/etapa66-baseline.json', 'utf8'));
    baselineCost = baseline.per_task?.chat_premium?.cost_mediu_usd ?? baselineCost;
  } catch { /* fallback la valoarea din raport */ }
  const cachedAvg = (Number(second.cost_usd) + Number(third.cost_usd)) / 2;
  const pctCached = Math.round(((second.cached_input_tokens ?? 0) / (second.tokens_input ?? 1)) * 100);
  console.log(`\n── verdict ──`);
  console.log(`  % input din cache (msg2): ${pctCached}%`);
  console.log(`  cost mediu mesaje cache-uite: $${cachedAvg.toFixed(6)} vs baseline $${baselineCost} → Δ ${Math.round((1 - cachedAvg / baselineCost) * 100)}%`);
  console.log('\n✅ FAZA B dovedită: cached_input_tokens > 0 pe mesajele 2-3 din aceeași conversație.');
}
main().catch((e) => { console.error(e); process.exit(1); });
