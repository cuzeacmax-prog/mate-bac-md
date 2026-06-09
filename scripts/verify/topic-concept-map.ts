/**
 * ETAPA 60 PAS 2 — POARTA mapării topic→concept.
 * Verifică contra DB că FIECARE slug din TOPIC_CONCEPT_MAP există în `concepts`
 * și că fiecare topic din diagnostic_exercises e fie mapat, fie explicit NEMAPAT.
 * Slug inexistent sau topic uitat = exit 1 (rupe pipeline-ul, nu tace).
 *   npx tsx --env-file=.env.local scripts/verify/topic-concept-map.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { TOPIC_CONCEPT_MAP, TOPICE_NEMAPATE } from '../../src/lib/diagnostic/topic-concept-map';

async function main() {
  const svc = createServiceClient();
  let fail = false;

  // 1) fiecare slug din mapă există în concepts
  const allSlugs = [...new Set(Object.values(TOPIC_CONCEPT_MAP).flat())];
  const { data: found, error } = await svc.from('concepts').select('slug').in('slug', allSlugs);
  if (error) { console.error('Query concepts a eșuat:', error.message); process.exit(1); }
  const foundSet = new Set((found ?? []).map((r) => r.slug as string));
  const missing = allSlugs.filter((s) => !foundSet.has(s));
  if (missing.length > 0) {
    console.error(`✗ ${missing.length} slug-uri din mapă NU există în concepts:`);
    missing.forEach((s) => console.error('   ' + s));
    fail = true;
  } else {
    console.log(`✓ toate cele ${allSlugs.length} slug-uri din mapă există în concepts`);
  }

  // 2) fiecare topic din diagnostic_exercises e mapat sau explicit NEMAPAT
  const { data: topics, error: tErr } = await svc.from('diagnostic_exercises').select('topic_id');
  if (tErr) { console.error('Query diagnostic_exercises a eșuat:', tErr.message); process.exit(1); }
  const distinct = [...new Set((topics ?? []).map((r) => r.topic_id as string))];
  const unhandled = distinct.filter((t) => !(t in TOPIC_CONCEPT_MAP) && !TOPICE_NEMAPATE.includes(t));
  if (unhandled.length > 0) {
    console.error(`✗ topice din DB nici mapate, nici marcate NEMAPAT: ${unhandled.join(', ')}`);
    fail = true;
  } else {
    console.log(`✓ toate cele ${distinct.length} topice din DB sunt acoperite (${TOPICE_NEMAPATE.length} NEMAPATE explicit)`);
  }

  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
