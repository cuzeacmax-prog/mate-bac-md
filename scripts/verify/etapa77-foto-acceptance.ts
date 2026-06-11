/**
 * ETAPA 77 F4 — ACCEPTANȚA ONESTĂ a fluxului foto→transcriere.
 *
 * 6 poze de test SINTETIZATE reprezentativ (Playwright, persistate în
 * docs/design-review/etapa77/foto-test/):
 *   1-2: tipărite (enunțuri REALE din culegere, randate cu KaTeX);
 *   3-4: scrise „de mână" lizibil (font cursiv pe hârtie liniată);
 *   5: înclinată + lumină proastă (rotire 8° + întunecare);
 *   6: fără matematică (proză).
 * Raport per poză: corectă/parțială/refuz — FĂRĂ înfrumusețare; verdictul e
 * suprapunere de tokeni normalizați (≥0.75 corectă, ≥0.4 parțială).
 * Pragul de re-poză: RETAKE_THRESHOLD=0.55 (documentat în rută).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa77-foto-acceptance.ts
 *   (serverul pe BASE_URL)
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const OUT = join(process.cwd(), 'docs', 'design-review', 'etapa77', 'foto-test');

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

function buildAuthCookies(session: Session): string {
  const name = `sb-${REF}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0; i * MAX < value.length; i++) parts.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  return parts.join('; ');
}

// tipăriturile folosesc unicode matematic (DETERMINIST, fără scripturi —
// defect runda 1: KaTeX din CDN nu rula la re-setContent → imagini goale)
const PRINTED_1 = 'Calculați integrala ∫₀¹ (3x² + 2x) dx.';
const PRINTED_2 = 'Determinați volumul corpului de rotație generat de funcția f(x) = −x² + 4x, pentru x ∈ [0; 2].';
const HAND_1 = 'Calculati integrala de la 1 la 2 din 1/x² dx';
const HAND_2 = 'Aflati aria subgraficului functiei f(x) = x² pe intervalul [0, 1]';
const NON_MATH = 'Dragă jurnalule, azi am fost cu colegii în parc și am mâncat înghețată de fistic. A fost o zi minunată de vară.';

function printedHtml(statement: string, dark = false, rotate = 0) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>body{margin:0;width:900px;height:420px;background:${dark ? '#9a9890' : '#f7f5f0'};display:flex;align-items:center;justify-content:center;}
  .page{width:780px;background:${dark ? '#b5b2a8' : 'white'};padding:40px;font:22px Georgia,serif;color:#1c1c22;transform:rotate(${rotate}deg);box-shadow:0 2px 14px rgba(0,0,0,0.25);}
  ${dark ? '.page{filter:brightness(0.72) contrast(0.85);}' : ''}</style></head>
  <body><div class="page">7. ${statement}</div></body></html>`;
}

function handHtml(text: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:900px;height:420px;background:#efece4;display:flex;align-items:center;justify-content:center;}
  .caiet{width:780px;height:330px;background:repeating-linear-gradient(white, white 34px, #cfd8e6 35px);padding:30px 40px;
    font-family:'Segoe Script','Comic Sans MS',cursive;font-size:26px;color:#23306b;line-height:35px;}
  </style></head><body><div class="caiet">${text}</div></body></html>`;
}

async function makeImages() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 420 } })).newPage();
  const shots: Array<[string, string]> = [
    ['1-tiparit-integrala.png', printedHtml(PRINTED_1)],
    ['2-tiparit-volum.png', printedHtml(PRINTED_2)],
    ['3-mana-integrala.png', handHtml(HAND_1)],
    ['4-mana-arie.png', handHtml(HAND_2)],
    ['5-inclinat-intunecat.png', printedHtml(PRINTED_1, true, 8)],
    ['6-fara-mate.png', handHtml(NON_MATH)],
  ];
  for (const [name, html] of shots) {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, name) });
  }
  await browser.close();
  return shots.map(([name]) => name);
}

/** suprapunere de tokeni; unicode-ul matematic se normalizează spre ASCII */
function overlap(expected: string, got: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/²/g, '2').replace(/¹/g, '1').replace(/₀/g, '0').replace(/₁/g, '1')
      .replace(/∫/g, 'int').replace(/−/g, '-').replace(/∈/g, 'in')
      .replace(/[\\${}()[\],.;:^_]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);
  const e = norm(expected);
  const g = new Set(norm(got));
  if (e.length === 0) return 0;
  return e.filter((w) => g.has(w)).length / e.length;
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
  const cookies = buildAuthCookies(signIn.session);

  console.log('generez cele 6 poze de test…');
  const names = await makeImages();
  const expected: Array<{ statement: string | null; label: string }> = [
    { statement: PRINTED_1, label: 'tipărit (integrală)' },
    { statement: PRINTED_2, label: 'tipărit (volum rotație)' },
    { statement: HAND_1, label: 'de mână (integrală)' },
    { statement: HAND_2, label: 'de mână (arie)' },
    { statement: PRINTED_1, label: 'înclinat + lumină proastă' },
    { statement: null, label: 'fără matematică (refuz așteptat)' },
  ];

  console.log('\n══ RAPORT ONEST per poză ══');
  let corecte = 0, partiale = 0, gresite = 0, refuzOk = 0;
  for (const [i, name] of names.entries()) {
    const img = readFileSync(join(OUT, name));
    const dataUrl = `data:image/png;base64,${img.toString('base64')}`;
    const resp = await fetch(`${BASE}/api/foto/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies },
      body: JSON.stringify({ image: dataUrl }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.log(`  ${i + 1}. ${expected[i].label}: HTTP ${resp.status} (${data.error})`);
      gresite++;
      continue;
    }
    if (expected[i].statement === null) {
      const ok = data.hasMath === false;
      if (ok) refuzOk++;
      console.log(`  ${i + 1}. ${expected[i].label}: ${ok ? '✓ refuz politicos corect' : `✗ a transcris deși nu era matematică: "${(data.statement ?? '').slice(0, 60)}"`}`);
      continue;
    }
    if (!data.hasMath) {
      console.log(`  ${i + 1}. ${expected[i].label}: ✗ refuzat deși ERA matematică`);
      gresite++;
      continue;
    }
    const ov = overlap(expected[i].statement!, data.statement);
    const verdict = ov >= 0.75 ? 'CORECTĂ' : ov >= 0.4 ? 'PARȚIALĂ' : 'GREȘITĂ';
    if (verdict === 'CORECTĂ') corecte++;
    else if (verdict === 'PARȚIALĂ') partiale++;
    else gresite++;
    console.log(
      `  ${i + 1}. ${expected[i].label}: ${verdict} (suprapunere ${Math.round(ov * 100)}%, încredere ${Math.round((data.confidence ?? 0) * 100)}%${data.retake ? ', CERE RE-POZĂ' : ''})`
    );
    console.log(`     transcris: ${String(data.statement).replace(/\s+/g, ' ').slice(0, 110)}`);
  }
  console.log(`\nsumar: ${corecte} corecte · ${partiale} parțiale · ${gresite} greșite · refuz non-math: ${refuzOk}/1`);
  console.log(`pragul de re-poză: 0.55 (sub el UI-ul cere altă poză — documentat în rută)`);
  if (corecte + partiale < 4 || refuzOk < 1) {
    fail('sub pragul minim de utilitate (≥4/5 măcar parțiale + refuzul corect)');
  }
  console.log('\n✅ F4: fluxul foto e utilizabil; raportul de mai sus e cel real.');
}
main().catch((e) => { console.error(e); process.exit(1); });
