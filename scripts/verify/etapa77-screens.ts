/**
 * ETAPA 77 FAZA G — dovezile vizuale: lecția-scenă (desktop+mobil), landing
 * (3 viewport-uri), foto-fluxul. Persistate în docs/design-review/etapa77/.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa77-screens.ts
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa77');

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
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // ── landing pe 3 viewport-uri ─────────────────────────────────────────────
  for (const vp of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tableta', width: 820, height: 1180 },
    { name: 'mobil', width: 390, height: 844 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(OUT, `landing-${vp.name}.png`), fullPage: true });
    console.log(`  ✓ landing-${vp.name}.png`);
    await ctx.close();
  }

  // ── lecția-scenă (focus mode + vizual) desktop+mobil ─────────────────────
  for (const vp of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobil', width: 390, height: 844 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies(
      authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
    );
    const page = await ctx.newPage();
    await page.goto(`${BASE}/app/chat?concept=g12-aria-subgraficului-unei-functii`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    const ok = await page.getByText(/Lecție · pasul/).waitFor({ state: 'visible', timeout: 90_000 }).then(() => true).catch(() => false);
    if (!ok) { console.log(`  (playerul nu a apărut pe ${vp.name})`); await ctx.close(); continue; }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, `lectie-scena-intro-${vp.name}.png`) });
    console.log(`  ✓ lectie-scena-intro-${vp.name}.png`);
    // avansăm până la primul bloc VIZUAL (figure/plot) — max 12 pași
    for (let i = 0; i < 12; i++) {
      const visual = await page.locator('.figura-bac').first().isVisible().catch(() => false);
      if (visual) break;
      const cont = page.getByRole('button', { name: /^Continuă/ }).first();
      if (await cont.isEnabled().catch(() => false)) await cont.click().catch(() => {});
      else break;
      await page.waitForTimeout(900);
    }
    await page.screenshot({ path: join(OUT, `lectie-scena-vizual-${vp.name}.png`) });
    console.log(`  ✓ lectie-scena-vizual-${vp.name}.png`);
    await ctx.close();
  }

  // ── foto: ecranul de pornire ──────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(
    authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/foto`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, 'foto-start-desktop.png') });
  console.log('  ✓ foto-start-desktop.png');
  await ctx.close();

  await browser.close();
  console.log(`\n✅ dovezi în ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
