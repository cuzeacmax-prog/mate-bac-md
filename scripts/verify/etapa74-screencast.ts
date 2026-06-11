/**
 * ETAPA 74 FAZA D — SCREENCAST (Playwright video): lecția cu un răspuns
 * CORECT și unul GREȘIT — mișcarea (shake, burst, particule) nu se vede în
 * poze. Video în docs/design-review/etapa74/lectie-feedback.webm.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa74-screencast.ts
 */
import { mkdirSync, renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa74');

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
  const videoDir = join(OUT, '_video_tmp');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  });
  await context.addCookies(
    authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
  );
  const page = await context.newPage();

  await page.goto(`${BASE}/app/chat?concept=g12-piramida`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const ok = await page.getByText(/Lecție · pasul/).waitFor({ state: 'visible', timeout: 180_000 }).then(() => true).catch(() => false);
  if (!ok) fail('playerul nu a apărut');

  let sawWrong = false;
  let sawCorrect = false;
  for (let step = 0; step < 24 && !(sawWrong && sawCorrect); step++) {
    await page.waitForTimeout(2000);
    const isQuiz = await page.getByText('Verifică-te').isVisible().catch(() => false);
    if (isQuiz) {
      // răspundem pe rând (b,a,c,d) — primul greșit dă SHAKE, corectul dă BURST
      for (const letter of ['b', 'a', 'c', 'd']) {
        const opt = page.locator('button', { has: page.locator(`span:text-is("${letter}")`) }).first();
        if (!(await opt.isEnabled().catch(() => false))) continue;
        await opt.click().catch(() => {});
        await page.waitForTimeout(2600); // animația de feedback intră în video
        if (await page.getByText('✓ Corect!').isVisible().catch(() => false)) { sawCorrect = true; break; }
        if (await page.getByText('💡 Indiciu:').isVisible().catch(() => false)) { sawWrong = true; continue; }
        if (await page.getByText('Răspunsul corect:').isVisible().catch(() => false)) { sawWrong = true; break; }
      }
      await page.waitForTimeout(1200);
    }
    const cont = page.getByRole('button', { name: /^Continuă/ }).first();
    if (await cont.isEnabled().catch(() => false)) await cont.click().catch(() => {});
    if (await page.getByText('Lecție terminată!').isVisible().catch(() => false)) {
      await page.waitForTimeout(3500); // ritualul: particule + streak + mastery
      break;
    }
  }
  await page.waitForTimeout(1000);
  const video = page.video();
  await context.close();
  await browser.close();

  // mutăm videoul la numele final
  const path = await video?.path();
  if (path) {
    const target = join(OUT, 'lectie-feedback.webm');
    renameSync(path, target);
    try { readdirSync(videoDir).length === 0 && (await import('node:fs')).rmdirSync(videoDir); } catch { /* lăsăm tmp */ }
    console.log(`✅ screencast: ${target}`);
  }
  console.log(`feedback surprins: corect=${sawCorrect} greșit=${sawWrong}`);
  if (!sawCorrect && !sawWrong) {
    console.log('⚠ niciun quiz pe drum — re-rulează (lecția se generează diferit)');
    process.exitCode = 2;
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
