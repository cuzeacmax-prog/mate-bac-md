/**
 * etapa83-screens.ts — ETAPA 83 FAZA Z: bucla vizuală pe 3 lățimi (mobil 380,
 * tabletă 768, desktop 1280). Ecranele-cheie ale etapei: harta cu gradient ordonat
 * (albastru), foaia de formule, azi (salut viu), onboarding obiectiv, simulare intro.
 *   npx tsx --env-file=.env.local scripts/verify/etapa83-screens.ts
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
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa83');

function fail(m: string): never { console.error(`✗ EȘEC: ${m}`); process.exit(1); }
function authCookieParts(session: Session) {
  const name = `sb-${REF}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const MAX = 3180;
  if (value.length <= MAX) return [{ name, value }];
  const parts: Array<{ name: string; value: string }> = [];
  for (let i = 0; i * MAX < value.length; i++) parts.push({ name: `${name}.${i}`, value: value.slice(i * MAX, (i + 1) * MAX) });
  return parts;
}

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  await svc.from('user_profiles').update({ goal: 'bac', grade_level: 12, target_bac_score: 9 }).eq('id', user.id);
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const SHOTS: Array<{ name: string; path: string; settle: number; full?: boolean; auth: boolean }> = [
    { name: 'onboarding-obiectiv', path: '/onboarding/obiectiv', settle: 900, full: true, auth: false },
    { name: 'azi', path: '/app/azi', settle: 1300, full: true, auth: true },
    { name: 'harta', path: '/app/harta', settle: 1700, full: false, auth: true },
    { name: 'formule', path: '/app/formule', settle: 1300, full: true, auth: true },
    { name: 'simulare', path: '/app/simulare', settle: 1100, full: true, auth: true },
    { name: 'progres', path: '/app/progres', settle: 1300, full: true, auth: true },
  ];

  for (const vp of [
    { suffix: 'mobil', width: 380, height: 820 },
    { suffix: 'tableta', width: 768, height: 1024 },
    { suffix: 'desktop', width: 1280, height: 900 },
  ]) {
    console.log(`\n── ${vp.suffix} (${vp.width}px) ──`);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies(authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false })));
    const page: Page = await ctx.newPage();
    for (const s of SHOTS) {
      await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
      await page.waitForTimeout(s.settle);
      await page.screenshot({ path: join(OUT, `${s.name}-${vp.suffix}.png`), fullPage: s.full ?? false });
      console.log(`  ✓ ${s.name}-${vp.suffix}.png`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n✅ ETAPA 83 screenshots (3 lățimi) în ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
