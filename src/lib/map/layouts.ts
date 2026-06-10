/**
 * layouts.ts — ETAPA 71 B1: layout-urile PRECOMPUTATE ale hărții (dagre la
 * build, JSON static per domeniu — vezi scripts/etapa71/build-map-layouts.ts).
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
  prereqs: Array<{ id: string; slug: string; name: string }>;
}

export interface MapLayout {
  module: string;
  label: string;
  width: number;
  height: number;
  nodes: MapLayoutNode[];
  edges: Array<{ from: string; to: string }>;
}

export const MAP_LAYOUTS: Record<DomainColor['key'], MapLayout> = {
  i: layoutI as MapLayout,
  ii: layoutII as MapLayout,
  iii: layoutIII as MapLayout,
  iv: layoutIV as MapLayout,
  v: layoutV as MapLayout,
  vi: layoutVI as MapLayout,
  viii: layoutVIII as MapLayout,
};

// ETAPA 71 FAZA D: slug → cheia domeniului (pentru culoarea care curge prin
// sait). DOAR server-side — JSON-urile de layout nu intră în bundle-ul client.
let slugToDomain: Map<string, DomainColor['key']> | null = null;
export function domainKeyForSlug(slug: string): DomainColor['key'] | null {
  if (!slugToDomain) {
    slugToDomain = new Map();
    for (const [key, layout] of Object.entries(MAP_LAYOUTS) as Array<[DomainColor['key'], MapLayout]>) {
      for (const n of layout.nodes) {
        if (!slugToDomain.has(n.slug)) slugToDomain.set(n.slug, key);
      }
    }
  }
  return slugToDomain.get(slug) ?? null;
}
