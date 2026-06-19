/**
 * ETAPA 80 FAZA 0b — screenshot al cozii umane /admin/continut?tab=bodies
 * (radicalul malformat, eroare evidențiată + preview live). Userul de audit e
 * promovat temporar admin și retrogradat la final (contul lui Maxim neatins).
 *
 *   (porneste serverul: npm run start)  apoi
 *   npx tsx --env-file=.env.local scripts/verify/etapa80-screens.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { createClient as createSbClient, type Session } from "@supabase/supabase-js";
import { createServiceClient } from "../../src/lib/supabase/service";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "etapa60-acceptance@test.local";
const PASSWORD = "etapa66-baseline-Parola!9";
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
const OUT = join(process.cwd(), "docs", "design-review", "etapa80");

function authCookieParts(session: Session): Array<{ name: string; value: string }> {
  const name = `sb-${REF}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const MAX = 3180;
  if (value.length <= MAX) return [{ name, value }];
  const parts: Array<{ name: string; value: string }> = [];
  for (let i = 0; i * MAX < value.length; i++) parts.push({ name: `${name}.${i}`, value: value.slice(i * MAX, (i + 1) * MAX) });
  return parts;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) { console.error("✗ userul de audit lipsește"); process.exit(1); }
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) { console.error(`✗ signIn: ${error?.message}`); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false })));
  const page = await ctx.newPage();

  const { data: before } = await svc.from("profiles").select("subscription_status").eq("id", user.id).maybeSingle();
  const prev = before?.subscription_status ?? "free";
  try {
    await svc.from("profiles").update({ subscription_status: "admin" }).eq("id", user.id);
    await page.goto(`${BASE}/admin/continut?tab=bodies`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(2500); // coada fetch + KaTeX render
    const sawError = await page.getByText(/Eroare\(i\) KaTeX/).isVisible().catch(() => false);
    const sawQueue = await page.getByText(/Coadă body-uri/).isVisible().catch(() => false);
    await page.screenshot({ path: join(OUT, "body-queue.png"), fullPage: true });
    console.log(`  ✓ body-queue.png  (coadă vizibilă: ${sawQueue}, eroare evidențiată: ${sawError})`);
    if (!sawQueue) { console.error("✗ coada nu s-a randat"); process.exit(1); }
  } finally {
    await svc.from("profiles").update({ subscription_status: prev }).eq("id", user.id);
  }
  await browser.close();
  console.log(`\n✅ Screenshot în ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
