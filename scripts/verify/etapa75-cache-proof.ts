/**
 * ETAPA 75 FAZA A — DOVADA cache-ului pe ruta FREE.
 *
 * Defectul (FAZA 0): cached_input_tokens=0 pe TOATE apelurile chat_free.
 * Cauza: minimul cacheabil Anthropic = 2048 tokeni pe Haiku (1024 pe Sonnet);
 * blocul static avea 1941 → sub minim → cache_control ignorat tăcut.
 *
 * Proba: 2 mesaje în ACEEAȘI conversație, ca userul de audit (free):
 *  - mesajul 2 trebuie să aibă cached_input_tokens > 0 în api_usage_log;
 *  - raportăm costul/mesaj față de media baseline ($0.011148).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa75-cache-proof.ts
 *   (serverul cu codul nou pe BASE_URL, default http://localhost:3000)
 */
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const BASELINE_FREE_MSG = 0.011148; // FAZA 0, docs/etapa75-baseline.json

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
      } catch { /* chunk parțial */ }
    }
  }
  return convId;
}

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  // userul de audit trebuie să fie FREE (proba e pe chat_free)
  const { data: prof } = await svc.from('profiles').select('subscription_status').eq('id', user.id).single();
  if (prof?.subscription_status && !['free', null].includes(prof.subscription_status)) {
    console.log(`(userul de audit e '${prof.subscription_status}' — îl trec temporar pe free pentru probă)`);
    await svc.from('profiles').update({ subscription_status: 'free' }).eq('id', user.id);
  }
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);
  const cookies = buildAuthCookies(signIn.session);

  const t0 = new Date().toISOString();
  console.log('mesajul 1 (conversație nouă — scrie cache-ul)…');
  const convId = await chat(cookies, 'Cât face derivata funcției f(x) = x³ - 2x?');
  if (!convId) fail('conversationId lipsește din stream');
  console.log(`mesajul 2 (aceeași conversație ${convId.slice(0, 8)} — trebuie să CITEASCĂ cache-ul)…`);
  await chat(cookies, 'Și care e derivata a doua a aceleiași funcții?', convId);

  // log-ul: ambele apeluri chat_free de după t0
  await new Promise((r) => setTimeout(r, 2500)); // log-ul e async (void logApiUsage)
  const { data: rows } = await svc
    .from('api_usage_log')
    .select('task_name, tokens_input, cached_input_tokens, cost_usd, created_at')
    .eq('user_id', user.id)
    .eq('endpoint', '/api/chat')
    .gte('created_at', t0)
    .order('created_at');
  if (!rows || rows.length < 2) fail(`așteptam 2 rânduri în log, am ${rows?.length ?? 0}`);
  for (const [i, r] of rows.entries()) {
    console.log(
      `  mesaj ${i + 1}: task=${r.task_name} in=${r.tokens_input} cached=${r.cached_input_tokens} cost=$${Number(r.cost_usd).toFixed(6)}`
    );
  }
  const second = rows[rows.length - 1];
  if (second.task_name !== 'chat_free') fail(`al 2-lea mesaj a mers pe ${second.task_name}, nu chat_free`);
  if ((second.cached_input_tokens ?? 0) <= 0) {
    fail('al 2-lea mesaj are cached_input_tokens=0 — cache-ul liber tot NU funcționează');
  }
  const cost2 = Number(second.cost_usd);
  const delta = ((BASELINE_FREE_MSG - cost2) / BASELINE_FREE_MSG) * 100;
  console.log(
    `\n✅ FAZA A dovedită: cached_input_tokens=${second.cached_input_tokens} pe mesajul 2 (chat_free).` +
      `\n   cost mesaj 2: $${cost2.toFixed(6)} vs baseline $${BASELINE_FREE_MSG.toFixed(6)} (${delta > 0 ? '-' : '+'}${Math.abs(delta).toFixed(0)}% — comparație orientativă, mesajele diferă ca lungime)`
  );
}
main().catch((e) => { console.error(e); process.exit(1); });
