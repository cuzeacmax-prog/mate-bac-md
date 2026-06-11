/**
 * ETAPA 76 FAZA G — SCREENCAST: deschiderea hărții cu pan automat → comutare
 * clasă → finalul unei lecții (canonice) → „Continuă călătoria" → harta cu pan
 * pe nodul avansat. Video în docs/design-review/etapa76/calatoria.webm.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa76-screencast.ts
 */
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: join(OUT, '_v'), size: { width: 1280, height: 800 } },
  });
  await context.addCookies(
    authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
  );
  const page = await context.newPage();

  // 1) deschiderea hărții — pan automat spre „Următorul"
  await page.goto(`${BASE}/app/harta`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(2500);

  // 2) comutarea clasei (iii are 10/11/12)
  await page.getByRole('button', { name: /Combinatorică/ }).first().click();
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: '12', exact: true }).click();
  await page.waitForTimeout(1200);

  // 3) lecția canonică (rapidă) → final → „Continuă călătoria"
  await page.goto(`${BASE}/app/chat?concept=g12-piramida`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const ok = await page.getByText(/Lecție · pasul/).waitFor({ state: 'visible', timeout: 60_000 }).then(() => true).catch(() => false);
  if (!ok) fail('playerul nu a apărut');
  let finished = false;
  for (let step = 0; step < 24 && !finished; step++) {
    await page.waitForTimeout(900);
    const isQuiz = await page.getByText('Verifică-te').isVisible().catch(() => false);
    if (isQuiz) {
      for (const letter of ['a', 'b', 'c', 'd']) {
        const opt = page.locator('button', { has: page.locator(`span:text-is("${letter}")`) }).first();
        if (!(await opt.isEnabled().catch(() => false))) continue;
        await opt.click().catch(() => {});
        await page.waitForTimeout(2000);
        if (await page.getByText('✓ Corect!').isVisible().catch(() => false)) break;
        if (await page.getByText('Răspunsul corect:').isVisible().catch(() => false)) break;
      }
      // răscumpărarea (după 2 greșeli): răspundem ceva → verdict → Continuă
      const redeem = page.locator('input[placeholder="Răspunsul tău"]');
      if (await redeem.isVisible().catch(() => false)) {
        await redeem.fill('1');
        await page.getByRole('button', { name: 'Trimite' }).click().catch(() => {});
        await page.waitForTimeout(3500);
      }
      await page.waitForTimeout(800);
    }
    const cont = page.getByRole('button', { name: /^Continuă/ }).first();
    if (await cont.isEnabled().catch(() => false)) await cont.click().catch(() => {});
    finished = await page.getByText('Lecție terminată!').isVisible().catch(() => false);
  }
  if (!finished) fail('lecția nu s-a terminat în 24 de pași');
  await page.waitForTimeout(2500); // ritualul: particule + streak

  // 4) „Continuă călătoria" → harta cu pan pe nodul avansat + drumul re-aprins
  await page.getByRole('link', { name: /Continuă călătoria/ }).or(page.getByText('Continuă călătoria')).first().click();
  await page.waitForURL(/\/app\/harta/, { timeout: 30_000 });
  await page.waitForTimeout(3000); // pan + selectarea nodului + unda

  const video = page.video();
  await context.close();
  await browser.close();
  const path = await video?.path();
  if (path) {
    renameSync(path, join(OUT, 'calatoria.webm'));
    console.log(`✅ screencast: ${join(OUT, 'calatoria.webm')}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
