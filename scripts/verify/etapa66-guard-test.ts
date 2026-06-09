/**
 * ETAPA 66 FAZA F — dovada gardurilor de cost (live, prin dev server).
 *
 *  1. llm_kill_switch=true  → /api/chat răspunde 503 cu mesaj politicos.
 *  2. kill_switch=false + buget premium=0.000001 → userul premium primește
 *     răspuns DOWNGRADAT pe Haiku (rând chat_free în log) cu nota politicoasă
 *     în text (nu tăcere).
 *  3. config restaurat la valorile implicite.
 * Config-ul gardului e cache-uit 60s în proces → testul așteaptă expirarea.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa66-guard-test.ts
 */
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';
import { BUDGET_NOTICE, KILL_SWITCH_MESSAGE } from '../../src/lib/cost/guard';

const BASE = process.env.BASELINE_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const CACHE_WAIT_MS = 65_000;

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

async function setConfig(svc: ReturnType<typeof createServiceClient>, key: string, value: unknown) {
  const { error } = await svc.from('system_config').upsert({ key, value }, { onConflict: 'key' });
  if (error) fail(`config ${key}: ${error.message}`);
}

async function chat(cookies: string, message: string): Promise<{ status: number; body: string }> {
  const resp = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ message, mode: 'study' }),
  });
  if (!resp.body) return { status: resp.status, body: await resp.text() };
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return { status: resp.status, body: text };
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

  // ── 1) kill-switch ─────────────────────────────────────────────────────
  await setConfig(svc, 'llm_kill_switch', true);
  console.log(`kill_switch=true setat; aștept ${CACHE_WAIT_MS / 1000}s (cache config)…`);
  await new Promise((r) => setTimeout(r, CACHE_WAIT_MS));
  const r1 = await chat(cookies, 'Cât face 1+1?');
  console.log(`  răspuns: HTTP ${r1.status}`);
  if (r1.status !== 503) fail(`așteptam 503 la kill-switch, primit ${r1.status}`);
  if (!r1.body.includes(KILL_SWITCH_MESSAGE.slice(0, 30))) fail('503 fără mesajul politicos');
  console.log('  ✓ kill-switch: 503 cu mesaj politicos, zero apel LLM');

  // ── 2) buget depășit → downgrade premium → Haiku + notă ───────────────
  await setConfig(svc, 'llm_kill_switch', false);
  await setConfig(svc, 'cost_budget_usd', { free: 1.0, premium: 0.000001, family: 15.0 });
  await svc.from('profiles').update({ subscription_status: 'premium' }).eq('id', user.id);
  console.log(`buget premium≈0 setat; aștept ${CACHE_WAIT_MS / 1000}s…`);
  await new Promise((r) => setTimeout(r, CACHE_WAIT_MS));
  const testStart = new Date().toISOString();
  const r2 = await chat(cookies, 'Cât face 2+3?');
  if (r2.status !== 200) fail(`downgrade: HTTP ${r2.status}`);
  if (!r2.body.includes(BUDGET_NOTICE.slice(1, 40))) fail('răspunsul nu conține nota politicoasă de downgrade');
  await new Promise((r) => setTimeout(r, 2500));
  const { data: rows } = await svc
    .from('api_usage_log')
    .select('task_name, model')
    .gte('created_at', testStart)
    .like('task_name', 'chat_%');
  const tasks = (rows ?? []).map((r) => r.task_name);
  console.log(`  task-uri logate: ${tasks.join(',')}`);
  if (!tasks.includes('chat_free')) fail('userul premium peste buget NU a fost downgradat la chat_free');
  if (tasks.includes('chat_premium')) fail('a rulat totuși chat_premium peste buget');
  console.log('  ✓ buget depășit: downgrade la Haiku + notă în mesaj, nu tăcere');

  // ── 3) restaurare ──────────────────────────────────────────────────────
  await setConfig(svc, 'cost_budget_usd', { free: 1.0, premium: 10.0, family: 15.0 });
  await svc.from('profiles').update({ subscription_status: 'free' }).eq('id', user.id);
  console.log('config restaurat (bugete implicite, user free).');

  console.log('\n✅ FAZA F dovedită: kill-switch 503 politicos + downgrade pe buget, ambele live.');
}
main().catch((e) => { console.error(e); process.exit(1); });
