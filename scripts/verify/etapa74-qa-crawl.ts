/**
 * ETAPA 74 FAZA C — QA-CRAWL COMPLET (Playwright, userul de audit).
 *
 * Parcurge TOATE rutele elevului și fluxurile principale:
 *  - daily: verifică un răspuns;
 *  - lecția: 5 blocuri + un quiz răspuns;
 *  - harta: pan/zoom + lentile + click pe nod blocat;
 *  - simulare: start + 1 răspuns + ieșire (fără predare);
 *  - abonament: checkout mock (până la pagina providerului, fără plată).
 *
 * Colectează TOATE erorile de consolă + request-urile eșuate (status ≥ 400 /
 * network fail) → fiecare = defect listat. Ținta: ZERO console errors.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa74-qa-crawl.ts
 *   (serverul pe BASE_URL, default http://localhost:3000)
 */
import { chromium, type Page } from 'playwright';
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

interface Defect { where: string; kind: 'console' | 'pageerror' | 'http' | 'netfail'; detail: string }
const defects: Defect[] = [];
let where = '(init)';

function watch(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    defects.push({ where, kind: 'console', detail: msg.text().slice(0, 300) });
  });
  page.on('pageerror', (err) => {
    defects.push({ where, kind: 'pageerror', detail: String(err).slice(0, 300) });
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      defects.push({ where, kind: 'http', detail: `${resp.status()} ${resp.request().method()} ${resp.url()}` });
    }
  });
  page.on('requestfailed', (req) => {
    const e = req.failure()?.errorText ?? '';
    if (e.includes('ERR_ABORTED')) return; // navigări normale anulează prefetch-uri
    defects.push({ where, kind: 'netfail', detail: `${e} ${req.url()}` });
  });
  // niciun confirm() nu trebuie să blocheze crawl-ul (nu predăm/anulăm nimic)
  page.on('dialog', (d) => void d.dismiss());
}

async function goto(page: Page, path: string, settle = 1200) {
  where = path;
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch((e) => {
    defects.push({ where, kind: 'netfail', detail: `goto: ${String(e).slice(0, 160)}` });
  });
  await page.waitForTimeout(settle);
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

  const { data: conv } = await svc
    .from('conversations')
    .select('id, messages!inner(id)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(
    authCookieParts(signIn.session).map((c) => ({ ...c, url: BASE, httpOnly: false, secure: false }))
  );
  const page = await context.newPage();
  watch(page);

  // ── 1) /app/azi + fluxul daily: verifică un răspuns ───────────────────────
  await goto(page, '/app/azi', 1500);
  const dailyInput = page.locator('input[placeholder^="Răspunsul tău"]').first();
  if (await dailyInput.isVisible().catch(() => false)) {
    await dailyInput.fill('1');
    await page.getByRole('button', { name: 'Verifică' }).first().click();
    await page.waitForTimeout(4000); // evaluarea + feedback-ul
    console.log('  ✓ daily: un răspuns verificat');
  } else {
    console.log('  (daily deja completat azi — flux sărit, pagina tot auditată)');
  }

  // ── 2) lecția: 5 blocuri + un quiz ─────────────────────────────────────────
  where = '/app/chat?concept=g12-piramida (lecție)';
  await page.goto(`${BASE}/app/chat?concept=g12-piramida`, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
  const playerVisible = await page.getByText(/Lecție · pasul/).waitFor({ state: 'visible', timeout: 180_000 }).then(() => true).catch(() => false);
  if (!playerVisible) {
    defects.push({ where, kind: 'pageerror', detail: 'playerul de lecție nu a apărut în 180s' });
  } else {
    let quizAnswered = false;
    for (let step = 0; step < 8; step++) {
      await page.waitForTimeout(1200);
      // quiz pe ecran? răspunde (a, apoi b la retry)
      const isQuiz = await page.getByText('Verifică-te').isVisible().catch(() => false);
      if (isQuiz && !quizAnswered) {
        for (const letter of ['a', 'b', 'c']) {
          const opt = page.locator('button', { has: page.locator(`span:text-is("${letter}")`) }).first();
          if (!(await opt.isEnabled().catch(() => false))) continue;
          await opt.click().catch(() => {});
          await page.waitForTimeout(2500);
          const solved = await page.getByText('✓ Corect!').isVisible().catch(() => false);
          const failed = await page.getByText('Răspunsul corect:').isVisible().catch(() => false);
          if (solved || failed) { quizAnswered = true; break; }
        }
        if (!quizAnswered) quizAnswered = true; // răscumpărarea nu se forțează în crawl
        await page.waitForTimeout(1500);
      }
      const cont = page.getByRole('button', { name: /^Continuă/ }).first();
      if (await cont.isEnabled().catch(() => false)) {
        await cont.click().catch(() => {});
      }
      if (await page.getByText('Lecție terminată!').isVisible().catch(() => false)) break;
    }
    console.log(`  ✓ lecție: ${quizAnswered ? 'blocuri parcurse + quiz răspuns' : 'blocuri parcurse (fără quiz pe drum)'}`);
  }

  // ── 3) harta: pan/zoom + lentile + nod blocat ─────────────────────────────
  await goto(page, '/app/harta', 1800);
  const map = page.locator('svg[role="img"]');
  const box = await map.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 8 });
    await page.mouse.up();
    await page.getByRole('button', { name: '+' }).click();
    await page.getByRole('button', { name: '−' }).click();
  } else {
    defects.push({ where, kind: 'pageerror', detail: 'SVG-ul hărții lipsește' });
  }
  for (const lens of ['Test mâine', 'BAC']) {
    await page.getByRole('button', { name: lens }).first().click().catch(() => {});
    await page.waitForTimeout(500);
  }
  // un nod blocat (🔒) → sheet-ul se deschide → închide
  const lockNode = page.locator('svg text', { hasText: '🔒' }).first();
  if (await lockNode.isVisible().catch(() => false)) {
    await lockNode.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: /închide/ }).click().catch(() => {});
  }
  console.log('  ✓ harta: pan + zoom + lentile + nod blocat');

  // ── 4) simulare: start + 1 răspuns + ieșire ───────────────────────────────
  await goto(page, '/app/simulare', 1500);
  const startBtn = page.getByRole('button', { name: /Începe simularea/ });
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
  }
  const examInput = page.locator('input[placeholder="Răspunsul tău final"]');
  if (await examInput.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false)) {
    await examInput.fill('1');
    await page.waitForTimeout(800);
    console.log('  ✓ simulare: start + 1 răspuns (fără predare)');
  } else {
    defects.push({ where, kind: 'pageerror', detail: 'simularea nu a pornit (inputul nu a apărut)' });
  }
  await goto(page, '/app/azi', 600); // ieșirea din simulare

  // ── 5) abonament: checkout mock ───────────────────────────────────────────
  await goto(page, '/app/abonament', 1500);
  const activate = page.getByRole('button', { name: /Activează Premium|Reîncearcă plata/ });
  if (await activate.isVisible().catch(() => false)) {
    where = '/app/abonament → checkout';
    await activate.click();
    const onCheckout = await page.getByText('Checkout simulat').waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
    if (!onCheckout) defects.push({ where, kind: 'pageerror', detail: 'checkout-ul mock nu s-a deschis' });
    else console.log('  ✓ abonament: checkout mock deschis (fără plată — starea rămâne neatinsă)');
  } else {
    console.log('  (abonamentul e deja activ — checkout-ul nu se oferă; pagina auditată)');
  }

  // ── 6) restul rutelor elevului ────────────────────────────────────────────
  const routes = [
    '/app',
    ...(conv?.id ? [`/app/chat/${conv.id}`] : []),
    '/app/progres',
    '/onboarding/welcome',
    '/onboarding/goal',
    '/onboarding/grade',
    '/onboarding/diagnostic-intro',
  ];
  for (const r of routes) await goto(page, r, 1500);

  await context.close();
  await browser.close();

  // ── raportul ──────────────────────────────────────────────────────────────
  console.log('\n══ QA-CRAWL ETAPA 74 C — defecte ══');
  if (defects.length === 0) {
    console.log('✅ ZERO erori de consolă / request-uri eșuate pe toate fluxurile parcurse.');
    return;
  }
  for (const d of defects) console.log(`  [${d.kind}] ${d.where}\n      ${d.detail}`);
  console.log(`\n✗ ${defects.length} defecte — fiecare se repară sau se marchează cu cauza.`);
  process.exitCode = 2;
}
main().catch((e) => { console.error(e); process.exit(1); });
