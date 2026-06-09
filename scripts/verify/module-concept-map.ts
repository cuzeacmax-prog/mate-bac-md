/**
 * ETAPA 61 PAS 1 — POARTA hărții modul→familii.
 * Fiecare slug-rădăcină există în concepts; fiecare modul din exercise_raw
 * are intrare în hartă. Orice lipsă = exit 1.
 *   npx tsx --env-file=.env.local scripts/verify/module-concept-map.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { MODULE_CONCEPT_ROOTS, allRootSlugs } from '../../src/lib/library/module-concept-map';

async function main() {
  const svc = createServiceClient();
  let fail = false;

  const slugs = allRootSlugs();
  const { data: found, error } = await svc.from('concepts').select('slug').in('slug', slugs);
  if (error) { console.error(error.message); process.exit(1); }
  const foundSet = new Set((found ?? []).map((r) => r.slug as string));
  const missing = slugs.filter((s) => !foundSet.has(s));
  if (missing.length) {
    console.error(`✗ slug-uri rădăcină inexistente în concepts: ${missing.join(', ')}`);
    fail = true;
  } else {
    console.log(`✓ toate cele ${slugs.length} slug-uri rădăcină există în concepts`);
  }

  const { data: mods, error: mErr } = await svc.from('exercise_raw').select('module');
  if (mErr) { console.error(mErr.message); process.exit(1); }
  const distinct = [...new Set((mods ?? []).map((r) => r.module as string))];
  const unmapped = distinct.filter((m) => !(m in MODULE_CONCEPT_ROOTS));
  if (unmapped.length) {
    console.error(`✗ module din exercise_raw fără intrare în hartă: ${unmapped.join(', ')}`);
    fail = true;
  } else {
    console.log(`✓ toate cele ${distinct.length} module din exercise_raw au familie definită`);
  }

  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
