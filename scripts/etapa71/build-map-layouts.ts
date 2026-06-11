/**
 * build-map-layouts.ts — ETAPA 71 B1 → ETAPA 76 C3+D: layout-ul hărții, precomputat.
 *
 * v2 (ETAPA 76):
 *  - layout per DOMENIU × CLASĂ (doar clasele cu noduri — selectorul de clasă
 *    e onest); schema: { module, label, grades: { '12': {width,height,nodes,edges} } }
 *  - dagre RE-TUNAT (FAZA D): rankdir BT (jos→sus: de la fundament la avansat,
 *    se „urcă spre stele"), ranksep 130 / nodesep 56 (aerisit), iar RANKER-ul
 *    se alege SCRIPTAT per domeniu+clasă: rulăm network-simplex, tight-tree și
 *    longest-path și păstrăm varianta cu CELE MAI PUȚINE încrucișări de muchii
 *    (măsurate cu countCrossings — aceeași funcție ca scriptul de dovadă).
 *  - prereq-urile cară și grade-ul (portalurile cross-grade din FAZA C2).
 *
 *   npx tsx --env-file=.env.local scripts/etapa71/build-map-layouts.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import dagre from '@dagrejs/dagre';
import { createServiceClient } from '../../src/lib/supabase/service';
import { MODULE_DOMAINS } from '../../src/lib/map/domain-colors';
import { countCrossings } from '../verify/etapa76-crossings';

interface LayoutNode {
  id: string;
  slug: string;
  name: string;
  grade: number | null;
  x: number;
  y: number;
  servable: number;
  prereqs: Array<{ id: string; slug: string; name: string; grade: number | null }>;
}

const RANKERS = ['network-simplex', 'tight-tree', 'longest-path'] as const;

function layoutWithRanker(
  nodes: Array<{ id: string }>,
  edges: Array<{ from: string; to: string }>,
  ranker: (typeof RANKERS)[number]
): { pos: Map<string, { x: number; y: number }>; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'BT', nodesep: 56, ranksep: 130, marginx: 32, marginy: 32, ranker });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: 140, height: 84 });
  // dagre: muchia prerechizit → dependent; cu BT, fundamentul rămâne JOS
  for (const e of edges) g.setEdge(e.to, e.from);
  dagre.layout(g);
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id);
    pos.set(n.id, { x: Math.round(p.x), y: Math.round(p.y) });
  }
  const meta = g.graph();
  return { pos, width: Math.ceil(meta.width ?? 800), height: Math.ceil(meta.height ?? 600) };
}

async function main() {
  const svc = createServiceClient();

  const { data: membership } = await svc
    .from('concept_family_membership')
    .select('module, concepts(id, slug, name, grade_level)')
    .limit(2000);

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

  const allEdges: Array<{ from: string; to: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data: edges } = await svc.from('concept_edges').select('from_concept, to_concept').range(from, from + 999);
    for (const e of edges ?? []) allEdges.push({ from: e.from_concept as string, to: e.to_concept as string });
    if (!edges || edges.length < 1000) break;
  }
  console.log(`muchii totale în graf: ${allEdges.length}`);

  const infoById = new Map<string, { slug: string; name: string; grade: number | null }>();
  for (let from = 0; ; from += 1000) {
    const { data: cs } = await svc.from('concepts').select('id, slug, name, grade_level').range(from, from + 999);
    for (const c of cs ?? []) {
      infoById.set(c.id as string, { slug: c.slug as string, name: c.name as string, grade: (c.grade_level as number | null) ?? null });
    }
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
    const all = byModule.get(module) ?? [];
    const gradesPresent = [...new Set(all.map((n) => n.grade ?? 12))].sort();
    const grades: Record<string, unknown> = {};

    for (const grade of gradesPresent) {
      const nodes = all.filter((n) => (n.grade ?? 12) === grade);
      if (nodes.length === 0) continue;
      const idSet = new Set(nodes.map((n) => n.id));
      const edges = allEdges.filter((e) => idSet.has(e.from) && idSet.has(e.to));

      // FAZA D: alegem ranker-ul cu MINIM de încrucișări, măsurat scriptat
      let best: { ranker: string; crossings: number; pos: Map<string, { x: number; y: number }>; width: number; height: number } | null = null;
      for (const ranker of RANKERS) {
        const r = layoutWithRanker(nodes, edges, ranker);
        const placed = nodes.map((n) => ({ id: n.id, ...r.pos.get(n.id)! }));
        const crossings = countCrossings(placed, edges);
        if (!best || crossings < best.crossings) best = { ranker, crossings, ...r };
      }
      const { pos, width, height, ranker, crossings } = best!;

      const layoutNodes: LayoutNode[] = nodes.map((n) => {
        const prereqs = allEdges
          .filter((e) => e.from === n.id)
          .map((e) => {
            const info = infoById.get(e.to);
            return { id: e.to, slug: info?.slug ?? '?', name: info?.name ?? '?', grade: info?.grade ?? null };
          })
          .slice(0, 8);
        return { ...n, ...pos.get(n.id)!, servable: servableByConceptId.get(n.id) ?? 0, prereqs };
      });
      grades[String(grade)] = { width, height, nodes: layoutNodes, edges };
      console.log(`${module} clasa ${grade}: ${nodes.length} noduri, ${edges.length} muchii, ranker=${ranker}, încrucișări=${crossings}`);
    }

    const layout = {
      module,
      label: domain.label,
      grades,
      generated: new Date().toISOString().slice(0, 10),
    };
    writeFileSync(join(outDir, `${domain.key}.json`), JSON.stringify(layout, null, 1), 'utf8');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
