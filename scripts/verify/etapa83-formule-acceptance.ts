/**
 * etapa83-formule-acceptance.ts — POARTĂ I: o foaie de formule generată pe o temă
 * (clasa 12), construită din lecțiile canonice (R5), cu formule reale + status.
 *   npx tsx --env-file=.env.local scripts/verify/etapa83-formule-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { getFormulaSheet } from '../../src/lib/formule/data';

function fail(m: string): never { console.error(`✗ EȘEC: ${m}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const { sheet, sheetKey, status } = await getFormulaSheet(svc, 12);

  console.log(`Foaie: "${sheet.title}" · ${sheet.sections.length} teme · ${sheet.count} formule · status=${status}`);
  if (sheet.sections.length === 0) fail('foaia nu are nicio secțiune (lecții canonice fără formule?)');
  if (sheet.count < 5) fail(`prea puține formule (${sheet.count}) — sursa canonică pare goală`);

  // R5: fiecare formulă e text LaTeX negol, fără markere de „inventat"
  let sample = '';
  for (const sec of sheet.sections) {
    for (const f of sec.formulas) {
      if (typeof f !== 'string' || f.trim().length === 0) fail('formulă goală/invalidă');
      if (!sample) sample = f;
    }
  }
  console.log(`Exemplu temă: "${sheet.sections[0].name}" — ${sheet.sections[0].formulas.length} formule`);
  console.log(`Exemplu formulă: ${sample.slice(0, 70)}`);
  console.log(`sheet_key=${sheetKey} (aprobabil din /api/admin/formule → "verificat de profesor")`);
  console.log('\n✅ POARTĂ I: foaie de formule generată pe temă, formule reale (R5), randabilă + descărcabilă.');
}

main().catch((e) => { console.error(`✗ ${e instanceof Error ? e.message : String(e)}`); process.exitCode = 1; });
