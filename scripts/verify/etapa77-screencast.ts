/**
 * ETAPA 77 G — SCREENCAST coregrafie: tranzițiile între pagini + stagger +
 * lecția-scenă (mișcarea nu se vede în poze) → docs/design-review/etapa77/coregrafia.webm
 */
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa77');

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
  const user = list!.users.find((u) => u.email === 'etapa60-acceptance@test.local')!;
  await svc.auth.admin.updateUserById(user.id, { password: 'etapa66-baseline-Parola!9' });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn } = await anon.auth.signInWithPassword({ email: 'etapa60-acceptance@test.local', password: 'etapa66-baseline-Parola!9' });

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: join(OUT, '_v'), size: { width: 1280, height: 800 } },
  });
  await context.addCookies(authCookieParts(signIn!.session!).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false })));
  const page = await context.newPage();

  // tranzițiile: azi (stagger) → harta → foto → lecția-scenă
  await page.goto(`${BASE}/app/azi`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1800);
  await page.getByRole('link', { name: 'Harta', exact: true }).click();
  await page.waitForTimeout(2200);
  await page.getByRole('link', { name: 'Foto', exact: true }).click();
  await page.waitForTimeout(1600);
  await page.goto(`${BASE}/app/chat?concept=g12-piramida`, { waitUntil: 'domcontentloaded' });
  await page.getByText(/Lecție · pasul/).waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) {
    const cont = page.getByRole('button', { name: /^Continuă/ }).first();
    if (await cont.isEnabled().catch(() => false)) await cont.click().catch(() => {});
    await page.waitForTimeout(1400);
  }
  const video = page.video();
  await context.close();
  await browser.close();
  const p = await video?.path();
  if (p) {
    renameSync(p, join(OUT, 'coregrafia.webm'));
    console.log('✅ coregrafia.webm');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
