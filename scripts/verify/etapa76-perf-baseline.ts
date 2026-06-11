/**
 * ETAPA 76 FAZA 0 / FAZA E — BASELINE DE PERFORMANȚĂ (Playwright, autentificat).
 *
 * 5 rute × desktop+mobil × 3 rulări mediate: TTFB, LCP, TBT (long tasks),
 * + payload-ul de JS transferat per rută (analiza de bundle din 66, re-rulată
 * la nivel de rețea — ce ajunge REAL la client).
 * Snapshot JSON pentru comparația înainte/după (FAZA E).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa76-perf-baseline.ts
 *   SNAPSHOT=docs/etapa76-baseline.json ... (scrie și snapshot)
 *   (serverul de PRODUCȚIE pe BASE_URL — dev-ul ar minți)
 */
import { writeFileSync } from 'node:fs';
import { chromium, type BrowserContext } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const RUNS = 3;

const ROUTES: Array<{ name: string; path: string }> = [
  { name: 'landing', path: '/' },
  { name: 'azi', path: '/app/azi' },
  { name: 'harta', path: '/app/harta' },
  { name: 'lesson', path: '/app/chat?concept=g12-piramida' },
  { name: 'progres', path: '/app/progres' },
];

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

interface RunMetrics { ttfb: number; lcp: number; tbt: number; jsKb: number; reqs: number }
interface RouteMetrics { ttfb: number; lcp: number; tbt: number; jsKb: number; reqs: number }

async function measureOnce(context: BrowserContext, path: string, cpuThrottle: number): Promise<RunMetrics> {
  const page = await context.newPage();
  if (cpuThrottle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  }
  let jsBytes = 0;
  let reqs = 0;
  page.on('response', async (resp) => {
    reqs++;
    try {
      const ct = resp.headers()['content-type'] ?? '';
      if (ct.includes('javascript')) {
        const b = await resp.body().catch(() => null);
        if (b) jsBytes += b.length;
      }
    } catch { /* response detached */ }
  });
  // observerele se instalează ÎNAINTE de navigare
  await page.addInitScript(() => {
    (window as unknown as { __lcp: number }).__lcp = 0;
    (window as unknown as { __tbt: number }).__tbt = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        (window as unknown as { __lcp: number }).__lcp = e.startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        const block = e.duration - 50;
        if (block > 0) (window as unknown as { __tbt: number }).__tbt += block;
      }
    }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(2500); // LCP/longtasks să se așeze
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      ttfb: nav ? nav.responseStart : 0,
      lcp: (window as unknown as { __lcp: number }).__lcp,
      tbt: (window as unknown as { __tbt: number }).__tbt,
    };
  });
  await page.close();
  return { ...m, jsKb: Math.round(jsBytes / 1024), reqs };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
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
  const results: Record<string, RouteMetrics> = {};

  for (const viewport of [
    { suffix: 'desktop', width: 1440, height: 900, cpuThrottle: 1 },
    // mobil: viewport mic + CPU 4x mai lent (aproximarea Lighthouse "moto g4")
    { suffix: 'mobil', width: 390, height: 844, cpuThrottle: 4 },
  ]) {
    for (const route of ROUTES) {
      const runs: RunMetrics[] = [];
      for (let i = 0; i < RUNS; i++) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        await context.addCookies(
          authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
        );
        runs.push(await measureOnce(context, route.path, viewport.cpuThrottle));
        await context.close();
      }
      const agg: RouteMetrics = {
        ttfb: Math.round(median(runs.map((r) => r.ttfb))),
        lcp: Math.round(median(runs.map((r) => r.lcp))),
        tbt: Math.round(median(runs.map((r) => r.tbt))),
        jsKb: Math.round(median(runs.map((r) => r.jsKb))),
        reqs: Math.round(median(runs.map((r) => r.reqs))),
      };
      results[`${route.name}-${viewport.suffix}`] = agg;
      console.log(
        `  ${route.name.padEnd(8)} ${viewport.suffix.padEnd(8)} TTFB=${String(agg.ttfb).padStart(5)}ms  LCP=${String(agg.lcp).padStart(6)}ms  TBT=${String(agg.tbt).padStart(5)}ms  JS=${String(agg.jsKb).padStart(5)}KB  req=${agg.reqs}`
      );
    }
  }
  await browser.close();

  const snapshot = process.env.SNAPSHOT;
  if (snapshot) {
    writeFileSync(snapshot, JSON.stringify({ base: BASE, runs: RUNS, results }, null, 2));
    console.log(`\nsnapshot scris: ${snapshot}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
