/**
 * verify:milestones — ETAPA 71 A1: poarta bornelor.
 *  1. Fiecare slug din CONCEPT_MILESTONES există în graf (concepts).
 *  2. Fiecare concept din domeniile hărții care ARE exerciții servibile
 *     are bornă (nimic cu conținut nu rămâne fără bornă).
 *
 *   npx tsx --env-file=.env.local scripts/verify/milestones.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { CONCEPT_MILESTONES } from '../../src/lib/map/milestones';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const slugs = Object.keys(CONCEPT_MILESTONES);
  if (slugs.length === 0) fail('CONCEPT_MILESTONES e gol');

  // 1) toate slug-urile există în graf
  const found = new Set<string>();
  for (let i = 0; i < slugs.length; i += 200) {
    const { data, error } = await svc.from('concepts').select('slug').in('slug', slugs.slice(i, i + 200));
    if (error) fail(`concepts lookup: ${error.message}`);
    for (const r of data ?? []) found.add(r.slug as string);
  }
  const missing = slugs.filter((s) => !found.has(s));
  if (missing.length > 0) fail(`slug-uri inexistente în graf: ${missing.join(', ')}`);
  console.log(`✓ toate cele ${slugs.length} slug-uri din borne există în concepts`);

  // 2) conceptele cu conținut servibil din domeniile hărții au bornă
  const { data: serv } = await svc.from('exercise_servable').select('exercise_id').limit(20000);
  const servIds = new Set((serv ?? []).map((s) => s.exercise_id as string));
  const servableSlugs = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data: links } = await svc
      .from('exercise_concept_link')
      .select('exercise_id, concepts(slug)')
      .range(from, from + 999);
    for (const l of links ?? []) {
      const slug = (l.concepts as unknown as { slug: string } | null)?.slug;
      if (slug && servIds.has(l.exercise_id as string)) servableSlugs.add(slug);
    }
    if (!links || links.length < 1000) break;
  }
  const { data: membership } = await svc
    .from('concept_family_membership')
    .select('concepts(slug)')
    .limit(2000);
  const mapSlugs = new Set(
    (membership ?? []).map((m) => (m.concepts as unknown as { slug: string } | null)?.slug).filter(Boolean) as string[]
  );
  const unbound = [...servableSlugs].filter((s) => mapSlugs.has(s) && !(s in CONCEPT_MILESTONES));
  if (unbound.length > 0) fail(`concepte cu conținut servibil FĂRĂ bornă: ${unbound.join(', ')}`);
  console.log(`✓ toate conceptele cu conținut servibil din domeniile hărții au bornă (${[...servableSlugs].filter((s) => mapSlugs.has(s)).length})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
