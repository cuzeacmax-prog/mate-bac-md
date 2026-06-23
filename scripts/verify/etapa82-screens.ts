/**
 * etapa82-screens.ts — ETAPA 82 FAZA E: bucla vizuală.
 * Desktop (1440) + mobil (390), userul de audit logat. Ieșire:
 *   docs/design-review/etapa82/<ecran>-<viewport>.png
 *
 * Acoperă cerința: onboarding (clasă, obiectiv, welcome) + confirmare; harta
 * clasei 10 vs 12 (vizibil diferite); comutatorul + "Harta completă"; un cont
 * goal='note_clasa' fără limbaj de BAC (flip prin API-ul aplicației, apoi revine).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa82-screens.ts
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page, type BrowserContext } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa82');

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

async function shoot(page: Page, name: string, suffix: string, fullPage = true) {
  await page.screenshot({ path: join(OUT, `${name}-${suffix}.png`), fullPage });
  console.log(`  ✓ ${name}-${suffix}.png`);
}

async function setGoal(page: Page, goal: string, grade: number) {
  await page.request.post(`${BASE}/api/profile`, { data: { goal, grade_level: grade } });
}

async function main() {
  // ONBOARDING_ONLY=1 → doar ecranele de onboarding (fără DB/login) — util cât
  // timp migrația nu e încă aplicată în producție.
  const onboardingOnly = !!process.env.ONBOARDING_ONLY;
  const svc = createServiceClient();
  let session: Session | null = null;
  let userId: string | null = null;

  if (!onboardingOnly) {
    const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users.find((u) => u.email === EMAIL);
    if (!user) fail('userul de audit lipsește');
    userId = user.id;
    await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
    // pornim în modul BAC, clasa 12 (harta plină)
    const { error: prepErr } = await svc
      .from('user_profiles')
      .update({ goal: 'bac', grade_level: 12, target_bac_score: 9 })
      .eq('id', user.id);
    if (prepErr) fail(`prep profil (migrația aplicată?): ${prepErr.message}`);

    const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    if (error || !signIn.session) fail(`signIn: ${error?.message}`);
    session = signIn.session;
  }

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const newCtx = async (width: number, height: number): Promise<BrowserContext> => {
    const ctx = await browser.newContext({ viewport: { width, height } });
    if (session) {
      await ctx.addCookies(
        authCookieParts(session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
      );
    }
    return ctx;
  };

  for (const vp of [
    { suffix: 'desktop', width: 1440, height: 900 },
    { suffix: 'mobil', width: 390, height: 844 },
  ]) {
    console.log(`\n── viewport ${vp.suffix} (${vp.width}px) ──`);
    const ctx = await newCtx(vp.width, vp.height);
    const page = await ctx.newPage();

    // ── ONBOARDING (3 ecrane) ──────────────────────────────────────────────
    for (const [name, path, settle] of [
      ['onboarding-welcome', '/onboarding/welcome', 900],
      ['onboarding-grade', '/onboarding/grade', 900],
      ['onboarding-obiectiv', '/onboarding/obiectiv', 900],
    ] as const) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(settle);
      await shoot(page, name, vp.suffix);
    }

    if (onboardingOnly) { await ctx.close(); continue; }

    // ── HARTA (BAC, clasa 12 implicit) ─────────────────────────────────────
    await setGoal(page, 'bac', 12);
    await page.goto(`${BASE}/app/harta`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
    await page.locator('svg[role="img"]').waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1600);
    await shoot(page, 'harta-clasa12', vp.suffix, false);

    // comutator → clasa 10 (vizibil mai curată / diferită)
    await page.locator('[data-testid="grade-pill"][data-grade="10"]').click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1400);
    await shoot(page, 'harta-clasa10', vp.suffix, false);

    // "Harta completă" (vezi toate)
    await page.locator('[data-testid="show-all-toggle"]').click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1400);
    await shoot(page, 'harta-completa', vp.suffix, false);

    // ── AZI (BAC) ──────────────────────────────────────────────────────────
    await page.goto(`${BASE}/app/azi`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shoot(page, 'azi-bac', vp.suffix);

    // ── CONT goal='note_clasa' (ZERO limbaj de BAC) ────────────────────────
    await setGoal(page, 'note_clasa', 10);
    await page.goto(`${BASE}/app/harta`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(1600);
    await shoot(page, 'harta-note-clasa', vp.suffix, false);
    await page.goto(`${BASE}/app/azi`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shoot(page, 'azi-note-clasa', vp.suffix);

    // confirmare A3 (doar desktop): flip goal NULL prin service, apoi revine
    if (vp.suffix === 'desktop' && userId) {
      await svc.from('user_profiles').update({ goal: null }).eq('id', userId);
      await page.goto(`${BASE}/onboarding/confirma`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(900);
      await shoot(page, 'onboarding-confirma', vp.suffix);
    }

    // revenim la modul BAC, clasa 12
    if (userId) await svc.from('user_profiles').update({ goal: 'bac', grade_level: 12 }).eq('id', userId);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n✅ ETAPA 82 screenshots în ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
