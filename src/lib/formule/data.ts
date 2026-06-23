/**
 * data.ts — ETAPA 83 FAZA I: asamblează foaia de formule a unei clase din
 * lecțiile canonice (R5: doar formule deja verificate, zero inventate) + statusul.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildFormulaSheet, type ConceptFormulas, type FormulaSheet } from './sheet';

const GRADE_LABEL: Record<number, string> = {
  9: 'Clasa a 9-a', 10: 'Clasa a 10-a', 11: 'Clasa a 11-a', 12: 'Clasa a 12-a',
};

export interface FormulaSheetResult {
  sheet: FormulaSheet;
  sheetKey: string;
  status: 'de_revizuit' | 'verificat';
  approvedBy: string | null;
}

type Block = { formula?: unknown };

export async function getFormulaSheet(svc: SupabaseClient, grade: number): Promise<FormulaSheetResult> {
  const sheetKey = `grade-${grade}`;
  const title = `Formular — ${GRADE_LABEL[grade] ?? `Clasa ${grade}`}`;

  // conceptele clasei care au lecție canonică (sursa formulelor)
  const { data: concepts } = await svc
    .from('concepts')
    .select('id, slug, name')
    .eq('grade_level', grade)
    .order('order_in_grade', { ascending: true });
  const byId = new Map((concepts ?? []).map((c) => [c.id as string, { slug: c.slug as string, name: c.name as string }]));

  const ids = [...byId.keys()];
  const conceptFormulas: ConceptFormulas[] = [];
  if (ids.length > 0) {
    const { data: lessons } = await svc
      .from('lesson_canonical')
      .select('concept_id, blocks')
      .in('concept_id', ids);
    // ultima versiune per concept e suficientă: colapsăm pe concept_id
    const formulasByConcept = new Map<string, string[]>();
    for (const row of lessons ?? []) {
      const cid = row.concept_id as string;
      const blocks = Array.isArray(row.blocks) ? (row.blocks as Block[]) : [];
      const fs = blocks
        .map((b) => (typeof b.formula === 'string' ? b.formula : ''))
        .filter((f) => f.trim().length > 0);
      if (fs.length === 0) continue;
      const prev = formulasByConcept.get(cid) ?? [];
      formulasByConcept.set(cid, [...prev, ...fs]);
    }
    for (const [cid, info] of byId) {
      const fs = formulasByConcept.get(cid);
      if (fs && fs.length) conceptFormulas.push({ slug: info.slug, name: info.name, formulas: fs });
    }
  }

  const sheet = buildFormulaSheet(title, conceptFormulas);

  const { data: st } = await svc
    .from('formula_sheets')
    .select('status, approved_by')
    .eq('sheet_key', sheetKey)
    .maybeSingle();

  return {
    sheet,
    sheetKey,
    status: ((st as { status?: string } | null)?.status as 'de_revizuit' | 'verificat') ?? 'de_revizuit',
    approvedBy: (st as { approved_by?: string } | null)?.approved_by ?? null,
  };
}
