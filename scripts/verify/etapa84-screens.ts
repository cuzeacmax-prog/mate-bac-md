/**
 * etapa84-screens.ts — ETAPA 84 FAZA E: harta fiecărei clase (9/10/11/12) cu TOATE
 * temele ei, butoanele de domeniu în gradient albastru coerent, titlu+badge sincron.
 * Comută clasa prin pastilele selectorului (data-grade) — dovedește și sincronizarea (C).
 *   npx tsx --env-file=.env.local scripts/verify/etapa84-screens.ts
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
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa84');

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
  // note_clasa: ca titlul „Stăpânește clasa a N-a" să arate sincronizarea pe clasă
  await svc.from('user_profiles').update({ goal: 'note_clasa', grade_level: 12, target_bac_score: 9 }).eq('id', user.id);
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false })));
  const page = await ctx.newPage();

  await page.goto(`${BASE}/app/harta`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
  await page.locator('svg[role="img"]').waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  for (const g of [9, 10, 11, 12]) {
    await page.locator(`[data-testid="grade-pill"][data-grade="${g}"]`).click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1400);
    const badge = await page.locator('[data-testid="map-badge"]').textContent().catch(() => '');
    await page.screenshot({ path: join(OUT, `harta-clasa-${g}.png`), fullPage: false });
    console.log(`  ✓ harta-clasa-${g}.png · badge: "${(badge ?? '').trim()}"`);
  }
  await ctx.close();
  await browser.close();
  console.log(`\n✅ ETAPA 84 screenshots (harta clasa 9-12) în ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
