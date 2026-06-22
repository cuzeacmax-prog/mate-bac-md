/**
 * per-class.ts — ETAPA 82 FAZA B: filtrarea hărții la clasa elevului.
 *
 * Defectul central: harta arăta toate temele posibile (selectorul de clasă urca
 * automat la clasa cu noduri). Aici izolăm logica deterministă de „ce clase și
 * câte teme" — folosită ȘI de MapView (UI), ȘI de scriptul de acceptanță
 * (dovada numărată: noduri afișate vs total graf).
 */
import type { KnowledgeMap } from './state';

type MapLike = Pick<KnowledgeMap, 'domains'>;

/** Cheile domeniilor care AU conținut pe clasa dată. */
export function domainsForGrade(map: MapLike, grade: number): string[] {
  return map.domains.filter((d) => d.grades[String(grade)]).map((d) => d.key);
}

/** Numărul de noduri afișate pe o clasă (peste toate domeniile). */
export function nodesForGrade(map: MapLike, grade: number): number {
  return map.domains.reduce(
    (a, d) => a + (d.grades[String(grade)]?.nodes.length ?? 0),
    0
  );
}

/** Totalul de noduri din tot graful (toate clasele, toate domeniile). */
export function graphTotalNodes(map: MapLike): number {
  return map.domains.reduce(
    (a, d) => a + Object.values(d.grades).reduce((b, s) => b + s.nodes.length, 0),
    0
  );
}

/** Clasele care există undeva în graf (pentru activarea pill-urilor), sortate. */
export function gradesWithContent(map: MapLike): number[] {
  const s = new Set<number>();
  for (const d of map.domains) for (const g of Object.keys(d.grades)) s.add(Number(g));
  return [...s].sort((a, b) => a - b);
}
