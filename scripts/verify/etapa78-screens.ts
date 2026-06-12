/**
 * ETAPA 78 FAZA F — SCREENSHOT-URI pentru docs/design-review/etapa78/:
 *   setari-notificari.png (+ ecranul prealabil push), panoul-pilot.png,
 *   exercitii.png (+ filtrat), email-*.png (HTML-urile din docs/email-preview).
 * (pwa-install-prompt.png și pwa-offline.png vin din etapa78-pwa-acceptance.)
 *
 * Panoul pilot: userul de AUDIT e promovat temporar admin+pilot și retrogradat
 * la final — contul real al lui Maxim nu e atins.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa78-screens.ts
 */
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa78');
const PREVIEWS = join(process.cwd(), 'docs', 'email-preview');

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

function authCookieParts(session: Session): Array<{ name: string; value: string }> {
  const name = `sb-${REF}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const MAX = 3180;
  if (value.length <= MAX) return [{ name, value }];
  const parts: Array<{ name: string; value: string }> = [];
  for (let i = 0; i * MAX < value.length; i++) {
    parts.push({ name: `${name}.${i}`, value: value.slice(i * MAX, (i + 1) * MAX) });
  }
  return parts;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addCookies(
    authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
  );
  const page = await ctx.newPage();

  // ── setările notificărilor (+ ecranul prealabil push deschis) ─────────────
  await page.goto(`${BASE}/app/setari`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByTestId('push-enable').click().catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, 'setari-notificari.png'), fullPage: true });
  console.log('  ✓ setari-notificari.png (cu ecranul prealabil deschis)');

  // ── exercițiile: biblioteca + filtrat ──────────────────────────────────────
  await page.goto(`${BASE}/app/exercitii`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, 'exercitii.png'), fullPage: false });
  await page.goto(`${BASE}/app/exercitii?domeniu=ii&dificultate=accesibil`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, 'exercitii-filtrat.png'), fullPage: false });
  console.log('  ✓ exercitii.png + exercitii-filtrat.png');

  // ── panoul pilot: auditul devine temporar admin + pilot ───────────────────
  const { data: beforeProfile } = await svc
    .from('profiles').select('subscription_status').eq('id', user.id).maybeSingle();
  const prevStatus = beforeProfile?.subscription_status ?? 'free';
  try {
    await svc.from('profiles').update({ subscription_status: 'admin' }).eq('id', user.id);
    await svc.from('user_profiles').update({ is_pilot: true }).eq('id', user.id);
    await page.goto(`${BASE}/admin/pilot`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForTimeout(1200);
    if (!(await page.getByText('Panoul pilotului').isVisible().catch(() => false))) {
      fail('panoul pilotului nu s-a randat pentru adminul temporar');
    }
    await page.screenshot({ path: join(OUT, 'panoul-pilot.png'), fullPage: true });
    console.log('  ✓ panoul-pilot.png (audit temporar admin+pilot)');
  } finally {
    await svc.from('profiles').update({ subscription_status: prevStatus }).eq('id', user.id);
    await svc.from('user_profiles').update({ is_pilot: false }).eq('id', user.id);
  }

  // ── emailurile: HTML-urile persistate, randate în browser ─────────────────
  const emailPage = await browser.newPage({ viewport: { width: 720, height: 980 } });
  for (const f of readdirSync(PREVIEWS).filter((f) => f.endsWith('.html'))) {
    await emailPage.goto(pathToFileURL(join(PREVIEWS, f)).href, { waitUntil: 'load' });
    await emailPage.waitForTimeout(300);
    await emailPage.screenshot({ path: join(OUT, `email-${f.replace('.html', '')}.png`), fullPage: true });
  }
  console.log('  ✓ email-*.png pentru toate template-urile din docs/email-preview/');

  await browser.close();
  console.log(`\n✅ Screenshot-urile ETAPA 78 sunt în ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
