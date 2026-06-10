/**
 * build-map-layouts.ts — ETAPA 71 B1: layout-ul hărții, precomputat.
 *
 * Pentru fiecare domeniu (module-concept-map): subgraful conceptelor familiei
 * + muchiile lor din concept_edges, aranjat cu dagre LA BUILD și persistat ca
 * JSON static (src/lib/map/layouts/<key>.json). Browserul doar randează.
 * În JSON intră și datele STATICE per nod: prereq-urile (id+nume) și numărul
 * de exerciții servibile (se regenerează când se schimbă conținutul).
 *
 *   npx tsx --env-file=.env.local scripts/etapa71/build-map-layouts.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import dagre from '@dagrejs/dagre';
import { createServiceClient } from '../../src/lib/supabase/service';
import { MODULE_DOMAINS } from '../../src/lib/map/domain-colors';

interface LayoutNode {
  id: string;
  slug: string;
  name: string;
  grade: number | null;
  x: number;
  y: number;
  servable: number;
  prereqs: Array<{ id: string; slug: string; name: string }>;
}

async function main() {
  const svc = createServiceClient();

  const { data: membership } = await svc
    .from('concept_family_membership')
    .select('module, concepts(id, slug, name, grade_level)')
    .limit(2000);

  // servabile per concept (id)
  const { data: serv } = await svc.from('exercise_servable').select('exercise_id').limit(20000);
  const servIds = new Set((serv ?? []).map((s) => s.exercise_id as string));
  const servableByConceptId = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data: links } = await svc
      .from('exercise_concept_link')
      .select('exercise_id, concept_id')
      .range(from, from + 999);
    for (const l of links ?? []) {
      if (servIds.has(l.exercise_id as string)) {
        servableByConceptId.set(l.concept_id as string, (servableByConceptId.get(l.concept_id as string) ?? 0) + 1);
      }
    }
    if (!links || links.length < 1000) break;
  }

  // toate muchiile (from=dependent → to=prerechizit), paginat
  const allEdges: Array<{ from: string; to: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data: edges } = await svc.from('concept_edges').select('from_concept, to_concept').range(from, from + 999);
    for (const e of edges ?? []) allEdges.push({ from: e.from_concept as string, to: e.to_concept as string });
    if (!edges || edges.length < 1000) break;
  }
  console.log(`muchii totale în graf: ${allEdges.length}`);

  // numele tuturor conceptelor (pentru prereq-uri din afara domeniului)
  const nameById = new Map<string, { slug: string; name: string }>();
  for (let from = 0; ; from += 1000) {
    const { data: cs } = await svc.from('concepts').select('id, slug, name').range(from, from + 999);
    for (const c of cs ?? []) nameById.set(c.id as string, { slug: c.slug as string, name: c.name as string });
    if (!cs || cs.length < 1000) break;
  }

  const byModule = new Map<string, Array<{ id: string; slug: string; name: string; grade: number | null }>>();
  const seen = new Set<string>();
  for (const m of membership ?? []) {
    const c = m.concepts as unknown as { id: string; slug: string; name: string; grade_level: number | null } | null;
    if (!c || seen.has(`${m.module}|${c.id}`)) continue;
    seen.add(`${m.module}|${c.id}`);
    const arr = byModule.get(m.module as string) ?? [];
    arr.push({ id: c.id, slug: c.slug, name: c.name, grade: c.grade_level });
    byModule.set(m.module as string, arr);
  }

  const outDir = join(process.cwd(), 'src', 'lib', 'map', 'layouts');
  mkdirSync(outDir, { recursive: true });

  for (const [module, domain] of Object.entries(MODULE_DOMAINS)) {
    const nodes = byModule.get(module) ?? [];
    const idSet = new Set(nodes.map((n) => n.id));
    const edges = allEdges.filter((e) => idSet.has(e.from) && idSet.has(e.to));

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 80, marginx: 24, marginy: 24 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of nodes) g.setNode(n.id, { width: 132, height: 72 });
    // dagre: muchia prerechizit → dependent (curge de sus în jos)
    for (const e of edges) g.setEdge(e.to, e.from);
    dagre.layout(g);

    const layoutNodes: LayoutNode[] = nodes.map((n) => {
      const pos = g.node(n.id);
      const prereqs = allEdges
        .filter((e) => e.from === n.id)
        .map((e) => ({ id: e.to, ...(nameById.get(e.to) ?? { slug: '?', name: '?' }) }))
        .slice(0, 8);
      return {
        ...n,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        servable: servableByConceptId.get(n.id) ?? 0,
        prereqs,
      };
    });
    const graphMeta = g.graph();
    const layout = {
      module,
      label: domain.label,
      width: Math.ceil(graphMeta.width ?? 800),
      height: Math.ceil(graphMeta.height ?? 600),
      nodes: layoutNodes,
      edges,
      generated: new Date().toISOString().slice(0, 10),
    };
    const file = join(outDir, `${domain.key}.json`);
    writeFileSync(file, JSON.stringify(layout, null, 1), 'utf8');
    console.log(`${module} (${domain.key}.json): ${layoutNodes.length} noduri, ${edges.length} muchii, ${layout.width}×${layout.height}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
