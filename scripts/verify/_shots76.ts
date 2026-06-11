import { chromium } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';
const BASE = 'http://localhost:3000';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const SUFFIX = process.env.SUFFIX ?? 'inainte';
function cookieParts(session: Session) {
  const name = `sb-${REF}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const MAX = 3180; const parts: Array<{name:string;value:string}> = [];
  if (value.length <= MAX) return [{ name, value }];
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
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookieParts(signIn!.session!).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false })));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/harta`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  const tabs: Record<string, string> = { i: 'Primitive', iv: 'Probabilități', v: 'Poliedre' };
  for (const [k, label] of Object.entries(tabs)) {
    await page.getByRole('button', { name: new RegExp(label) }).first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `docs/design-review/etapa76/layout-${SUFFIX}-${k}.png` });
    console.log(`  ✓ layout-${SUFFIX}-${k}.png`);
  }
  await browser.close();
}
main();
