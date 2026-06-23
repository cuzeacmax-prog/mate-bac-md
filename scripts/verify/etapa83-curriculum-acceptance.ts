/**
 * etapa83-curriculum-acceptance.ts — POARTĂ A: coada funcțională + calea de
 * aplicare (grade_level → harta) demonstrată end-to-end, FĂRĂ a muta curriculumul
 * lui Maxim: aplicăm o schimbare fermă pe un concept, verificăm că grade_level s-a
 * schimbat, apoi REVENIM (net zero). Maxim aplică restul din /admin/curriculum.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa83-curriculum-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';

function fail(m: string): never { console.error(`✗ EȘEC: ${m}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();

  // 1) coada e populată
  const { count, error: cErr } = await svc.from('curriculum_proposals').select('id', { count: 'exact', head: true });
  if (cErr) fail(`coada inaccesibilă: ${cErr.message}`);
  if (!count || count < 100) fail(`coada pare goală (${count}) — rulează match-curriculum.ts cu APPLY_QUEUE=1`);
  console.log(`✓ coada curriculum_proposals: ${count} rânduri`);

  const { count: firmCount } = await svc.from('curriculum_proposals')
    .select('id', { count: 'exact', head: true }).eq('confidence', 'firm');
  const { count: nesigurCount } = await svc.from('curriculum_proposals')
    .select('id', { count: 'exact', head: true }).eq('confidence', 'nesigur');
  console.log(`✓ ferme: ${firmCount} · nesigure: ${nesigurCount}`);

  // 2) calea de aplicare: ia o schimbare fermă pending, aplică, verifică, revino
  const { data: rows, error: rErr } = await svc.from('curriculum_proposals')
    .select('id, concept_id, concept_slug, current_grade, proposed_grade')
    .eq('status', 'pending').eq('confidence', 'firm').limit(50);
  if (rErr) fail(rErr.message);
  const sample = (rows ?? []).find((r) => r.proposed_grade != null && r.proposed_grade !== r.current_grade);
  if (!sample) {
    console.log('⚠ nicio schimbare fermă pending de demonstrat (poate deja aplicate de Maxim) — coada funcțională rămâne validă.');
    console.log('\n✅ POARTĂ A: coada funcțională (populată, ferme/nesigure separate).');
    return;
  }

  const before = sample.current_grade as number;
  const target = sample.proposed_grade as number;
  // aplică
  const { error: upErr } = await svc.from('concepts').update({ grade_level: target }).eq('id', sample.concept_id);
  if (upErr) fail(`apply: ${upErr.message}`);
  const { data: after1 } = await svc.from('concepts').select('grade_level').eq('id', sample.concept_id).single();
  if ((after1 as { grade_level: number } | null)?.grade_level !== target) fail('grade_level nu s-a scris');
  console.log(`✓ aplicare demonstrată: ${sample.concept_slug} ${before} → ${target} (grade_level scris)`);
  // revino (net zero — nu mutăm curriculumul fără decizia lui Maxim)
  const { error: revErr } = await svc.from('concepts').update({ grade_level: before }).eq('id', sample.concept_id);
  if (revErr) fail(`revert: ${revErr.message}`);
  const { data: after2 } = await svc.from('concepts').select('grade_level').eq('id', sample.concept_id).single();
  if ((after2 as { grade_level: number } | null)?.grade_level !== before) fail('revert eșuat');
  console.log(`✓ revenit la ${before} (net zero — Maxim decide din /admin/curriculum)`);

  console.log('\n✅ POARTĂ A: coadă funcțională + cale de aplicare grade_level dovedită (revenită).');
}

main().catch((e) => { console.error(`✗ ${e instanceof Error ? e.message : String(e)}`); process.exitCode = 1; });
