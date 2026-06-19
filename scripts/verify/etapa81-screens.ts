/**
 * ETAPA 81 FAZA F — screenshot-uri/„screencast" pas-cu-pas ale interactivului
 * într-o LECȚIE REALĂ v2. Userul de audit e autentificat (cookie injectat).
 * Parcurge blocurile lecției, fotografiază fiecare bloc interactiv întâlnit și
 * face o interacțiune (slider mișcat, zar aruncat, try_step), apoi comută registrul.
 *
 *   (server pornit: npm run start)
 *   CONCEPT=<slug> npx tsx --env-file=.env.local scripts/verify/etapa81-screens.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { createClient as createSbClient, type Session } from "@supabase/supabase-js";
import { createServiceClient } from "../../src/lib/supabase/service";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "etapa60-acceptance@test.local";
const PASSWORD = "etapa66-baseline-Parola!9";
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
const OUT = join(process.cwd(), "docs", "design-review", "etapa81");
const CONCEPT = process.env.CONCEPT ?? "g12-probabilitate-conditionata";

function authCookieParts(session: Session) {
  const name = `sb-${REF}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const MAX = 3180;
  if (value.length <= MAX) return [{ name, value }];
  const parts: Array<{ name: string; value: string }> = [];
  for (let i = 0; i * MAX < value.length; i++) parts.push({ name: `${name}.${i}`, value: value.slice(i * MAX, (i + 1) * MAX) });
  return parts;
}

/** clic „Continuă →" până la următorul bloc; întoarce textul tipului de bloc vizibil */
async function shot(page: Page, name: string) { await page.screenshot({ path: join(OUT, name), fullPage: false }); console.log(`  ✓ ${name}`); }

async function run(page: Page, tag: string) {
  await page.goto(`${BASE}/app/chat?concept=${encodeURIComponent(CONCEPT)}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(3500); // streamul lecției
  const seen = new Set<string>();
  // comutatorul de registru (Simplu/Punte/Riguros) e în header
  const hasSwitch = await page.getByRole("group", { name: /Registru/ }).isVisible().catch(() => false);
  if (hasSwitch) {
    await shot(page, `${tag}-01-intro-simplu.png`);
    await page.getByRole("button", { name: "Riguros" }).click().catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, `${tag}-02-intro-riguros.png`);
    await page.getByRole("button", { name: "Simplu" }).click().catch(() => {});
  }
  // parcurge până la 16 blocuri, fotografiind interactivele
  for (let i = 0; i < 16; i++) {
    const markers: Array<[string, () => Promise<boolean>]> = [
      ["slider", async () => page.locator('input[type="range"]').first().isVisible().catch(() => false)],
      ["manipulativ", async () => page.getByRole("button", { name: /Aruncă|Extrage o bilă/ }).first().isVisible().catch(() => false)],
      ["tabel", async () => page.getByRole("button", { name: /Completează celulele/ }).isVisible().catch(() => false)],
      ["reveal", async () => page.getByRole("button", { name: /Dezvăluie pasul/ }).isVisible().catch(() => false)],
      ["trystep", async () => page.getByText(/Încearcă tu/).isVisible().catch(() => false)],
    ];
    for (const [kind, check] of markers) {
      if (seen.has(kind)) continue;
      if (await check()) {
        seen.add(kind);
        await shot(page, `${tag}-${kind}-a.png`);
        // o interacțiune
        if (kind === "slider") { const s = page.locator('input[type="range"]').first(); await s.focus(); for (let k = 0; k < 6; k++) await page.keyboard.press("ArrowRight"); }
        else if (kind === "manipulativ") { await page.getByRole("button", { name: /Aruncă|Extrage o bilă/ }).first().click().catch(() => {}); }
        else if (kind === "tabel") { await page.getByRole("button", { name: /Completează celulele/ }).click().catch(() => {}); }
        else if (kind === "reveal") { await page.getByRole("button", { name: /Dezvăluie pasul/ }).click().catch(() => {}); }
        else if (kind === "trystep") { await page.locator('input').last().fill("2").catch(() => {}); await page.getByRole("button", { name: "Verifică" }).click().catch(() => {}); }
        await page.waitForTimeout(700);
        await shot(page, `${tag}-${kind}-b.png`);
      }
    }
    const cont = page.getByRole("button", { name: /Continuă/ }).first();
    if (!(await cont.isVisible().catch(() => false))) break;
    await cont.click().catch(() => {});
    await page.waitForTimeout(900);
  }
  console.log(`  [${tag}] blocuri interactive văzute: ${[...seen].join(", ") || "(niciunul)"}`);
  return seen;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) { console.error("✗ user de audit lipsește"); process.exit(1); }
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) { console.error(`✗ signIn: ${error?.message}`); process.exit(1); }
  const browser = await chromium.launch({ headless: true });

  console.log(`Concept: ${CONCEPT}`);
  for (const [tag, vp] of [["desktop", { width: 1280, height: 900 }], ["mobil", { width: 390, height: 844 }]] as const) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addCookies(authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false })));
    const page = await ctx.newPage();
    await run(page, tag);
    await ctx.close();
  }
  await browser.close();
  console.log(`\n✅ Screenshot-uri în ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
