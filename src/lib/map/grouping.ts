/**
 * grouping.ts — ETAPA 84 FAZA B: gruparea robustă a conceptelor pe hartă.
 *
 * Defectul reparat: harta se construia din concept_family_membership (7 domenii BAC,
 * ~120 concepte) → clasa 11 arăta „1 temă". Acum harta se construiește din `concepts`,
 * grupate robust: `module` unde există, altfel `subtopic`, altfel „Altele" — ca FIECARE
 * concept al clasei să apară. Determinist, fără a inventa module (R5).
 */

export function conceptGroupLabel(c: { module: string | null; subtopic: string | null }): string {
  const m = (c.module ?? '').trim();
  if (m) return m;
  const s = (c.subtopic ?? '').trim();
  if (s) return s;
  return 'Altele';
}

/** cheie stabilă, slug-safe, prefixată pe clasă (unică între clase). */
export function groupKeyFor(grade: number, label: string): string {
  const slug = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `g${grade}:${slug || 'grup'}`;
}
