/**
 * ETAPA 74 FAZA D — screenshots pentru bucla vizuală OBLIGATORIE.
 * Toate ecranele FAZEI C, desktop (1440) + mobil (390), userul de audit logat.
 * Verifică și computed font-family (zero serif — defectul #1).
 * Ieșire: docs/design-review/etapa74/<ecran>-<viewport>.png
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa74-screenshots.ts
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

interface Shot {
  name: string;
  path: string;
  /** așteptare suplimentară (stream/animații) */
  settleMs?: number;
  /** doar desktop (ex. lesson player — cost LLM per încărcare) */
  desktopOnly?: boolean;
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

  // o conversație reală CU CONȚINUT pentru ecranul de chat — lecțiile
  // abandonate de crawl-uri au mesaje aproape goale (transcript fără blocuri),
  // deci alegem conversația cu cel mai consistent mesaj de asistent
  const { data: convs } = await svc
    .from('conversations')
    .select('id, updated_at, messages!inner(role, content)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(12);
  let convId: string | undefined;
  let best = 0;
  for (const c of convs ?? []) {
    const msgs = (c.messages ?? []) as Array<{ role: string; content: string | null }>;
    const score = msgs
      .filter((m) => m.role === 'assistant')
      .reduce((acc, m) => Math.max(acc, (m.content ?? '').length), 0);
    if (score > best) { best = score; convId = c.id as string; }
  }

  const shots: Shot[] = [
    { name: 'azi', path: '/app/azi', settleMs: 1200 },
    { name: 'harta', path: '/app/harta', settleMs: 1500 },
    { name: 'lesson', path: '/app/chat?concept=g12-piramida', settleMs: 14000, desktopOnly: true },
    ...(convId ? [{ name: 'chat', path: `/app/chat/${convId}`, settleMs: 1500 }] : []),
    { name: 'progres', path: '/app/progres', settleMs: 1500 },
    { name: 'simulare', path: '/app/simulare', settleMs: 1200 },
    { name: 'abonament', path: '/app/abonament', settleMs: 1200 },
    { name: 'onboarding-goal', path: '/onboarding/goal', settleMs: 1200 },
  ];

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const shoot = async (page: Page, shot: Shot, suffix: string) => {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
    if (shot.name === 'lesson') {
      // așteptăm PLAYERUL, nu un timeout orb; time-to-first-block pe free tier
      // poate depăși 60s (blocuri respinse + re-cerere) — runda 2 a dovedit-o
      await page.getByText(/Lecție · pasul/).waitFor({ state: 'visible', timeout: 150_000 }).catch(() => {});
      await page.waitForTimeout(800);
    } else {
      await page.waitForTimeout(shot.settleMs ?? 800);
    }
    await page.screenshot({ path: join(OUT, `${shot.name}-${suffix}.png`), fullPage: shot.name !== 'harta' });
    console.log(`  ✓ ${shot.name}-${suffix}.png`);
  };

  // SHOT_ONLY=<nume> → re-rulează un singur ecran (iterațiile buclei vizuale)
  const only = process.env.SHOT_ONLY;
  for (const viewport of [
    { suffix: 'desktop', width: 1440, height: 900 },
    { suffix: 'mobil', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await context.addCookies(
      authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
    );
    const page = await context.newPage();
    console.log(`\n── viewport ${viewport.suffix} (${viewport.width}px) ──`);

    // verificarea fontului (defectul #1): computed font-family pe heading + body
    if (viewport.suffix === 'desktop' && !only) {
      await page.goto(`${BASE}/app/azi`, { waitUntil: 'networkidle', timeout: 90_000 });
      const fonts = await page.evaluate(() => {
        const h = document.querySelector('h1, h2');
        return {
          heading: h ? getComputedStyle(h).fontFamily : '(fără heading)',
          body: getComputedStyle(document.body).fontFamily,
        };
      });
      console.log(`  font heading: ${fonts.heading.slice(0, 60)}`);
      console.log(`  font body:    ${fonts.body.slice(0, 60)}`);
      for (const f of [fonts.heading, fonts.body]) {
        if (/times|georgia|serif^/i.test(f) || !/manrope/i.test(f)) {
          fail(`FONTUL NU E MANROPE (serif de sistem?): ${f}`);
        }
      }
      console.log('  ✓ computed font = Manrope (zero serif)');
    }

    for (const shot of shots) {
      if (only && shot.name !== only) continue;
      if (shot.desktopOnly && viewport.suffix !== 'desktop') continue;
      await shoot(page, shot, viewport.suffix);
    }
    await context.close();
  }
  await browser.close();
  console.log(`\n✅ screenshots în ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
