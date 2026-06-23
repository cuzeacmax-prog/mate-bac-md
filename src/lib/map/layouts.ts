/**
 * layouts.ts — ETAPA 71 B1 → 76 C → **ETAPA 84 B**: layout-urile PRECOMPUTATE ale hărții.
 *
 * ETAPA 84: sursa s-a mutat de la cele 7 domenii BAC (concept_family_membership) la
 * `concepts` grupate per CLASĂ (module ?? subtopic ?? „Altele"). Fișiere per clasă:
 * `layouts/grade-<g>.json` = { grade, groups: [{ key, label, width, height, nodes, edges }] }.
 * Browserul nu calculează nimic; serverul doar citește (perf 72 sacru).
 */
import g9 from './layouts/grade-9.json';
import g10 from './layouts/grade-10.json';
import g11 from './layouts/grade-11.json';
import g12 from './layouts/grade-12.json';

export interface MapLayoutNode {
  id: string;
  slug: string;
  name: string;
  grade: number | null;
  x: number;
  y: number;
  servable: number;
  /** prereq-urile cară și clasa — portalurile cross-grade */
  prereqs: Array<{ id: string; slug: string; name: string; grade: number | null }>;
}

export interface MapGroup {
  /** cheie stabilă unică între clase (ex. „g11:functia-radical") */
  key: string;
  /** eticheta umană (modul sau subtopic) */
  label: string;
  grade: number;
  width: number;
  height: number;
  nodes: MapLayoutNode[];
  edges: Array<{ from: string; to: string }>;
}

interface GradeFile { grade: number; groups: Array<Omit<MapGroup, 'grade'>> }

function withGrade(f: unknown): MapGroup[] {
  const gf = f as GradeFile;
  return (gf.groups ?? []).map((g) => ({ ...g, grade: gf.grade }));
}

/** grupurile hărții, per clasă (9-12) — TOATE conceptele clasei. */
export const GRADE_GROUPS: Record<number, MapGroup[]> = {
  9: withGrade(g9),
  10: withGrade(g10),
  11: withGrade(g11),
  12: withGrade(g12),
};

/** toate grupurile, indiferent de clasă (pentru hărți complete + căutări de loc). */
export const ALL_GROUPS: MapGroup[] = Object.values(GRADE_GROUPS).flat();

/** slug → {grupul (domain), clasa} — ținta portalurilor cross-grade */
let slugToPlace: Map<string, { domain: string; grade: number }> | null = null;
export function placeForSlug(slug: string): { domain: string; grade: number } | null {
  if (!slugToPlace) {
    slugToPlace = new Map();
    for (const g of ALL_GROUPS) {
      for (const n of g.nodes) {
        if (!slugToPlace.has(n.slug)) slugToPlace.set(n.slug, { domain: g.key, grade: g.grade });
      }
    }
  }
  return slugToPlace.get(slug) ?? null;
}

/**
 * ETAPA 84: modelul celor 7 domenii BAC colorate a fost înlocuit cu grupuri per clasă
 * (culoarea vine din mastery + tentă, nu dintr-un token fix). Păstrat pentru
 * compatibilitate cu azi/chat (care cad pe culoarea primară când e null).
 */
export function domainKeyForSlug(_slug?: string): null {
  return null;
}
