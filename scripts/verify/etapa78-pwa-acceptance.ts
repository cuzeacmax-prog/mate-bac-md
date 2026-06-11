/**
 * ETAPA 78 FAZA A — ACCEPTANȚĂ PWA:
 *  1. manifestul servit cu câmpurile de instalabilitate (name, icons 192+512,
 *     start_url, display standalone) + iconurile și sw.js răspund 200;
 *  2. OFFLINE REAL: SW înregistrat → context offline → navigarea arată ecranul
 *     de brand „Ești offline", nu eroarea browserului;
 *  3. promptul de instalare: fără moment de valoare NU apare; cu momentul atins
 *     și beforeinstallprompt simulat apare bannerul discret → screenshot.
 *
 * Notă onestă: Lighthouse ≥12 a ELIMINAT categoria PWA; instalabilitatea se
 * dovedește aici prin verificarea directă a criteriilor (manifest+SW+iconuri).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa78-pwa-acceptance.ts
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
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa78');

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

  // ── 1) criteriile de instalabilitate, direct ─────────────────────────────
  const mResp = await fetch(`${BASE}/manifest.webmanifest`);
  if (!mResp.ok) fail(`manifest: HTTP ${mResp.status}`);
  const manifest = await mResp.json();
  if (!manifest.name || manifest.display !== 'standalone' || !manifest.start_url) {
    fail('manifestul nu are name/display standalone/start_url');
  }
  const sizes = (manifest.icons ?? []).map((i: { sizes: string }) => i.sizes);
  if (!sizes.includes('192x192') || !sizes.includes('512x512')) {
    fail(`iconurile 192+512 lipsesc din manifest (${sizes.join(',')})`);
  }
  for (const icon of manifest.icons) {
    const r = await fetch(`${BASE}${icon.src}`);
    if (!r.ok) fail(`iconul ${icon.src}: HTTP ${r.status}`);
  }
  const swResp = await fetch(`${BASE}/sw.js`);
  if (!swResp.ok) fail(`sw.js: HTTP ${swResp.status}`);
  if (!(await swResp.text()).includes('OFFLINE_URL')) fail('sw.js nu are shell-ul offline');
  console.log('  ✓ manifest instalabil (name, standalone, start_url, iconuri 192+512) + sw.js servite');

  // ── auth pentru paginile /app ─────────────────────────────────────────────
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addCookies(
    authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
  );
  const page = await ctx.newPage();

  // ── 2) offline real ──────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/azi`, { waitUntil: 'networkidle', timeout: 90_000 });
  const swReady = await page.evaluate(
    `navigator.serviceWorker.ready.then(() => true).catch(() => false)`
  );
  if (!swReady) fail('service worker-ul nu s-a activat');
  // instalarea face addAll('/offline', iconuri) — așteptăm cache-ul populat
  const cached = await page.evaluate(
    `caches.open('pm-shell-v1').then((c) => c.match('/offline')).then((h) => Boolean(h))`
  );
  if (!cached) fail('/offline nu e în cache după instalarea SW');
  await ctx.setOffline(true);
  await page.goto(`${BASE}/app/harta`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const offlineShown = await page.getByText('Ești offline').isVisible().catch(() => false);
  if (!offlineShown) fail('navigarea offline NU a arătat ecranul de brand');
  await page.screenshot({ path: join(OUT, 'pwa-offline.png') });
  await ctx.setOffline(false);
  console.log('  ✓ offline real: ecranul de brand servit de SW (pwa-offline.png)');

  // ── 3) promptul discret ──────────────────────────────────────────────────
  await page.goto(`${BASE}/app/azi`, { waitUntil: 'networkidle', timeout: 90_000 });
  // fără moment de valoare: bannerul NU apare nici cu beforeinstallprompt
  await page.evaluate(`(() => {
    localStorage.removeItem('pm-momente-lectii');
    localStorage.removeItem('pm-momente-daily');
    localStorage.removeItem('pm-install-respins-la');
  })()`);
  await page.reload({ waitUntil: 'networkidle' });
  const fire = `(() => {
    const ev = new Event('beforeinstallprompt');
    ev.prompt = () => Promise.resolve();
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(ev);
  })()`;
  await page.evaluate(fire);
  await page.waitForTimeout(600);
  if (await page.getByTestId('pwa-install-banner').isVisible().catch(() => false)) {
    fail('bannerul a apărut FĂRĂ momentul de valoare (sâcâie la prima vizită)');
  }
  console.log('  ✓ fără moment de valoare → niciun prompt (discreția respectată)');

  await page.evaluate(`localStorage.setItem('pm-momente-lectii', '1')`);
  await page.evaluate(fire);
  await page.getByTestId('pwa-install-banner').waitFor({ state: 'visible', timeout: 5_000 })
    .catch(() => fail('bannerul NU a apărut după prima lecție completată'));
  await page.screenshot({ path: join(OUT, 'pwa-install-prompt.png') });
  console.log('  ✓ după prima lecție: bannerul discret apare (pwa-install-prompt.png)');

  // respins → 14 zile tăcere
  await page.getByLabel('Nu acum').click();
  await page.evaluate(fire);
  await page.waitForTimeout(600);
  if (await page.getByTestId('pwa-install-banner').isVisible().catch(() => false)) {
    fail('bannerul a reapărut imediat după respingere');
  }
  console.log('  ✓ respins → tăcere (14 zile, localStorage)');

  await browser.close();
  console.log('\n✅ FAZA A: PWA instalabilă, offline pe brand, prompt cu bun-simț.');
}
main().catch((e) => { console.error(e); process.exit(1); });
