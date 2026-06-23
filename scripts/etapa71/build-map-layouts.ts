/**
 * build-map-layouts.ts — ETAPA 71 B1 → 76 C3 → **ETAPA 84 B**: layout-ul hărții, precomputat.
 *
 * ETAPA 84 (fix bug afișare): sursa nu mai e `concept_family_membership` (7 domenii BAC,
 * ~120 concepte → clasa 11 arăta „1 temă"), ci **`concepts`** — TOATE conceptele clasei,
 * grupate robust pe `module ?? subtopic ?? "Altele"` (grouping.ts). Ieșire: un fișier per
 * clasă `layouts/grade-<g>.json` = { grade, groups: [{ key, label, width, height, nodes, edges }] }.
 * dagre BT + ranker ales scriptat (minim încrucișări), ca înainte. Perf 72 sacru (precomputat).
 *
 *   npx tsx --env-file=.env.local scripts/etapa71/build-map-layouts.ts
 */
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import dagre from '@dagrejs/dagre';
import { createServiceClient } from '../../src/lib/supabase/service';
import { conceptGroupLabel, groupKeyFor } from '../../src/lib/map/grouping';
import { countCrossings } from '../verify/etapa76-crossings';

interface LayoutNode {
  id: string; slug: string; name: string; grade: number | null;
  x: number; y: number; servable: number;
  prereqs: Array<{ id: string; slug: string; name: string; grade: number | null }>;
}

const GRADES = [9, 10, 11, 12];
const RANKERS = ['network-simplex', 'tight-tree', 'longest-path'] as const;

function layoutWithRanker(nodes: Array<{ id: string }>, edges: Array<{ from: string; to: string }>, ranker: (typeof RANKERS)[number]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'BT', nodesep: 56, ranksep: 130, marginx: 32, marginy: 32, ranker });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: 140, height: 84 });
  for (const e of edges) g.setEdge(e.to, e.from); // BT: fundamentul rămâne jos
  dagre.layout(g);
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) { const p = g.node(n.id); pos.set(n.id, { x: Math.round(p.x), y: Math.round(p.y) }); }
  const meta = g.graph();
  return { pos, width: Math.ceil(meta.width ?? 800), height: Math.ceil(meta.height ?? 600) };
}

interface ConceptRow { id: string; slug: string; name: string; grade: number | null; module: string | null; subtopic: string | null }

async function main() {
  const svc = createServiceClient();

  // toate conceptele clasele 9-12 (sursa hărții acum)
  const concepts: ConceptRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await svc.from('concepts').select('id, slug, name, grade_level, module, subtopic').range(from, from + 999);
    for (const c of data ?? []) {
      concepts.push({ id: c.id as string, slug: c.slug as string, name: c.name as string, grade: (c.grade_level as number | null) ?? null, module: (c.module as string | null) ?? null, subtopic: (c.subtopic as string | null) ?? null });
    }
    if (!data || data.length < 1000) break;
  }
  const infoById = new Map(concepts.map((c) => [c.id, { slug: c.slug, name: c.name, grade: c.grade }]));

  // servable per concept
  const { data: serv } = await svc.from('exercise_servable').select('exercise_id').limit(20000);
  const servIds = new Set((serv ?? []).map((s) => s.exercise_id as string));
  const servableByConceptId = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data: links } = await svc.from('exercise_concept_link').select('exercise_id, concept_id').range(from, from + 999);
    for (const l of links ?? []) if (servIds.has(l.exercise_id as string)) servableByConceptId.set(l.concept_id as string, (servableByConceptId.get(l.concept_id as string) ?? 0) + 1);
    if (!links || links.length < 1000) break;
  }

  // muchii (prereq → dependent)
  const allEdges: Array<{ from: string; to: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data: edges } = await svc.from('concept_edges').select('from_concept, to_concept').range(from, from + 999);
    for (const e of edges ?? []) allEdges.push({ from: e.from_concept as string, to: e.to_concept as string });
    if (!edges || edges.length < 1000) break;
  }
  console.log(`concepte: ${concepts.length} · muchii: ${allEdges.length}`);

  const outDir = join(process.cwd(), 'src', 'lib', 'map', 'layouts');
  mkdirSync(outDir, { recursive: true });
  // curăță vechile fișiere per-domeniu (i.json..viii.json) — modelul s-a schimbat
  for (const f of readdirSync(outDir)) if (f.endsWith('.json')) unlinkSync(join(outDir, f));

  for (const grade of GRADES) {
    const gradeConcepts = concepts.filter((c) => (c.grade ?? 0) === grade);
    // grupare robustă: module ?? subtopic ?? Altele
    const byGroup = new Map<string, { label: string; nodes: ConceptRow[] }>();
    for (const c of gradeConcepts) {
      const label = conceptGroupLabel(c);
      const key = groupKeyFor(grade, label);
      const g = byGroup.get(key) ?? { label, nodes: [] };
      g.nodes.push(c);
      byGroup.set(key, g);
    }

    const groups: Array<Record<string, unknown>> = [];
    for (const [key, { label, nodes }] of byGroup) {
      const idSet = new Set(nodes.map((n) => n.id));
      const edges = allEdges.filter((e) => idSet.has(e.from) && idSet.has(e.to));
      let best: { crossings: number; pos: Map<string, { x: number; y: number }>; width: number; height: number } | null = null;
      for (const ranker of RANKERS) {
        const r = layoutWithRanker(nodes, edges, ranker);
        const placed = nodes.map((n) => ({ id: n.id, ...r.pos.get(n.id)! }));
        const crossings = countCrossings(placed, edges);
        if (!best || crossings < best.crossings) best = { crossings, ...r };
      }
      const { pos, width, height } = best!;
      const layoutNodes: LayoutNode[] = nodes.map((n) => {
        const prereqs = allEdges.filter((e) => e.from === n.id).map((e) => {
          const info = infoById.get(e.to);
          return { id: e.to, slug: info?.slug ?? '?', name: info?.name ?? '?', grade: info?.grade ?? null };
        }).slice(0, 8);
        return { id: n.id, slug: n.slug, name: n.name, grade: n.grade, ...pos.get(n.id)!, servable: servableByConceptId.get(n.id) ?? 0, prereqs };
      });
      groups.push({ key, label, width, height, nodes: layoutNodes, edges });
    }
    // grupuri ordonate: cele mai multe noduri întâi (stabil pentru tab-uri)
    groups.sort((a, b) => (b.nodes as unknown[]).length - (a.nodes as unknown[]).length);
    writeFileSync(join(outDir, `grade-${grade}.json`), JSON.stringify({ grade, groups, generated: new Date().toISOString().slice(0, 10) }, null, 1), 'utf8');
    console.log(`grade-${grade}.json: ${gradeConcepts.length} concepte → ${groups.length} grupuri`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
