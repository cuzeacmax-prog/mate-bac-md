/**
 * etapa82-map-class.ts — ETAPA 82 POARTĂ B: dovada numărată a hărții per clasă.
 *
 * Rulează: npx tsx --env-file=.env.local scripts/verify/etapa82-map-class.ts
 *
 * Partea 1 (deterministă, fără DB): din layout-urile precomputate arată câte
 * noduri vede fiecare clasă vs tot graful — un elev de clasa 10 trebuie să vadă
 * STRICT mai puțin decât tot graful, și diferit de clasa 12.
 * Partea 2 (best-effort, cu DB): raportează „limbo" — concepte fără clasă sau cu
 * clasă în afara 9-12 (pentru curățare), și distribuția pe clase în familii.
 */
import { MAP_LAYOUTS } from '../../src/lib/map/layouts';
import {
  graphTotalNodes,
  nodesForGrade,
  gradesWithContent,
  domainsForGrade,
} from '../../src/lib/map/per-class';

type MapLike = Parameters<typeof graphTotalNodes>[0];

function pass(msg: string) {
  console.log(`✅ ${msg}`);
}
function fail(msg: string): never {
  // exitCode (nu process.exit) — pe Windows exit-ul abrupt în timpul închiderii
  // socketului Supabase declanșează un abort libuv. Lăsăm bucla să se dreneze.
  throw new Error(msg);
}

// ── Partea 1: dovada numărată din layout-uri ────────────────────────────────
const domains = Object.entries(MAP_LAYOUTS).map(([key, layout]) => ({
  key,
  grades: Object.fromEntries(
    Object.entries(layout.grades).map(([g, gl]) => [g, { nodes: gl.nodes }])
  ),
}));
const mapLike = { domains } as unknown as MapLike;

const total = graphTotalNodes(mapLike);
const present = gradesWithContent(mapLike);

console.log('── Harta per clasă: noduri afișate vs total graf ──');
console.log(`Total graf: ${total} noduri\n`);
for (const g of [9, 10, 11, 12]) {
  const n = nodesForGrade(mapLike, g);
  const doms = domainsForGrade(mapLike, g);
  console.log(`Clasa ${g}: ${n} noduri · ${doms.length} domenii [${doms.join(', ') || '—'}]`);
}
console.log('');

if (total <= 0) fail('graful nu are noduri (layout-uri goale?)');

const c10 = nodesForGrade(mapLike, 10);
const c12 = nodesForGrade(mapLike, 12);

// R1: clasa 10 vede STRICT mai puțin decât tot graful (filtrarea funcționează)
if (!(c10 < total)) fail(`clasa 10 (${c10}) NU vede mai puțin decât tot graful (${total})`);
pass(`clasa 10 vede ${c10} < ${total} (filtrare per clasă confirmată)`);

// R2: clasa 10 ≠ clasa 12 (vizibil diferite)
if (c10 === c12) fail(`clasa 10 (${c10}) și clasa 12 (${c12}) afișează la fel — nu sunt diferite`);
pass(`clasa 10 (${c10}) ≠ clasa 12 (${c12}) — vederi diferite`);

// R3: fiecare clasă cu conținut e un subset al totalului
for (const g of present) {
  const n = nodesForGrade(mapLike, g);
  if (n > total) fail(`clasa ${g} (${n}) > total (${total}) — imposibil`);
}
pass(`fiecare clasă ⊆ total graf (${present.join(', ')})`);

// ── Partea 2: raport limbo (best-effort, cu DB) ─────────────────────────────
async function limboReport() {
  try {
    const { createServiceClient } = await import('../../src/lib/supabase/service');
    const svc = createServiceClient();
    const { count, error } = await svc
      .from('concepts')
      .select('id', { count: 'exact', head: true })
      .is('grade_level', null);
    if (error) throw new Error(error.message);
    console.log('\n── Raport limbo (pentru curățare) ──');
    console.log(`Concepte cu grade_level NULL: ${count ?? 0}`);
    if ((count ?? 0) === 0) {
      pass('zero concepte în limbo (toate au clasă atribuită)');
    } else {
      console.log(`⚠ ${count} concepte fără clasă — de marcat (nu blochează poarta).`);
    }
  } catch (err) {
    console.log(`\n(raport limbo sărit: ${err instanceof Error ? err.message : String(err)})`);
  }
}

limboReport()
  .then(() => {
    console.log('\n✅ ETAPA 82 POARTĂ B acceptată: harta se filtrează per clasă (dovadă numărată).');
  })
  .catch((err) => {
    console.error(`✗ EȘEC: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
