/**
 * 06-promote-concepts.ts — ETAPA 3.3a: Promovare concepte din staging în tabela `concepts`
 *
 * Rulează:  npm run extract:promote -- --grade 12
 *           (sau: tsx --env-file=.env.local scripts/extraction/06-promote-concepts.ts --grade 12)
 *
 * Flux:
 *   1. Citește concept_dedup_proposals pentru clasa --grade (242 noduri așteptați pentru cls 12).
 *   2. Citește concept_inventory_raw pentru a rezolva subtopic/module per nod.
 *   3. Construiește rânduri pentru `concepts`:
 *      - name           = canonical_name din propunere
 *      - slug           = "g<grade>-" + slugify(canonical_name); coliziuni → sufix -2, -3, ...
 *      - grade_level    = grade
 *      - order_in_grade = min_pdf_page (0 dacă null)
 *      - kind           = 'notiune' → 'concept'; restul ('definitie','teorema','formula','procedeu') identic
 *      - sub_points     = sub_points din propunere (array de etichete string)
 *      - status         = 'extras'
 *      - subtopic, module = din concept_inventory_raw: rândul cu first_seen_pdf_page == min_pdf_page
 *                           și name în raw_names; fallback la primul raw_name; fallback la null
 *   4. Idempotent: DELETE FROM concepts WHERE grade_level = grade (nu atinge alte clase).
 *   5. INSERT în batch-uri de 500.
 *   6. Raport: total inserat, distribuție kind, coverage subtopic, coliziuni slug.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const DEFAULT_GRADE = 12;
const BATCH_SIZE = 500;

// ── Tipuri ───────────────────────────────────────────────────────────────────

interface ProposalRow {
  canonical_name: string;
  kind: string;
  raw_names: unknown; // jsonb → validăm cu asStringArray
  sub_points: unknown; // jsonb → validăm cu asStringArray
  min_pdf_page: number | null;
}

interface RawInventoryRow {
  name: string;
  first_seen_pdf_page: number | null;
  subtopic: string | null;
  module: string | null;
}

interface RawMeta {
  subtopic: string | null;
  module: string | null;
  first_seen_pdf_page: number | null;
}

interface ConceptInsert {
  slug: string;
  name: string;
  grade_level: number;
  order_in_grade: number;
  kind: string;
  sub_points: string[];
  status: 'extras';
  subtopic: string | null;
  module: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

// Tabel explicit pentru diacritice românești (variante Windows și Unicode modern)
const DIACRITIC_MAP: Record<string, string> = {
  'ă': 'a', 'Ă': 'a', // ă Ă
  'â': 'a', 'Â': 'a', // â Â
  'î': 'i', 'Î': 'i', // î Î
  'ș': 's', 'Ș': 's', // ș Ș (virgulă, modern)
  'ş': 's', 'Ş': 's', // ş Ş (sedilă, Windows)
  'ț': 't', 'Ț': 't', // ț Ț (virgulă, modern)
  'ţ': 't', 'Ţ': 't', // ţ Ţ (sedilă, Windows)
};

function slugify(s: string): string {
  let base = '';
  for (const ch of s) {
    base += DIACRITIC_MAP[ch] ?? ch;
  }
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapKind(k: string): string {
  return k === 'notiune' ? 'concept' : k;
}

// ── Promovare per clasă ──────────────────────────────────────────────────────

// Tip concret al clientului (ReturnType<typeof createClient> ar folosi genericii impliciti → `never`).
function makeClient(url: string, key: string) {
  return createClient(url, key);
}
type Db = ReturnType<typeof makeClient>;

interface PromoteResult {
  grade: number;
  proposals: number;
  inserted: number;
  dbCount: number;
}

/** Promovează O clasă din concept_dedup_proposals în concepts (logica validată pe clasa 12). */
async function promoteGrade(supabase: Db, grade: number): Promise<PromoteResult> {
  const gradePrefix = `g${grade}-`;
  console.log(`\n════════════ CLASA ${grade} ════════════`);

  // 1. Citește concept_dedup_proposals
  console.log(`📥 Citesc concept_dedup_proposals pentru clasa ${grade} …`);
  const proposals: ProposalRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('concept_dedup_proposals')
      .select('canonical_name, kind, raw_names, sub_points, min_pdf_page')
      .eq('grade', grade)
      .order('min_pdf_page', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Citire concept_dedup_proposals: ${error.message}`);
    if (!data || data.length === 0) break;
    proposals.push(...(data as ProposalRow[]));
    if (data.length < PAGE) break;
  }
  if (proposals.length === 0) {
    throw new Error(`Nicio propunere în concept_dedup_proposals pentru clasa ${grade}.`);
  }
  console.log(`   → ${proposals.length} propuneri.`);

  // 2. Citește concept_inventory_raw → Map<name, RawMeta> (min pagină per nume)
  console.log(`📥 Citesc concept_inventory_raw pentru clasa ${grade} …`);
  const rawMapByName = new Map<string, RawMeta>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('concept_inventory_raw')
      .select('name, first_seen_pdf_page, subtopic, module')
      .eq('grade', grade)
      .order('first_seen_pdf_page', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Citire concept_inventory_raw: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as RawInventoryRow[]) {
      const ex = rawMapByName.get(r.name);
      if (
        !ex ||
        (r.first_seen_pdf_page != null &&
          (ex.first_seen_pdf_page == null || r.first_seen_pdf_page < ex.first_seen_pdf_page))
      ) {
        rawMapByName.set(r.name, {
          subtopic: r.subtopic,
          module: r.module,
          first_seen_pdf_page: r.first_seen_pdf_page,
        });
      }
    }
    if (data.length < PAGE) break;
  }
  console.log(`   → ${rawMapByName.size} concepte brute distincte în inventory.`);

  // 3. Construiește rândurile pentru `concepts`
  const usedSlugs = new Set<string>();
  let slugCollisions = 0;

  function uniqueSlug(canonical: string): string {
    const base = gradePrefix + slugify(canonical);
    if (!usedSlugs.has(base)) {
      usedSlugs.add(base);
      return base;
    }
    slugCollisions++;
    let n = 2;
    while (usedSlugs.has(`${base}-${n}`)) n++;
    const s = `${base}-${n}`;
    usedSlugs.add(s);
    return s;
  }

  function resolveSubtopicModule(
    rawNames: string[],
    subPoints: string[],
    minPage: number | null,
  ): { subtopic: string | null; module: string | null } {
    // Preferă: raw_name cu first_seen_pdf_page == min_pdf_page
    if (minPage != null) {
      for (const name of rawNames) {
        const meta = rawMapByName.get(name);
        if (meta && meta.first_seen_pdf_page === minPage) {
          return { subtopic: meta.subtopic, module: meta.module };
        }
      }
    }
    // Fallback: primul raw_name
    if (rawNames.length > 0) {
      const meta = rawMapByName.get(rawNames[0]);
      if (meta) return { subtopic: meta.subtopic, module: meta.module };
    }
    // Fallback final: primul sub_point
    if (subPoints.length > 0) {
      const meta = rawMapByName.get(subPoints[0]);
      if (meta) return { subtopic: meta.subtopic, module: meta.module };
    }
    return { subtopic: null, module: null };
  }

  const rows: ConceptInsert[] = [];
  for (const p of proposals) {
    const rawNames = asStringArray(p.raw_names);
    const subPoints = asStringArray(p.sub_points);
    const { subtopic, module } = resolveSubtopicModule(rawNames, subPoints, p.min_pdf_page);
    rows.push({
      slug: uniqueSlug(p.canonical_name),
      name: p.canonical_name,
      grade_level: grade,
      order_in_grade: p.min_pdf_page ?? 0,
      kind: mapKind(p.kind),
      sub_points: subPoints,
      status: 'extras',
      subtopic,
      module,
    });
  }

  // 4. Idempotent: șterge conceptele existente pentru această clasă (NU atinge alte clase)
  console.log(`🧹 DELETE FROM concepts WHERE grade_level = ${grade} …`);
  const { error: delErr } = await supabase
    .from('concepts')
    .delete()
    .eq('grade_level', grade);
  if (delErr) throw new Error(`DELETE concepts cls ${grade}: ${delErr.message}`);
  console.log(`   → șters.`);

  // 5. INSERT în batch-uri
  console.log(`⬆️  INSERT ${rows.length} rânduri în concepts …`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('concepts').insert(batch);
    if (error) {
      throw new Error(`INSERT concepts [${i}..${i + batch.length - 1}]: ${error.message}`);
    }
    inserted += batch.length;
    process.stdout.write(`\r   Inserat: ${inserted}/${rows.length}`);
  }
  console.log('');

  // 6. Raport
  const kindDist: Record<string, number> = {};
  let withSubtopic = 0;
  let withSubPoints = 0;
  for (const r of rows) {
    kindDist[r.kind] = (kindDist[r.kind] ?? 0) + 1;
    if (r.subtopic) withSubtopic++;
    if (r.sub_points.length > 0) withSubPoints++;
  }

  console.log('\n──────── RAPORT PROMOVARE — clasa ' + grade + ' ────────');
  console.log(`Propuneri citite:              ${proposals.length}`);
  console.log(`Concepte inserate în concepts: ${inserted}`);
  console.log('\nDistribuție kind:');
  for (const [k, n] of Object.entries(kindDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${n}`);
  }
  console.log(`Cu subtopic rezolvat:  ${withSubtopic} / ${inserted}  ·  cu sub_points: ${withSubPoints}  ·  coliziuni slug: ${slugCollisions}`);

  // 7. Verificare DB reală per clasă — count din Supabase (nu din variabila locală).
  const { count, error: cntErr } = await supabase
    .from('concepts')
    .select('*', { count: 'exact', head: true })
    .eq('grade_level', grade);
  if (cntErr) throw new Error(`SELECT COUNT concepts cls ${grade}: ${cntErr.message}`);
  const dbCount = count ?? -1;
  console.log(`🔍 DB: count(concepts WHERE grade_level=${grade}) = ${dbCount} (propuneri: ${proposals.length}, inserat: ${inserted})`);
  if (dbCount !== inserted || dbCount !== proposals.length) {
    throw new Error(`DISCREPANȚĂ clasa ${grade}: propuneri=${proposals.length}, inserat=${inserted}, DB=${dbCount}.`);
  }

  return { grade, proposals: proposals.length, inserted, dbCount };
}

// ── Parse --grades ("1-11" | "1,2,5" | mixt) ─────────────────────────────────
function parseGrades(spec: string | undefined, fallback: number): number[] {
  if (!spec) return [fallback];
  const set = new Set<number>();
  for (const tokRaw of spec.split(',')) {
    const tok = tokRaw.trim();
    if (!tok) continue;
    const m = tok.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { let a = +m[1], b = +m[2]; if (a > b) [a, b] = [b, a]; for (let g = a; g <= b; g++) set.add(g); }
    else if (/^\d+$/.test(tok)) set.add(+tok);
    else throw new Error(`Token --grades invalid: "${tok}"`);
  }
  const grades = [...set].filter((g) => g >= 1 && g <= 12).sort((a, b) => a - b);
  if (grades.length === 0) throw new Error('--grades nu conține nicio clasă validă (1..12).');
  return grades;
}

// ── Verificare finală cross-class din DB reală ───────────────────────────────
const EXPECTED_TOTAL = 1606; // 1364 (clasele 1-11) + 242 (clasa 12)

async function verifyFinal(supabase: Db): Promise<boolean> {
  console.log('\n════════════ VERIFICARE FINALĂ (din DB reală) ════════════');
  let ok = true;
  let sum = 0;
  for (let g = 1; g <= 12; g++) {
    const [{ count: cConcepts }, { count: cProps }] = await Promise.all([
      supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('grade_level', g),
      supabase.from('concept_dedup_proposals').select('*', { count: 'exact', head: true }).eq('grade', g),
    ]);
    const cc = cConcepts ?? 0;
    const cp = cProps ?? 0;
    sum += cc;
    const match = cc === cp;
    if (!match) ok = false;
    console.log(`  ${match ? '✅' : '❌'} Clasa ${String(g).padStart(2)} · concepts=${String(cc).padStart(3)} · proposals=${String(cp).padStart(3)}` +
      (match ? '' : '  ← NU SE POTRIVEȘTE'));
  }
  const { count: total } = await supabase.from('concepts').select('*', { count: 'exact', head: true });
  const grandTotal = total ?? sum;
  console.log(`  ── TOTAL concepts = ${grandTotal}  (așteptat ${EXPECTED_TOTAL}) ──`);
  if (grandTotal !== EXPECTED_TOTAL) {
    console.error(`  ❌ TOTAL ${grandTotal} ≠ ${EXPECTED_TOTAL} așteptat.`);
    ok = false;
  }
  return ok;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({ options: { grade: { type: 'string' }, grades: { type: 'string' } } });
  const grades = values.grades
    ? parseGrades(values.grades, DEFAULT_GRADE)
    : [values.grade ? parseInt(values.grade, 10) : DEFAULT_GRADE];
  for (const g of grades) {
    if (!Number.isInteger(g) || g < 1 || g > 12) {
      console.error(`❌ clasă invalidă: ${g} (trebuie 1-12)`);
      process.exit(1);
    }
  }
  if (grades.includes(12)) {
    console.error('❌ Refuz să ating clasa 12 (deja promovată și validată). Rulează doar pe 1-11.');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = makeClient(supabaseUrl, serviceKey);

  console.log(`🎯 Promovare concepte pentru clasele: [${grades.join(', ')}]  (clasa 12 NU e atinsă)`);
  const results: PromoteResult[] = [];
  for (const g of grades) {
    results.push(await promoteGrade(supabase, g));
  }

  const allOk = await verifyFinal(supabase);
  if (!allOk) {
    console.error('\n💥 VERIFICARE EȘUATĂ — NU raportez „gata". Investighează discrepanțele de mai sus.');
    process.exit(1);
  }
  console.log('\n🎉 GATA: clasele 1-11 promovate, per-clasă = propuneri, total = ' + EXPECTED_TOTAL +
    '. solution_methods / diagnostic_exercises / clasa 12: neatinse.');
}

main().catch((err: unknown) => {
  console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err);
  process.exit(1);
});
