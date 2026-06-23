/**
 * sheet.ts — ETAPA 83 FAZA I: foaia de formule per temă/simulare.
 *
 * R5 (absolut): formulele se CONSTRUIESC din conținutul canonic deja verificat
 * (blocurile lecțiilor canonice — câmpul `formula`), NU se inventează. Acest modul
 * doar selectează + deduplică ce există. Servabil determinist, cost ~0.
 */

export interface ConceptFormulas {
  slug: string;
  name: string;
  formulas: string[];
}
export interface FormulaSection {
  slug: string;
  name: string;
  formulas: string[];
}
export interface FormulaSheet {
  title: string;
  sections: FormulaSection[];
  count: number;
}

/** cheie de echivalență: colapsează variante LaTeX identice ca matematică */
function normKey(f: string): string {
  return f
    .replace(/\s+/g, '')
    .replace(/\\dfrac/g, '\\frac')
    .replace(/\\tfrac/g, '\\frac')
    .replace(/\\mathscr/g, '\\mathcal')
    .replace(/\\mathrm\{d\}/g, 'd')
    .replace(/\\,/g, '')
    .replace(/\\!/g, '')
    .replace(/\\(bigg?|Bigg?)/g, '')
    .replace(/\\left|\\right/g, '');
}

/** elimină duplicatele (echivalente), păstrând prima formă (cea mai bogată). */
export function dedupFormulas(formulas: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of formulas) {
    const t = raw.trim();
    if (!t) continue;
    const k = normKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Construiește foaia: grupează pe concept, deduplică, elimină secțiunile goale. */
export function buildFormulaSheet(title: string, concepts: ConceptFormulas[]): FormulaSheet {
  const sections = concepts
    .map((c) => ({ slug: c.slug, name: c.name, formulas: dedupFormulas(c.formulas) }))
    .filter((s) => s.formulas.length > 0);
  return { title, sections, count: sections.reduce((a, s) => a + s.formulas.length, 0) };
}
