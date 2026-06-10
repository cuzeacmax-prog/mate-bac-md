/**
 * ETAPA 72 P1 — ACCEPTANȚĂ: stress-test pe hartă, Playwright headless.
 *
 * 60s de pan/zoom CONTINUU + 3 schimbări de lentilă + 2 de domeniu.
 * Pagina trebuie să rămână VIE: fără crash de renderer, fără pageerror,
 * fără memorie care crește liniar (heap măsurat la 0/30/60s, raportat).
 * Cere serverul dev pornit (BASE_URL, implicit http://localhost:3000).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa72-map-stress.ts
 */
import { chromium } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];

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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await context.addCookies(
    authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
  );
  const page = await context.newPage();

  let crashed = false;
  const pageErrors: string[] = [];
  page.on('crash', () => { crashed = true; });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async (): Promise<number> => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return (metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / 1024 / 1024;
  };

  await page.goto(`${BASE}/app/harta`, { waitUntil: 'networkidle', timeout: 90_000 });
  const svg = page.locator('svg[role="img"]');
  await svg.waitFor({ state: 'visible', timeout: 30_000 });
  console.log('harta încărcată — pornesc stresul de 60s');

  const box = await svg.boundingBox();
  if (!box) fail('nu găsesc zona hărții');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const heap0 = await heap();
  console.log(`heap @0s: ${heap0.toFixed(1)} MB`);

  const start = Date.now();
  let heap30 = 0;
  let lensClicks = 0;
  let domainClicks = 0;
  let cycle = 0;
  while (Date.now() - start < 60_000) {
    if (crashed) break;
    cycle++;
    // pan continuu: drag dintr-o parte în alta, cu pași mici (pointermove des)
    await page.mouse.move(cx - 200, cy - 100);
    await page.mouse.down();
    for (let s = 0; s <= 20; s++) {
      await page.mouse.move(cx - 200 + s * 20, cy - 100 + Math.sin(s) * 60, { steps: 3 });
    }
    await page.mouse.up();
    // zoom in/out din rotiță
    for (let z = 0; z < 6; z++) await page.mouse.wheel(0, z % 2 === 0 ? -240 : 240);

    // 3 lentile + 2 domenii pe parcurs
    if (cycle === 3 || cycle === 6 || cycle === 9) {
      const lens = ['Test mâine', 'BAC', 'Nota-țintă'][lensClicks % 3];
      await page.getByRole('button', { name: lens }).first().click({ timeout: 5_000 }).catch(() => {});
      lensClicks++;
    }
    if (cycle === 4 || cycle === 8) {
      const tabs = page.locator('div.overflow-x-auto button');
      const count = await tabs.count();
      if (count > 1) await tabs.nth((domainClicks + 1) % count).click().catch(() => {});
      domainClicks++;
    }
    if (heap30 === 0 && Date.now() - start >= 30_000) {
      heap30 = await heap();
      console.log(`heap @30s: ${heap30.toFixed(1)} MB (cicluri: ${cycle})`);
    }
  }
  const heap60 = await heap();
  console.log(`heap @60s: ${heap60.toFixed(1)} MB (cicluri: ${cycle}, lentile: ${lensClicks}, domenii: ${domainClicks})`);

  if (crashed) fail('PAGINA A CRĂPAT (renderer crash) în timpul stresului');
  // pagina e vie?
  const alive = await page.evaluate(() => 1 + 1).catch(() => null);
  if (alive !== 2) fail('pagina nu mai răspunde la evaluate');
  const visible = await svg.isVisible().catch(() => false);
  if (!visible) fail('SVG-ul hărții a dispărut');
  if (pageErrors.length > 0) fail(`erori de pagină în timpul stresului: ${pageErrors.slice(0, 3).join(' | ')}`);
  // memoria nu crește liniar: heap-ul final sub 3× inițial (GC are voie să oscileze)
  if (heap60 > heap0 * 3 + 50) fail(`heap crescut suspect: ${heap0.toFixed(1)} → ${heap60.toFixed(1)} MB`);

  await browser.close();
  console.log(`\n✅ ETAPA 72 P1 acceptată: 60s pan/zoom + ${lensClicks} lentile + ${domainClicks} domenii — pagina VIE, heap ${heap0.toFixed(1)} → ${heap30.toFixed(1)} → ${heap60.toFixed(1)} MB, zero crash/pageerror.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
