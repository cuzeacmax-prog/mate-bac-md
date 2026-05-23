import * as Tri from './triangle';
import * as Markers from './markers';
import type { Point, Triangle } from './types';

// ─── Private helpers ───────────────────────────────────────────────────────────

function formatSideLabel(name: string, value: number, format: string): string {
  if (format === 'name_value') return `${name}=${value}`;
  if (format === 'name_only') return name;
  return String(value); // 'value_only' default
}

// Returns the perpendicular exterior offset vector for a point lying on a side.
// The offset direction is away from the triangle centroid.
function labelOffsetForPointOnSide(
  pointOnSide: Point,
  sideStart: Point,
  sideEnd: Point,
  triangleCentroid: Point,
  offset = 0.25,
): { nx: number; ny: number } {
  const dx = sideEnd[0] - sideStart[0];
  const dy = sideEnd[1] - sideStart[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  let perpX = -dy / len;
  let perpY = dx / len;
  // If perp points toward centroid, flip to exterior
  const toCentroidX = triangleCentroid[0] - pointOnSide[0];
  const toCentroidY = triangleCentroid[1] - pointOnSide[1];
  if (perpX * toCentroidX + perpY * toCentroidY > 0) {
    perpX = -perpX;
    perpY = -perpY;
  }
  return { nx: perpX * offset, ny: perpY * offset };
}

function sideOppositeVertex(vertex: 'A' | 'B' | 'C', t: Triangle): [Point, Point] {
  if (vertex === 'A') return [t.B, t.C];
  if (vertex === 'B') return [t.C, t.A];
  return [t.A, t.B];
}

// Parses "BC" or "AD" or "AM_a" into [Point, Point] using the named-points dict.
// Tries longest names first to handle multi-char labels like "M_a".
function parseSegment(segment: string, points: Record<string, Point>): [Point, Point] | null {
  const validNames = Object.keys(points).sort((a, b) => b.length - a.length);
  for (const name1 of validNames) {
    if (segment.startsWith(name1)) {
      const rest = segment.substring(name1.length);
      if (points[rest] !== undefined) {
        return [points[name1], points[rest]];
      }
    }
  }
  return null;
}

// ─── Public interfaces ──────────────────────────────────────────────────────────

export interface TriangleAdvancedInput {
  a: number;
  b: number;
  c: number;

  show_sides?: boolean;
  show_angles?: boolean;
  show_vertices?: boolean;

  /** Format for side measurement labels. Default: 'value_only' → "5" */
  side_label_format?: 'value_only' | 'name_value' | 'name_only';

  auto_detect_right_angles?: boolean;
  auto_detect_equal_angles?: boolean;
  auto_detect_equal_sides?: boolean;

  show_incircle?: boolean;
  show_circumcircle?: boolean;

  constructions?: Array<{
    type: 'bisector' | 'median' | 'altitude';
    from: 'A' | 'B' | 'C';
    label?: string;
    color?: string;
    show_label?: boolean;
  }>;

  /** Custom segment labels for AI-generated exercises. Points must exist in the points dict. */
  custom_labels?: Array<{
    segment: string;
    text: string;
    position?: 'midway' | 'start' | 'end' | number;
    side?: 'above' | 'below';
    color?: string;
  }>;
}

export interface TriangleAdvancedOutput {
  tikz: string;
  points: Record<string, Point>;
  angles: { A: number; B: number; C: number };
  computed: {
    incenter?: Point;
    inradius?: number;
    circumcenter?: Point;
    circumradius?: number;
    centroid?: Point;
    detected_right_angles: string[];
    detected_equal_angles: string[][];
    detected_equal_sides: string[][];
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    elements_added: string[];
    cumulative_tikz: string;
  }>;
}

// ─── Main generator ─────────────────────────────────────────────────────────────

export function generateTriangleAdvanced(input: TriangleAdvancedInput): TriangleAdvancedOutput {
  const triangle: Triangle = Tri.triangleVerticesFromSides(input.a, input.b, input.c);
  const { A, B, C } = triangle;
  const angles = Tri.triangleAngles(triangle);

  const centroidPoint: Point = [
    (A[0] + B[0] + C[0]) / 3,
    (A[1] + B[1] + C[1]) / 3,
  ];

  const rightAngles = input.auto_detect_right_angles ? Tri.detectRightAngles(angles) : [];
  const equalAngles = input.auto_detect_equal_angles ? Tri.detectEqualAngles(angles) : [];
  const equalSides = input.auto_detect_equal_sides ? Tri.detectEqualSides(triangle) : [];

  const points: Record<string, Point> = { A, B, C };

  const incenter = input.show_incircle ? Tri.incenter(triangle) : undefined;
  const inradius = input.show_incircle ? Tri.inradius(triangle) : undefined;
  const circumcenter = input.show_circumcircle ? Tri.circumcenter(triangle) : undefined;
  const circumradius = input.show_circumcircle ? Tri.circumradius(triangle) : undefined;
  if (incenter) points['I'] = incenter;
  if (circumcenter) points['O'] = circumcenter;

  type ConstructionLine = {
    tikz: string;
    label: string;
    description: string;
    footPoint: Point;
    sideStart: Point;
    sideEnd: Point;
  };
  const constructionLines: ConstructionLine[] = [];

  if (input.constructions) {
    for (const con of input.constructions) {
      let footPoint: Point;
      let defaultLabel: string;
      let color = con.color ?? 'red!75!black';
      let description: string;

      if (con.type === 'bisector') {
        footPoint = Tri.bisectorFootFrom(con.from, triangle);
        defaultLabel = con.from === 'A' ? 'D' : con.from === 'B' ? 'E' : 'F';
        description = `Bisectoarea din ${con.from} intersectează latura opusă în ${con.label ?? defaultLabel}`;
      } else if (con.type === 'median') {
        footPoint = Tri.medianFootFrom(con.from, triangle);
        defaultLabel = con.from === 'A' ? 'M_a' : con.from === 'B' ? 'M_b' : 'M_c';
        color = con.color ?? 'green!60!black';
        description = `Mediana din ${con.from} ajunge la mijlocul ${con.label ?? defaultLabel}`;
      } else {
        footPoint = Tri.altitudeFootFrom(con.from, triangle);
        defaultLabel = con.from === 'A' ? 'H_a' : con.from === 'B' ? 'H_b' : 'H_c';
        color = con.color ?? 'orange!80!black';
        description = `Înălțimea din ${con.from} cade în ${con.label ?? defaultLabel}`;
      }

      const label = con.label ?? defaultLabel;
      points[label] = footPoint;
      const vertexPos = con.from === 'A' ? A : con.from === 'B' ? B : C;
      const [sideStart, sideEnd] = sideOppositeVertex(con.from, triangle);
      constructionLines.push({
        tikz: `\\draw[thick, ${color}] (${vertexPos[0].toFixed(3)},${vertexPos[1].toFixed(3)}) -- (${footPoint[0].toFixed(3)},${footPoint[1].toFixed(3)});`,
        label,
        description,
        footPoint,
        sideStart,
        sideEnd,
      });
    }
  }

  const steps: TriangleAdvancedOutput['construction_steps'] = [];
  let cumulativeTikz = '\\begin{tikzpicture}[scale=1.3, line cap=round, line join=round]\n';

  // Step 1: triangle + vertex labels
  let step1Tikz = `  \\draw[ultra thick, blue!70!black] (${A[0].toFixed(3)},${A[1].toFixed(3)}) -- (${B[0].toFixed(3)},${B[1].toFixed(3)}) -- (${C[0].toFixed(3)},${C[1].toFixed(3)}) -- cycle;`;
  if (input.show_vertices !== false) {
    step1Tikz += `\n  \\node[above=3pt] at (${A[0].toFixed(3)},${A[1].toFixed(3)}) {$A$};`;
    step1Tikz += `\n  \\node[below left=3pt] at (${B[0].toFixed(3)},${B[1].toFixed(3)}) {$B$};`;
    step1Tikz += `\n  \\node[below right=3pt] at (${C[0].toFixed(3)},${C[1].toFixed(3)}) {$C$};`;
  }
  cumulativeTikz += step1Tikz + '\n';
  steps.push({
    step: 1,
    title: 'Construim triunghiul ABC',
    explanation: `Trasăm triunghiul ABC cu laturile a=${input.a}, b=${input.b}, c=${input.c}.`,
    elements_added: ['triangle', 'vertex_labels'],
    cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
  });

  // Step 2: pedagogical markers
  let markersTikz = '';
  for (const ra of rightAngles) {
    const V = ra === 'A' ? A : ra === 'B' ? B : C;
    const others: [Point, Point] = ra === 'A' ? [B, C] : ra === 'B' ? [A, C] : [A, B];
    markersTikz += '  ' + Markers.rightAngleMarkerTikz(V, others[0], others[1]) + '\n';
  }
  equalAngles.forEach((group, idx) => {
    for (const vertex of group) {
      const V = vertex === 'A' ? A : vertex === 'B' ? B : C;
      const others: [Point, Point] = vertex === 'A' ? [B, C] : vertex === 'B' ? [A, C] : [A, B];
      markersTikz += '  ' + Markers.equalAngleArcsTikz(V, others[0], others[1], idx + 1) + '\n';
    }
  });
  equalSides.forEach((group, idx) => {
    for (const side of group) {
      let P1: Point, P2: Point;
      if (side === 'a') { P1 = B; P2 = C; }
      else if (side === 'b') { P1 = C; P2 = A; }
      else { P1 = A; P2 = B; }
      markersTikz += '  ' + Markers.equalSegmentMarksTikz(P1, P2, idx + 1) + '\n';
    }
  });
  if (markersTikz.trim()) {
    cumulativeTikz += markersTikz;
    const explanationParts: string[] = [];
    if (rightAngles.length > 0) explanationParts.push(`Unghi drept la ${rightAngles.join(', ')}`);
    if (equalAngles.length > 0) explanationParts.push('Unghiuri egale marcate cu arce');
    if (equalSides.length > 0) explanationParts.push('Laturi egale marcate cu hash');
    steps.push({
      step: steps.length + 1,
      title: 'Marcaje pedagogice',
      explanation: explanationParts.join('. ') + '.',
      elements_added: ['markers'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Step: incircle
  if (incenter && inradius !== undefined) {
    cumulativeTikz += `  \\draw[thick, red!75!black] (${incenter[0].toFixed(3)},${incenter[1].toFixed(3)}) circle (${inradius.toFixed(3)});\n`;
    cumulativeTikz += `  \\fill[black] (${incenter[0].toFixed(3)},${incenter[1].toFixed(3)}) circle (0.05);\n`;
    cumulativeTikz += `  \\node[right=2pt] at (${incenter[0].toFixed(3)},${incenter[1].toFixed(3)}) {$I$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Construim cercul înscris',
      explanation: `Cercul înscris are centrul I (incentrul triunghiului) și raza r=${inradius.toFixed(3)}.`,
      elements_added: ['incircle', 'I'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Step: circumcircle
  if (circumcenter && circumradius !== undefined) {
    cumulativeTikz += `  \\draw[thick, purple!75!black] (${circumcenter[0].toFixed(3)},${circumcenter[1].toFixed(3)}) circle (${circumradius.toFixed(3)});\n`;
    cumulativeTikz += `  \\fill[black] (${circumcenter[0].toFixed(3)},${circumcenter[1].toFixed(3)}) circle (0.05);\n`;
    cumulativeTikz += `  \\node[right=2pt] at (${circumcenter[0].toFixed(3)},${circumcenter[1].toFixed(3)}) {$O$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Construim cercul circumscris',
      explanation: `Cercul circumscris are centrul O (circumcentrul) și raza R=${circumradius.toFixed(3)}.`,
      elements_added: ['circumcircle', 'O'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Steps: constructions — foot point labels placed exterior to the side
  for (const line of constructionLines) {
    cumulativeTikz += '  ' + line.tikz + '\n';
    const foot = line.footPoint;
    cumulativeTikz += `  \\fill[black] (${foot[0].toFixed(3)},${foot[1].toFixed(3)}) circle (0.04);\n`;
    const offset = labelOffsetForPointOnSide(foot, line.sideStart, line.sideEnd, centroidPoint, 0.25);
    const labelX = (foot[0] + offset.nx).toFixed(3);
    const labelY = (foot[1] + offset.ny).toFixed(3);
    cumulativeTikz += `  \\node at (${labelX},${labelY}) {$${line.label}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: line.description,
      explanation: line.description,
      elements_added: [line.label],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Side labels with sloped orientation (exterior, parallel to each side).
  // Path directions B→C, C→A, A→B ensure "below" is always exterior for our geometry.
  if (input.show_sides) {
    const fmt = input.side_label_format ?? 'value_only';
    cumulativeTikz += `  \\path (${B[0].toFixed(3)},${B[1].toFixed(3)}) -- (${C[0].toFixed(3)},${C[1].toFixed(3)}) node[midway, sloped, below=3pt] {$${formatSideLabel('a', input.a, fmt)}$};\n`;
    cumulativeTikz += `  \\path (${C[0].toFixed(3)},${C[1].toFixed(3)}) -- (${A[0].toFixed(3)},${A[1].toFixed(3)}) node[midway, sloped, below=3pt] {$${formatSideLabel('b', input.b, fmt)}$};\n`;
    cumulativeTikz += `  \\path (${A[0].toFixed(3)},${A[1].toFixed(3)}) -- (${B[0].toFixed(3)},${B[1].toFixed(3)}) node[midway, sloped, below=3pt] {$${formatSideLabel('c', input.c, fmt)}$};\n`;
  }

  // Custom labels on arbitrary named segments (for AI-authored exercises).
  for (const cl of input.custom_labels ?? []) {
    const seg = parseSegment(cl.segment, points);
    if (!seg) continue;
    const [p1, p2] = seg;
    const pos =
      typeof cl.position === 'number'
        ? cl.position.toFixed(2)
        : cl.position === 'start'
          ? '0.15'
          : cl.position === 'end'
            ? '0.85'
            : '0.5';
    const sideStr = (cl.side ?? 'above') + '=3pt';
    const colorStr = cl.color ? `, ${cl.color}` : '';
    cumulativeTikz += `  \\path (${p1[0].toFixed(3)},${p1[1].toFixed(3)}) -- (${p2[0].toFixed(3)},${p2[1].toFixed(3)}) node[pos=${pos}, sloped, ${sideStr}${colorStr}] {$${cl.text}$};\n`;
  }

  cumulativeTikz += '\\end{tikzpicture}';

  return {
    tikz: cumulativeTikz,
    points,
    angles,
    computed: {
      incenter,
      inradius,
      circumcenter,
      circumradius,
      centroid: centroidPoint,
      detected_right_angles: rightAngles,
      detected_equal_angles: equalAngles,
      detected_equal_sides: equalSides,
    },
    construction_steps: steps,
  };
}
