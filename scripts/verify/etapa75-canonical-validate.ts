/**
 * ETAPA 75 B2 — POARTA ANTI-FABRICAȚIE pe TOT ce e persistat în lesson_canonical.
 *
 * Re-verifică fiecare lecție împotriva DB-ului de ACUM (nu a celui de la
 * generare): fiecare exercise_id referit (în blocks SAU în surse) trebuie să
 * existe și să fie SERVIBIL; theory_slug trebuie să fie în registru; structura
 * canonică respectată. Lecție cu referință inexistentă = listată ca defect
 * (de respins/regenerat — nu se servește orbește).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa75-canonical-validate.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { validateCanonicalBlocks } from '../../src/lib/lesson/canonical';

async function main() {
  const svc = createServiceClient();
  const { data: servable } = await svc.from('exercise_servable').select('exercise_id');
  const servableSet = new Set((servable ?? []).map((s) => s.exercise_id as string));

  const { data: lessons, error } = await svc
    .from('lesson_canonical')
    .select('id, version, status, blocks, surse, concepts(slug)');
  if (error) throw new Error(error.message);

  let ok = 0;
  const bad: string[] = [];
  for (const l of lessons ?? []) {
    const slug = (l.concepts as unknown as { slug: string } | null)?.slug ?? '(?)';
    const surse = l.surse as { exercise_ids?: string[]; theory_figure?: string | null };
    // sursele declarate trebuie să fie azi servibile
    const deadSources = (surse.exercise_ids ?? []).filter((id) => !servableSet.has(id));
    // blocurile se re-validează cu pool-ul DE ACUM
    const result = validateCanonicalBlocks(l.blocks as unknown[], {
      servableExerciseIds: new Set((surse.exercise_ids ?? []).filter((id) => servableSet.has(id))),
      theorySlug: surse.theory_figure ?? null,
    });
    if (deadSources.length > 0 || !result.ok) {
      const errs = [
        ...deadSources.map((id) => `sursă ne-servibilă: ${id}`),
        ...(result.ok ? [] : result.errors),
      ];
      bad.push(`${slug} v${l.version} [${l.status}]: ${errs.slice(0, 3).join('; ')}`);
    } else {
      ok++;
    }
  }

  console.log(`\n══ VALIDAREA LECȚIILOR CANONICE ══`);
  console.log(`valide: ${ok}/${(lessons ?? []).length}`);
  if (bad.length > 0) {
    console.log('\nDEFECTE (de regenerat sau de scos din servire):');
    for (const b of bad) console.log(`  ✗ ${b}`);
    process.exitCode = 2;
  } else {
    console.log('✅ toate referințele există în pool-ul servibil; structura respectată.');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
