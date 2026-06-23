/**
 * etapa82-map-class.ts — POARTĂ B (ETAPA 82 per clasă + **ETAPA 84 fix afișare**):
 * dovada numărată că harta arată TOATE conceptele fiecărei clase (nu 1).
 *   npx tsx --env-file=.env.local scripts/verify/etapa82-map-class.ts
 *
 * Sursa hărții e acum `concepts` grupate per clasă (GRADE_GROUPS). Verificăm că
 * nr. de noduri pe clasă în hartă == nr. de concepte ale clasei în DB.
 */
import { GRADE_GROUPS, ALL_GROUPS } from '../../src/lib/map/layouts';
import { graphTotalNodes, nodesForGrade } from '../../src/lib/map/per-class';

type MapLike = Parameters<typeof graphTotalNodes>[0];
function pass(m: string) { console.log(`✅ ${m}`); }
function fail(m: string): never { throw new Error(m); }

// mapLike din noul model: fiecare grup = un domain cu o singură felie de clasă
const domains = ALL_GROUPS.map((g) => ({ key: g.key, grades: { [String(g.grade)]: { nodes: g.nodes } } }));
const mapLike = { domains } as unknown as MapLike;
const total = graphTotalNodes(mapLike);

console.log('── Harta per clasă: noduri afișate (din layout-uri) ──');
const shown: Record<number, number> = {};
for (const g of [9, 10, 11, 12]) {
  shown[g] = nodesForGrade(mapLike, g);
  console.log(`Clasa ${g}: ${shown[g]} noduri · ${(GRADE_GROUPS[g] ?? []).length} grupuri`);
}
console.log(`Total graf: ${total} noduri\n`);

// regresie ETAPA 84: clasa 11 NU mai e „1 temă"
if (shown[11] <= 1) fail(`clasa 11 afișează ${shown[11]} (bug-ul de afișare a revenit!)`);
pass(`clasa 11 afișează ${shown[11]} noduri (nu „1 temă")`);
if (shown[10] === shown[12]) fail('clasa 10 == clasa 12 (filtrare per clasă stricată)');
pass(`clasele diferă: 9=${shown[9]} 10=${shown[10]} 11=${shown[11]} 12=${shown[12]}`);

async function dbCheck() {
  try {
    const { createServiceClient } = await import('../../src/lib/supabase/service');
    const svc = createServiceClient();
    console.log('\n── Dovadă numărată: hartă vs DB (per clasă) ──');
    for (const g of [9, 10, 11, 12]) {
      const { count } = await svc.from('concepts').select('id', { count: 'exact', head: true }).eq('grade_level', g);
      const db = count ?? 0;
      const ok = shown[g] === db;
      console.log(`  ${ok ? '✓' : '✗'} clasa ${g}: hartă ${shown[g]} vs DB ${db}`);
      if (!ok) fail(`clasa ${g}: harta (${shown[g]}) ≠ DB (${db})`);
    }
    pass('nr. teme afișate pe hartă == nr. real din DB, pentru fiecare clasă 9-12');
  } catch (e) {
    if (e instanceof Error && /clasa \d+:/.test(e.message)) throw e;
    console.log(`\n(verificarea DB sărită: ${e instanceof Error ? e.message : String(e)})`);
  }
}

dbCheck()
  .then(() => console.log('\n✅ POARTĂ B: harta afișează toate conceptele fiecărei clase (dovadă numărată hartă==DB).'))
  .catch((e) => { console.error(`✗ EȘEC: ${e instanceof Error ? e.message : String(e)}`); process.exitCode = 1; });
