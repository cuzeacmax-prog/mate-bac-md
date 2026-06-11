/**
 * layouts.ts — ETAPA 71 B1 → ETAPA 76 C: layout-urile PRECOMPUTATE ale hărții
 * (dagre la build, JSON static per domeniu — scripts/etapa71/build-map-layouts.ts).
 * v2: layout per DOMENIU × CLASĂ (grades) — selectorul de clasă comută instant,
 * clasele fără noduri pe domeniu nu există în JSON (selector dezactivat onest).
 * Browserul nu calculează nimic; serverul doar le citește.
 */
import type { DomainColor } from './domain-colors';
import layoutI from './layouts/i.json';
import layoutII from './layouts/ii.json';
import layoutIII from './layouts/iii.json';
import layoutIV from './layouts/iv.json';
import layoutV from './layouts/v.json';
import layoutVI from './layouts/vi.json';
import layoutVIII from './layouts/viii.json';

export interface MapLayoutNode {
  id: string;
  slug: string;
  name: string;
  grade: number | null;
  x: number;
  y: number;
  servable: number;
  /** ETAPA 76 C2: prereq-urile cară și clasa — portalurile cross-grade */
  prereqs: Array<{ id: string; slug: string; name: string; grade: number | null }>;
}

export interface MapGradeLayout {
  width: number;
  height: number;
  nodes: MapLayoutNode[];
  edges: Array<{ from: string; to: string }>;
}

export interface MapLayout {
  module: string;
  label: string;
  /** cheia = clasa ('10' | '11' | '12'); doar clasele CU noduri există */
  grades: Record<string, MapGradeLayout>;
}

export const MAP_LAYOUTS: Record<DomainColor['key'], MapLayout> = {
  i: layoutI as unknown as MapLayout,
  ii: layoutII as unknown as MapLayout,
  iii: layoutIII as unknown as MapLayout,
  iv: layoutIV as unknown as MapLayout,
  v: layoutV as unknown as MapLayout,
  vi: layoutVI as unknown as MapLayout,
  viii: layoutVIII as unknown as MapLayout,
};

// ETAPA 71 FAZA D: slug → cheia domeniului (pentru culoarea care curge prin
// sait). DOAR server-side — JSON-urile de layout nu intră în bundle-ul client.
let slugToDomain: Map<string, DomainColor['key']> | null = null;
export function domainKeyForSlug(slug: string): DomainColor['key'] | null {
  if (!slugToDomain) {
    slugToDomain = new Map();
    for (const [key, layout] of Object.entries(MAP_LAYOUTS) as Array<[DomainColor['key'], MapLayout]>) {
      for (const gradeLayout of Object.values(layout.grades)) {
        for (const n of gradeLayout.nodes) {
          if (!slugToDomain.has(n.slug)) slugToDomain.set(n.slug, key);
        }
      }
    }
  }
  return slugToDomain.get(slug) ?? null;
}

/** ETAPA 76 C2: slug → {domeniu, clasă} — ținta portalurilor cross-grade */
let slugToPlace: Map<string, { domain: DomainColor['key']; grade: number }> | null = null;
export function placeForSlug(slug: string): { domain: DomainColor['key']; grade: number } | null {
  if (!slugToPlace) {
    slugToPlace = new Map();
    for (const [key, layout] of Object.entries(MAP_LAYOUTS) as Array<[DomainColor['key'], MapLayout]>) {
      for (const [grade, gradeLayout] of Object.entries(layout.grades)) {
        for (const n of gradeLayout.nodes) {
          if (!slugToPlace.has(n.slug)) slugToPlace.set(n.slug, { domain: key, grade: Number(grade) });
        }
      }
    }
  }
  return slugToPlace.get(slug) ?? null;
}
