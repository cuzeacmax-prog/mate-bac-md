/**
 * ETAPA 78 FAZA E — ACCEPTANȚĂ EXERCIȚII:
 *   R5: biblioteca servește DOAR exerciții din exercise_servable (verificat /
 *   sursă-oficială) — niciodată restul; filtrele domeniu/clasă/dificultate
 *   întorc doar ce promit; căutarea e insensibilă la diacritice; exercițiul
 *   ales e PRE-ÎNCĂRCAT primul în ancora de concept (firul către chat).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa78-exercitii-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { filterExercises, listServableExercises } from '../../src/lib/exercitii/data';
import { getConceptAnchor } from '../../src/lib/concepts/anchor';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const all = await listServableExercises(svc);
  if (all.length < 100) fail(`biblioteca pare goală: ${all.length} exerciții (așteptat sute)`);

  // R5: fiecare exercițiu listat E în exercise_servable (verificare pe DB, nu pe cod)
  const { data: servable } = await svc.from('exercise_servable').select('exercise_id');
  const servableSet = new Set((servable ?? []).map((s) => s.exercise_id as string));
  const leaked = all.filter((r) => !servableSet.has(r.id));
  if (leaked.length > 0) fail(`R5 RUPT: ${leaked.length} exerciții ne-servibile în bibliotecă`);
  console.log(`  ✓ R5: toate cele ${all.length} exerciții listate sunt servibile (din ${servableSet.size} în view; diferența = enunțuri nerandabile excluse onest)`);

  const tiers = new Set(all.map((r) => r.tier));
  if (![...tiers].every((t) => t === 'verificat' || t === 'sursa-oficiala')) fail(`tier necunoscut: ${[...tiers]}`);
  console.log(`  ✓ badge-uri sursă: ${all.filter((r) => r.tier === 'verificat').length} verificate, ${all.filter((r) => r.tier === 'sursa-oficiala').length} din culegerea oficială`);
  console.log(`  ✓ figuri: ${all.filter((r) => r.has_figure).length} exerciții cu figură aprinsă`);

  // filtrele
  const dom = all.find((r) => r.domainKey)?.domainKey ?? null;
  if (!dom) fail('niciun exercițiu cu domeniu mapat');
  const byDom = filterExercises(all, { domeniu: dom });
  if (byDom.length === 0 || byDom.some((r) => r.domainKey !== dom)) fail(`filtrul de domeniu '${dom}' minte`);
  console.log(`  ✓ filtru domeniu '${dom}': ${byDom.length} exerciții, toate din domeniu`);

  const grade = all.find((r) => r.grade_level)?.grade_level ?? null;
  if (grade) {
    const byGrade = filterExercises(all, { clasa: grade });
    if (byGrade.some((r) => r.grade_level !== grade)) fail('filtrul de clasă minte');
    console.log(`  ✓ filtru clasa ${grade}: ${byGrade.length} exerciții`);
  }

  const acc = filterExercises(all, { dificultate: 'accesibil' });
  const adv = filterExercises(all, { dificultate: 'avansat' });
  if (acc.length + adv.length !== all.length) fail('dificultatea nu partiționează biblioteca');
  console.log(`  ✓ dificultate (clasificator determinist): ${acc.length} accesibile + ${adv.length} avansate = ${all.length}`);

  // căutarea fără diacritice: 'primitiva' trebuie să găsească 'primitivă'
  const cu = filterExercises(all, { q: 'primitivă' });
  const fara = filterExercises(all, { q: 'primitiva' });
  if (cu.length === 0) fail('căutarea „primitivă" nu găsește nimic (Modulul I are 100+)');
  if (fara.length !== cu.length) fail(`căutarea cu/fără diacritice diferă: ${cu.length} vs ${fara.length}`);
  console.log(`  ✓ căutare insensibilă la diacritice: „primitivă"=„primitiva"=${cu.length} rezultate`);

  // pre-încărcarea: exercițiul ales e PRIMUL în ancoră — dovada tare cere un
  // exercițiu care NU ar fi fost oricum primul implicit
  let proven = false;
  for (const target of all.filter((r) => r.concept_slug).slice(0, 60)) {
    const slug = target.concept_slug!;
    const anchorDefault = await getConceptAnchor(svc, slug, 2);
    if (!anchorDefault || anchorDefault.exercises[0]?.id === target.id) continue;
    const anchor = await getConceptAnchor(svc, slug, 2, target.id);
    if (anchor?.exercises[0]?.id !== target.id) {
      fail(`exercițiul ales NU e pre-încărcat primul pe '${slug}' (așteptat ${target.id}, primit ${anchor?.exercises[0]?.id})`);
    }
    console.log(`  ✓ pre-încărcare: pe '${anchor.name}' implicitul era ${anchorDefault.exercises[0]?.id.slice(0, 8)}…, pin-ul l-a pus pe ${target.id.slice(0, 8)}… primul`);
    proven = true;
    break;
  }
  if (!proven) fail('niciun caz în care pin-ul să difere de implicit — dovada nu s-a putut face');
  const target = all.find((r) => r.concept_slug)!;

  // pin cu id inexistent → ignorat onest, ancora nu crapă
  const anchorBadPin = await getConceptAnchor(svc, target.concept_slug, 2, '00000000-0000-0000-0000-000000000000');
  if (!anchorBadPin || anchorBadPin.exercises.length === 0) fail('pin invalid a stricat ancora');
  console.log('  ✓ pin invalid → ignorat, ancora servește exercițiile implicite');

  console.log(`\n✅ FAZA E: biblioteca servibilă e navigabilă, R5 ținut, click-ul duce la chat-ul ancorat cu exercițiul pre-încărcat.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
