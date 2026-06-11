/**
 * ETAPA 76 FAZA G — dovezile vizuale ale cerului Skyrim.
 *
 * Screenshot-uri desktop+mobil: 3 domenii (i/iv/v, clasa 12) + comutarea de
 * clasă pe iii (12 → 10) + drumul aprins + portalul cross-grade (sheet-ul unui
 * nod blocat cu prerechizit în altă clasă). Persistate în
 * docs/design-review/etapa76/.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa76-screens.ts
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa76');

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

const DOMAIN_TABS: Record<string, RegExp> = {
  i: /Primitive/,
  iii: /Combinatorică/,
  iv: /Probabilități/,
  v: /Poliedre/,
};

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ✓ ${name}.png`);
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

  for (const viewport of [
    { suffix: 'desktop', width: 1440, height: 900 },
    { suffix: 'mobil', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await context.addCookies(
      authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
    );
    const page = await context.newPage();
    console.log(`── ${viewport.suffix} ──`);
    await page.goto(`${BASE}/app/harta`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForTimeout(2000); // pan-ul automat + cerul

    // drumul aprins pe domeniul de deschidere
    await shoot(page, `drum-${viewport.suffix}`);

    for (const [key, re] of Object.entries(DOMAIN_TABS)) {
      await page.getByRole('button', { name: re }).first().click();
      await page.waitForTimeout(1100); // cross-fade + pan lin
      await shoot(page, `cer-${key}-12-${viewport.suffix}`);
      if (key === 'iii') {
        await page.getByRole('button', { name: '10', exact: true }).click();
        await page.waitForTimeout(1100);
        await shoot(page, `cer-iii-10-${viewport.suffix}`);
        await page.getByRole('button', { name: '12', exact: true }).click();
        await page.waitForTimeout(700);
      }
    }

    // portalul cross-grade: nodul blocat cu 🌀 → sheet cu „cere: · clasa N"
    if (viewport.suffix === 'desktop') {
      await page.getByRole('button', { name: DOMAIN_TABS.iii }).first().click();
      await page.waitForTimeout(900);
      const portalNode = page.locator('svg text', { hasText: '🌀' }).first();
      if (await portalNode.isVisible().catch(() => false)) {
        await portalNode.click({ force: true });
        await page.waitForTimeout(800);
        await shoot(page, 'portal-sheet-desktop');
        const portalBtn = page.locator('button', { hasText: '🌀 cere:' }).first();
        if (await portalBtn.isVisible().catch(() => false)) {
          await portalBtn.click();
          await page.waitForTimeout(1300);
          await shoot(page, 'portal-dupa-salt-desktop');
        } else {
          console.log('  (sheet fără buton de portal — prerechizitele lipsă sunt în aceeași clasă)');
        }
      } else {
        console.log('  (niciun nod cu portal vizibil pe iii — raportat onest)');
      }
    }
    await context.close();
  }
  await browser.close();
  console.log(`\n✅ dovezi în ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
