/**
 * ETAPA 76 FAZA D — numărarea SCRIPTATĂ a încrucișărilor de muchii per domeniu
 * (dovada înainte/după pentru re-tunarea dagre).
 *
 * Două muchii se încrucișează dacă segmentele dintre centrele nodurilor se
 * intersectează propriu-zis (nu la capete comune).
 *
 *   npx tsx scripts/verify/etapa76-crossings.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface N { id: string; x: number; y: number }
interface E { from: string; to: string }

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
}
function segmentsCross(a1: N, a2: N, b1: N, b2: N): boolean {
  // capete comune = nu e încrucișare
  if (a1.id === b1.id || a1.id === b2.id || a2.id === b1.id || a2.id === b2.id) return false;
  const o1 = orient(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y);
  const o2 = orient(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y);
  const o3 = orient(b1.x, b1.y, b2.x, b2.y, a1.x, a1.y);
  const o4 = orient(b1.x, b1.y, b2.x, b2.y, a2.x, a2.y);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

export function countCrossings(nodes: N[], edges: E[]): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const segs = edges
    .map((e) => ({ a: byId.get(e.from), b: byId.get(e.to) }))
    .filter((s): s is { a: N; b: N } => !!s.a && !!s.b);
  let crossings = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (segmentsCross(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) crossings++;
    }
  }
  return crossings;
}

interface LayoutFile {
  label: string;
  // v1: nodes/edges la rădăcină; v2 (ETAPA 76): grades: { '12': {nodes,edges} }
  nodes?: N[];
  edges?: E[];
  grades?: Record<string, { nodes: N[]; edges: E[] }>;
}

function main() {
  const dir = join(process.cwd(), 'src', 'lib', 'map', 'layouts');
  console.log('── încrucișări de muchii per domeniu ──');
  for (const key of ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'viii']) {
    const layout = JSON.parse(readFileSync(join(dir, `${key}.json`), 'utf8')) as LayoutFile;
    if (layout.grades) {
      for (const [grade, g] of Object.entries(layout.grades)) {
        console.log(`  ${key} (clasa ${grade}): ${g.nodes.length} noduri, ${g.edges.length} muchii → ${countCrossings(g.nodes, g.edges)} încrucișări`);
      }
    } else if (layout.nodes && layout.edges) {
      console.log(`  ${key}: ${layout.nodes.length} noduri, ${layout.edges.length} muchii → ${countCrossings(layout.nodes, layout.edges)} încrucișări`);
    }
  }
}
if (process.argv[1]?.includes('etapa76-crossings')) main();
