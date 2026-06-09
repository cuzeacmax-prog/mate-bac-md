/**
 * ETAPA 66 FAZA A2 — BASELINE măsurat (punctul de referință al întregii etape).
 *
 * Cere serverul de dev pornit (npm run dev, localhost:3000).
 * Pe userul de audit (etapa60-acceptance@test.local):
 *  1. 5 mesaje prin /api/chat ca FREE (chat_free/Haiku) + 5 ca PREMIUM
 *     (chat_premium/Sonnet) — TTFB client, apoi rândurile din api_usage_log
 *     (tokens/cost/latency/cached din răspunsurile API).
 *  2. Distribuția input tokens: system prompt vs istoric vs mesaj — MĂSURATĂ
 *     cu Anthropic countTokens (același tokenizer, nu estimare).
 *  3. TTS: 2 sinteze pe același enunț (cost/enunț + latență; pregătește FAZA C).
 *
 * Scrie docs/etapa66-baseline.json (commitat — referința FAZEI G).
 *   npx tsx --env-file=.env.local scripts/verify/etapa66-baseline.ts
 */
import { writeFileSync } from 'node:fs';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '../../src/lib/supabase/service';
import { STUDY_SYSTEM_PROMPT } from '../../src/lib/ai/system-prompt';

const BASE = process.env.BASELINE_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];

const FREE_MESSAGES = [
  'Calculează derivata funcției f(x) = x^3 - 2x.',
  'Cât este integrala definită de la 0 la 1 din 2x dx?',
  'Rezolvă ecuația x^2 - 5x + 6 = 0.',
  'Care e aria unui cerc cu raza 3 cm?',
  'Calculează limita când x tinde la 0 din sin(x)/x.',
];
const PREMIUM_MESSAGES = [
  'Calculează volumul unui con cu raza 5 cm și înălțimea 12 cm.',
  'Află primitiva funcției f(x) = e^x + 1/x.',
  'Câte submulțimi are o mulțime cu 5 elemente?',
  'Rezolvă inecuația 2x - 3 > 5.',
  'Care este probabilitatea să dai un număr par la zar?',
];

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

/** cookie-ul @supabase/ssr: base64url(JSON(session)), chunked la 3180 chars */
function buildAuthCookies(session: Session): string {
  const name = `sb-${REF}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0; i * MAX < value.length; i++) {
    parts.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  }
  return parts.join('; ');
}

interface MsgResult { ttfbClientMs: number; totalClientMs: number; chars: number }

async function sendChatMessage(cookies: string, message: string, conversationId?: string): Promise<{ res: MsgResult; conversationId?: string }> {
  const start = Date.now();
  const resp = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ message, conversationId, mode: 'study' }),
  });
  if (!resp.ok || !resp.body) fail(`/api/chat HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const newConvId = resp.headers.get('X-Conversation-Id') ?? conversationId;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let ttfb = 0; let chars = 0; let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(line.slice(6));
        if (json.text) {
          if (ttfb === 0) ttfb = Date.now() - start;
          chars += (json.text as string).length;
        }
        if (json.error) fail(`SSE error: ${json.error}`);
      } catch { /* chunk parțial */ }
    }
  }
  return { res: { ttfbClientMs: ttfb, totalClientMs: Date.now() - start, chars }, conversationId: newConvId ?? undefined };
}

async function main() {
  const svc = createServiceClient();

  // serverul de dev e pornit?
  try { await fetch(`${BASE}/api/health`).catch(() => fetch(BASE)); }
  catch { fail(`serverul nu răspunde pe ${BASE} — pornește npm run dev`); }

  // userul de audit + parolă + sesiune
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (signErr || !signIn.session) fail(`signIn: ${signErr?.message}`);
  const cookies = buildAuthCookies(signIn.session);
  console.log(`user de audit autentificat: ${user.id}`);

  // reset cota lunară ca free să nu pice pe 429 în timpul testului
  await svc.from('rate_limits').delete().eq('user_id', user.id);

  const testStart = new Date().toISOString();
  const clientSide: Record<string, MsgResult[]> = { chat_free: [], chat_premium: [] };

  // ── FREE (Haiku) ──────────────────────────────────────────────────────────
  await svc.from('profiles').update({ subscription_status: 'free' }).eq('id', user.id);
  let convId: string | undefined;
  console.log('\n── 5 mesaje FREE (chat_free) ──');
  for (const m of FREE_MESSAGES) {
    const { res, conversationId } = await sendChatMessage(cookies, m, convId);
    convId = conversationId;
    clientSide.chat_free.push(res);
    console.log(`  ttfb=${res.ttfbClientMs}ms total=${res.totalClientMs}ms chars=${res.chars} — "${m.slice(0, 40)}…"`);
  }

  // ── PREMIUM (Sonnet) ──────────────────────────────────────────────────────
  await svc.from('profiles').update({ subscription_status: 'premium' }).eq('id', user.id);
  convId = undefined;
  console.log('\n── 5 mesaje PREMIUM (chat_premium) ──');
  for (const m of PREMIUM_MESSAGES) {
    const { res, conversationId } = await sendChatMessage(cookies, m, convId);
    convId = conversationId;
    clientSide.chat_premium.push(res);
    console.log(`  ttfb=${res.ttfbClientMs}ms total=${res.totalClientMs}ms chars=${res.chars} — "${m.slice(0, 40)}…"`);
  }
  await svc.from('profiles').update({ subscription_status: 'free' }).eq('id', user.id);

  // ── TTS: 2 sinteze pe ACELAȘI enunț ───────────────────────────────────────
  const ttsText = 'Un con circular drept are raza bazei egală cu 5 cm și înălțimea de 12 cm. Să se afle lungimea generatoarei conului.';
  const tts: Array<{ ms: number; bytes: number; status: number }> = [];
  for (let i = 0; i < 2; i++) {
    const t0 = Date.now();
    const r = await fetch(`${BASE}/api/voice/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies },
      body: JSON.stringify({ text: ttsText, voice: 'nova' }),
    });
    const buf = r.ok ? await r.arrayBuffer() : new ArrayBuffer(0);
    tts.push({ ms: Date.now() - t0, bytes: buf.byteLength, status: r.status });
    console.log(`\nTTS #${i + 1}: status=${r.status} ${Date.now() - t0}ms ${buf.byteLength} bytes`);
  }

  // ── rândurile din api_usage_log pentru fereastra testului ────────────────
  await new Promise((r) => setTimeout(r, 2500)); // log-urile post-stream sunt async
  const { data: rows } = await svc
    .from('api_usage_log')
    .select('task_name, model, tokens_input, tokens_output, cached_input_tokens, latency_ms_total, latency_ms_ttfb, cost_usd, endpoint')
    .gte('created_at', testStart)
    .order('created_at');
  console.log(`\n── api_usage_log în fereastra testului: ${rows?.length ?? 0} rânduri ──`);
  const byTask = new Map<string, { n: number; inTok: number; outTok: number; cached: number; cost: number; ttfb: number[]; total: number[] }>();
  for (const r of rows ?? []) {
    const k = r.task_name as string;
    const agg = byTask.get(k) ?? { n: 0, inTok: 0, outTok: 0, cached: 0, cost: 0, ttfb: [], total: [] };
    agg.n++;
    agg.inTok += r.tokens_input ?? 0;
    agg.outTok += r.tokens_output ?? 0;
    agg.cached += r.cached_input_tokens ?? 0;
    agg.cost += Number(r.cost_usd ?? 0);
    if (r.latency_ms_ttfb != null) agg.ttfb.push(r.latency_ms_ttfb);
    if (r.latency_ms_total != null) agg.total.push(r.latency_ms_total);
    byTask.set(k, agg);
  }
  const mean = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const table: Record<string, unknown> = {};
  for (const [task, a] of byTask) {
    table[task] = {
      apeluri: a.n,
      input_tokens_mediu: Math.round(a.inTok / a.n),
      output_tokens_mediu: Math.round(a.outTok / a.n),
      cached_input_total: a.cached,
      cost_mediu_usd: +(a.cost / a.n).toFixed(6),
      ttfb_mediu_ms: mean(a.ttfb),
      latenta_totala_medie_ms: mean(a.total),
    };
    console.log(`  ${task}: ${JSON.stringify(table[task])}`);
  }

  // ── distribuția input tokens — MĂSURATĂ cu countTokens ───────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const model = 'claude-haiku-4-5-20251001';
  const sysCount = await anthropic.messages.countTokens({
    model, system: STUDY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: 'x' }],
  });
  const msgOnly = await anthropic.messages.countTokens({
    model, messages: [{ role: 'user', content: FREE_MESSAGES[2] }],
  });
  const systemTokens = sysCount.input_tokens - msgOnly.input_tokens;
  const freeAgg = byTask.get('chat_free');
  const meanInput = freeAgg ? Math.round(freeAgg.inTok / freeAgg.n) : 0;
  const distribution = {
    metoda: 'Anthropic countTokens (același tokenizer) + medii din log',
    system_prompt_tokens: systemTokens,
    mesaj_tipic_tokens: msgOnly.input_tokens,
    input_mediu_total_chat_free: meanInput,
    istoric_si_context_tokens_mediu: Math.max(0, meanInput - systemTokens - msgOnly.input_tokens),
  };
  console.log(`\n── distribuția input (chat_free) ──\n  ${JSON.stringify(distribution, null, 2)}`);

  // ── TTS cost/enunț (formulă deterministă preț × caractere, din log) ──────
  const ttsRows = (rows ?? []).filter((r) => r.task_name === 'tts');
  const ttsBaseline = {
    apeluri: ttsRows.length,
    caractere_per_enunt: ttsRows[0]?.tokens_input ?? null,
    cost_per_enunt_usd: ttsRows[0] ? +Number(ttsRows[0].cost_usd).toFixed(6) : null,
    latenta_ms: ttsRows.map((r) => r.latency_ms_total),
    nota: tts.every((t) => t.status === 200) ? 'măsurat live' : `status-uri: ${tts.map((t) => t.status).join(',')}`,
  };
  console.log(`\n── TTS baseline ──\n  ${JSON.stringify(ttsBaseline)}`);

  const baseline = {
    generat_la: testStart,
    metoda: 'măsurat: 10 mesaje live prin /api/chat (5 free + 5 premium), log din răspunsurile API',
    per_task: table,
    distributie_input_chat_free: distribution,
    tts: ttsBaseline,
    client_side: {
      chat_free_ttfb_mediu_ms: mean(clientSide.chat_free.map((r) => r.ttfbClientMs)),
      chat_premium_ttfb_mediu_ms: mean(clientSide.chat_premium.map((r) => r.ttfbClientMs)),
    },
  };
  writeFileSync('docs/etapa66-baseline.json', JSON.stringify(baseline, null, 2));
  console.log('\n✅ Baseline scris în docs/etapa66-baseline.json');
}
main().catch((e) => { console.error(e); process.exit(1); });
