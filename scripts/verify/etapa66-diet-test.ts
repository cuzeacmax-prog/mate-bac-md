/**
 * ETAPA 66 FAZA D1 — măsurătoarea dietei de istoric pe o conversație de 15 mesaje.
 *
 * Politica veche: ultimele 20 de mesaje integrale.
 * Politica nouă: ultimele 6 integrale + rezumat persistat (Haiku, incremental).
 *
 * Măsurători (Anthropic countTokens — același tokenizer, nu estimare):
 *  - tokenii ISTORICULUI la mesajul 15: vechi (14 integrale) vs nou
 *    (rezumat + nerezumate + 6 integrale)
 * Dovezi persistente: conversations.summary != null, summary_through > 0,
 * input_tokens din api_usage_log pe ultimul mesaj.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa66-diet-test.ts
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';
import { HISTORY_FULL_WINDOW } from '../../src/lib/chat/history';

const BASE = process.env.BASELINE_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];

const TOPICS = [
  'Ce e un discriminant?', 'Dă-mi un exemplu cu Delta pozitiv.', 'Și dacă Delta e 0?',
  'Cum aflu suma rădăcinilor?', 'Dar produsul lor?', 'Ce spune Viète exact?',
  'Rezolvă x^2-7x+12=0.', 'Verifică cu Viète soluțiile.', 'Acum x^2+x+1=0, ce iese?',
  'Ce înseamnă rădăcini complexe?', 'Cum arăt asta pe grafic?', 'Unde taie parabola axa Ox?',
  'Ce e vârful parabolei?', 'Formula vârfului care e?', 'Fă-mi un rezumat scurt al discuției.',
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
  await svc.from('profiles').update({ subscription_status: 'free' }).eq('id', user.id);

  const testStart = new Date().toISOString();
  let convId: string | undefined;
  for (const [i, m] of TOPICS.entries()) {
    convId = await sendMessage(cookies, m, convId);
    process.stdout.write(`mesaj ${i + 1}/15… `);
  }
  console.log('\nconversația completă:', convId);
  if (!convId) fail('fără conversationId');
  await new Promise((r) => setTimeout(r, 2500));

  // ── dovada persistată: rezumatul există ──────────────────────────────────
  const { data: conv } = await svc
    .from('conversations')
    .select('summary, summary_through')
    .eq('id', convId)
    .maybeSingle();
  if (!conv?.summary || !(conv.summary_through > 0)) {
    fail(`rezumatul nu s-a persistat (summary=${!!conv?.summary}, through=${conv?.summary_through})`);
  }
  console.log(`\nconversations.summary persistat: through=${conv.summary_through}, ${String(conv.summary).length} chars`);
  console.log(`  „${String(conv.summary).slice(0, 160)}…"`);

  // ── comparația vechi/nou pe ISTORIC, cu countTokens ──────────────────────
  const { data: msgs } = await svc
    .from('messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true });
  const all = (msgs ?? []).filter((m) => m.role === 'user' || m.role === 'assistant');
  // la mesajul 15, istoricul = mesajele dinaintea lui (28 = 14 user + 14 assistant)
  const prior = all.slice(0, -2);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const model = 'claude-haiku-4-5-20251001';
  const toMsg = (m: { role: string; content: string | null }) =>
    ({ role: m.role as 'user' | 'assistant', content: (m.content ?? ' ').slice(0, 10000) });

  const oldHistory = await anthropic.messages.countTokens({
    model, messages: [...prior.slice(-20).map(toMsg), { role: 'user', content: 'x' }],
  });
  const through = conv.summary_through as number;
  const newWindow = prior.slice(Math.min(through, Math.max(0, prior.length - HISTORY_FULL_WINDOW)));
  const newHistory = await anthropic.messages.countTokens({
    model,
    system: `REZUMAT: ${conv.summary}`,
    messages: [...newWindow.map(toMsg), { role: 'user', content: 'x' }],
  });
  const delta = Math.round((1 - newHistory.input_tokens / oldHistory.input_tokens) * 100);
  console.log(`\n── istoric la mesajul 15 (countTokens, MĂSURAT) ──`);
  console.log(`  politica veche (20 integrale): ${oldHistory.input_tokens} tokeni`);
  console.log(`  politica nouă (rezumat + ${newWindow.length} mesaje): ${newHistory.input_tokens} tokeni → −${delta}%`);
  if (newHistory.input_tokens >= oldHistory.input_tokens) fail('dieta nu reduce tokenii istoricului');

  // input total real al ultimului mesaj, din log
  const { data: lastRows } = await svc
    .from('api_usage_log')
    .select('tokens_input, tokens_output, cost_usd')
    .eq('task_name', 'chat_free')
    .gte('created_at', testStart)
    .order('created_at', { ascending: false })
    .limit(1);
  console.log(`  input total real (mesajul 15, din log): ${lastRows?.[0]?.tokens_input} tokeni, $${Number(lastRows?.[0]?.cost_usd).toFixed(6)}`);

  // câte apeluri de rezumat s-au făcut (trebuie << 15)
  const { count: sumCalls } = await svc
    .from('api_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('task_name', 'summarize_history')
    .gte('created_at', testStart);
  console.log(`  apeluri summarize_history: ${sumCalls} (incremental, nu per mesaj)`);
  if ((sumCalls ?? 99) >= 15) fail('rezumatul rulează la fiecare mesaj — incremental stricat');

  console.log('\n✅ FAZA D dovedită: rezumat persistat, istoric comprimat, rezumare incrementală.');
}
main().catch((e) => { console.error(e); process.exit(1); });
