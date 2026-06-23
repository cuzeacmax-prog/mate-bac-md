/**
 * match-curriculum.ts — ETAPA 83 A2/A4: rulează matcher-ul onest pe conceptele
 * reale (clasele 9-12) și raportează. DRY by default (doar raport, zero scrieri).
 *   APPLY_QUEUE=1 → populează tabelul curriculum_proposals (coada /admin/curriculum).
 *
 *   npx tsx --env-file=.env.local scripts/etapa83/match-curriculum.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServiceClient } from '../../src/lib/supabase/service';
import { buildClassIndex, matchConcept, type ClassCuprins, type ConceptLite } from '../../src/lib/curriculum/match';

async function main() {
  const curriculum = JSON.parse(
    readFileSync(join(process.cwd(), 'docs/manuale-source/curriculum-cuprins.json'), 'utf8')
  ) as ClassCuprins[];
  // marcăm explicit modulele de recapitulare (clasa 12) ca recap
  for (const c of curriculum) {
    for (const m of c.modules) {
      if (/recapitulare\s+final[aă]|recapitulare$/i.test(m.title)) m.isRecap = true;
    }
  }
  const index = buildClassIndex(curriculum);

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('concepts')
    .select('id, slug, name, grade_level')
    .in('grade_level', [9, 10, 11, 12])
    .order('grade_level');
  if (error) throw new Error(error.message);
  const concepts = (data ?? []) as Array<ConceptLite & { id: string }>;

  let firm = 0, firmChange = 0, nesigur = 0, faraClasa = 0;
  const byGradeBefore: Record<number, number> = { 9: 0, 10: 0, 11: 0, 12: 0 };
  const byGradeAfter: Record<number, number> = { 9: 0, 10: 0, 11: 0, 12: 0 };
  const changes: Array<{ slug: string; from: number | null; to: number | null; source: string | null }> = [];
  const proposals: Array<Record<string, unknown>> = [];

  for (const c of concepts) {
    if (c.grade_level == null) faraClasa++;
    else byGradeBefore[c.grade_level]++;
    const r = matchConcept(c, index);
    if (r.confidence === 'firm') {
      firm++;
      const dest = r.proposedGrade ?? c.grade_level;
      if (dest != null) byGradeAfter[dest]++;
      if (r.isChange) {
        firmChange++;
        changes.push({ slug: c.slug, from: c.grade_level, to: r.proposedGrade, source: r.source });
      }
    } else {
      nesigur++;
      if (c.grade_level != null) byGradeAfter[c.grade_level]++; // nesigur → rămâne pe clasa curentă
    }
    proposals.push({
      concept_id: c.id,
      concept_slug: c.slug,
      concept_name: c.name,
      current_grade: c.grade_level,
      proposed_grade: r.proposedGrade,
      confidence: r.confidence,
      source: r.source,
      reason: r.reason,
      candidates: r.candidates,
      status: 'pending',
    });
  }

  console.log('── ETAPA 83 A4: raport mapare concept→clasă (din manuale) ──');
  console.log(`Concepte (clasele 9-12): ${concepts.length}`);
  console.log(`  ferme: ${firm} (din care SCHIMBĂRI de clasă: ${firmChange})`);
  console.log(`  nesigure (pentru ochii lui Maxim): ${nesigur}`);
  console.log(`  fără clasă inițială: ${faraClasa}`);
  console.log('Distribuție ÎNAINTE:', JSON.stringify(byGradeBefore));
  console.log('Distribuție DUPĂ (doar ferme aplicate):', JSON.stringify(byGradeAfter));
  console.log(`\nPrimele ${Math.min(25, changes.length)} schimbări ferme propuse:`);
  for (const ch of changes.slice(0, 25)) {
    console.log(`  ${ch.slug}: ${ch.from} → ${ch.to}  [${ch.source ?? '—'}]`);
  }
  if (changes.length > 25) console.log(`  …și încă ${changes.length - 25}`);

  if (process.env.APPLY_QUEUE === '1') {
    console.log('\nAPPLY_QUEUE=1 → populez curriculum_proposals…');
    // upsert pe concept_id (idempotent); păstrăm decizia ownerului dacă deja există
    const { error: delErr } = await svc.from('curriculum_proposals').delete().eq('status', 'pending');
    if (delErr) throw new Error(`curăț pending: ${delErr.message} (tabelul există?)`);
    for (let i = 0; i < proposals.length; i += 200) {
      const batch = proposals.slice(i, i + 200);
      const { error: insErr } = await svc.from('curriculum_proposals').upsert(batch, { onConflict: 'concept_id' });
      if (insErr) throw new Error(`upsert proposals: ${insErr.message}`);
    }
    const { count } = await svc.from('curriculum_proposals').select('id', { count: 'exact', head: true });
    console.log(`✅ curriculum_proposals populat: ${count} rânduri.`);
  } else {
    console.log('\n(DRY — rulează cu APPLY_QUEUE=1 ca să populezi coada /admin/curriculum)');
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
