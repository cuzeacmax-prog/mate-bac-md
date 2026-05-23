import * as Tri from './triangle';
import * as Markers from './markers';
import type { Point, Triangle } from './types';

// ─── Private helpers ────────────────────────────────────────────────────────────

function roundForDisplay(v: number): string {
  if (Math.abs(v - Math.round(v)) < 0.001) return String(Math.round(v));
  return parseFloat(v.toFixed(2)).toString();
}

function formatAngle(deg: number): string {
  const rounded = Math.abs(deg - Math.round(deg)) < 0.05 ? Math.round(deg) : parseFloat(deg.toFixed(1));
  return `${rounded}^\\circ`;
}

function formatSideLabel(name: string, value: number, format: string): string {
  if (format === 'name_value') return `${name}=${roundForDisplay(value)}`;
  if (format === 'name_only') return name;
  return roundForDisplay(value);
}

// Perpendicular exterior offset for a point on a side.
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

// Returns true if any construction foot-point lands on the given side.
function sideHasConstructedPoint(
  side: 'BC' | 'CA' | 'AB',
  constructions: Array<{ from: 'A' | 'B' | 'C' }>,
): boolean {
  for (const con of constructions) {
    if (con.from === 'A' && side === 'BC') return true;
    if (con.from === 'B' && side === 'CA') return true;
    if (con.from === 'C' && side === 'AB') return true;
  }
  return false;
}

// Parses "BC" / "AD" / "AM_a" into [Point, Point] (longest-name-first to handle "M_a").
function parseSegment(segment: string, points: Record<string, Point>): [Point, Point] | null {
  const validNames = Object.keys(points).sort((a, b) => b.length - a.length);
  for (const name1 of validNames) {
    if (segment.startsWith(name1)) {
      const rest = segment.substring(name1.length);
      if (points[rest] !== undefined) return [points[name1], points[rest]];
    }
  }
  return null;
}

// Groups construction feet that land within `tol` of each other.
// Returns: canonicals (canonical → all labels), canonicalFor (non-canon → canon).
function detectCoincidences(
  lines: Array<{ label: string; footPoint: Point }>,
  tol = 0.05,
): { canonicals: Map<string, string[]>; canonicalFor: Map<string, string> } {
  const canonicals = new Map<string, string[]>();
  const canonicalFor = new Map<string, string>();
  const processed = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    if (processed.has(lines[i].label)) continue;
    const group = [lines[i].label];
    for (let j = i + 1; j < lines.length; j++) {
      if (processed.has(lines[j].label)) continue;
      const dx = lines[i].footPoint[0] - lines[j].footPoint[0];
      const dy = lines[i].footPoint[1] - lines[j].footPoint[1];
      if (Math.sqrt(dx * dx + dy * dy) < tol) group.push(lines[j].label);
    }
    for (const label of group) processed.add(label);
    if (group.length > 1) {
      canonicals.set(group[0], group);
      for (let k = 1; k < group.length; k++) canonicalFor.set(group[k], group[0]);
    }
  }
  return { canonicals, canonicalFor };
}

// Deduces {a, b, c} from any valid combination of sides and angles.
function deduceTriangleSides(input: TriangleAdvancedInput): { a: number; b: number; c: number } {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let { a, b, c } = input;
  let A = input.angle_A;
  let B = input.angle_B;
  let C = input.angle_C;

  // Complete missing angle from two known
  if (A != null && B != null && C == null) C = 180 - A - B;
  else if (A != null && C != null && B == null) B = 180 - A - C;
  else if (B != null && C != null && A == null) A = 180 - B - C;

  // All 3 sides
  if (a != null && b != null && c != null) return { a, b, c };

  // 1 side + all 3 angles → law of sines
  if (A != null && B != null && C != null) {
    if (a != null) {
      const r = a / Math.sin(toRad(A));
      return { a, b: r * Math.sin(toRad(B)), c: r * Math.sin(toRad(C)) };
    }
    if (b != null) {
      const r = b / Math.sin(toRad(B));
      return { a: r * Math.sin(toRad(A)), b, c: r * Math.sin(toRad(C)) };
    }
    if (c != null) {
      const r = c / Math.sin(toRad(C));
      return { a: r * Math.sin(toRad(A)), b: r * Math.sin(toRad(B)), c };
    }
  }

  // SAS: 2 sides + included angle → law of cosines
  if (a != null && b != null && C != null)
    return { a, b, c: Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(toRad(C))) };
  if (a != null && c != null && B != null)
    return { a, b: Math.sqrt(a * a + c * c - 2 * a * c * Math.cos(toRad(B))), c };
  if (b != null && c != null && A != null)
    return { a: Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(toRad(A))), b, c };

  // SSA: 2 sides + non-included angle → law of sines (first solution)
  const ssaSolve = (
    knownSide: number,
    knownAngleDeg: number,
    otherSide: number,
  ): number => {
    const sinOther = (otherSide * Math.sin(toRad(knownAngleDeg))) / knownSide;
    if (sinOther > 1) throw new Error('Triunghi imposibil (SSA fără soluție)');
    return (Math.asin(sinOther) * 180) / Math.PI;
  };

  if (a != null && b != null && A != null) {
    const Bcalc = ssaSolve(a, A, b);
    const Ccalc = 180 - A - Bcalc;
    if (Ccalc <= 0) throw new Error('Triunghi imposibil');
    return { a, b, c: (a * Math.sin(toRad(Ccalc))) / Math.sin(toRad(A)) };
  }
  if (a != null && b != null && B != null) {
    const Acalc = ssaSolve(b, B, a);
    const Ccalc = 180 - Acalc - B;
    if (Ccalc <= 0) throw new Error('Triunghi imposibil');
    return { a, b, c: (b * Math.sin(toRad(Ccalc))) / Math.sin(toRad(B)) };
  }
  if (a != null && c != null && A != null) {
    const Ccalc = ssaSolve(a, A, c);
    const Bcalc = 180 - A - Ccalc;
    if (Bcalc <= 0) throw new Error('Triunghi imposibil');
    return { a, b: (a * Math.sin(toRad(Bcalc))) / Math.sin(toRad(A)), c };
  }
  if (a != null && c != null && C != null) {
    const Acalc = ssaSolve(c, C, a);
    const Bcalc = 180 - Acalc - C;
    if (Bcalc <= 0) throw new Error('Triunghi imposibil');
    return { a, b: (c * Math.sin(toRad(Bcalc))) / Math.sin(toRad(C)), c };
  }
  if (b != null && c != null && B != null) {
    const Ccalc = ssaSolve(b, B, c);
    const Acalc = 180 - B - Ccalc;
    if (Acalc <= 0) throw new Error('Triunghi imposibil');
    return { a: (b * Math.sin(toRad(Acalc))) / Math.sin(toRad(B)), b, c };
  }
  if (b != null && c != null && C != null) {
    const Bcalc = ssaSolve(c, C, b);
    const Acalc = 180 - Bcalc - C;
    if (Acalc <= 0) throw new Error('Triunghi imposibil');
    return { a: (c * Math.sin(toRad(Acalc))) / Math.sin(toRad(C)), b, c };
  }

  throw new Error('Date insuficiente pentru determinarea triunghiului (minim 3 valori: laturi și/sau unghiuri)');
}

// ─── Public interfaces ──────────────────────────────────────────────────────────

export interface TriangleAdvancedInput {
  // At least 3 of the following (sides + angles) must be provided.
  a?: number;
  b?: number;
  c?: number;
  angle_A?: number;
  angle_B?: number;
  angle_C?: number;

  show_sides?: boolean;
  show_angles?: boolean;
  show_vertices?: boolean;

  /** Format for side labels. Default: 'value_only' → "5" */
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

  /** Auto-label all three angles with their degree values. */
  show_angle_values?: boolean;

  /** Custom angle labels at specific vertices. */
  angle_labels?: Array<{
    vertex: 'A' | 'B' | 'C';
    text: string;
    show_arc?: boolean;
    arc_radius?: number;
    color?: string;
  }>;

  /** Custom segment labels for AI-authored exercises. */
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
  const { a, b, c } = deduceTriangleSides(input);
  const triangle: Triangle = Tri.triangleVerticesFromSides(a, b, c);
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

  // Detect coincident foot-points (e.g. bisector = median = altitude in isosceles)
  const { canonicals, canonicalFor } = detectCoincidences(constructionLines);

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
    explanation: `Trasăm triunghiul ABC cu laturile a=${roundForDisplay(a)}, b=${roundForDisplay(b)}, c=${roundForDisplay(c)}.`,
    elements_added: ['triangle', 'vertex_labels'],
    cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
  });

  // Step 2: pedagogical markers + angle labels
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
      explanation: `Cercul înscris are centrul I și raza r=${roundForDisplay(inradius)}.`,
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
      explanation: `Cercul circumscris are centrul O și raza R=${roundForDisplay(circumradius)}.`,
      elements_added: ['circumcircle', 'O'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Steps: construction lines — coincident feet rendered once with merged label
  for (const line of constructionLines) {
    cumulativeTikz += '  ' + line.tikz + '\n';

    if (canonicalFor.has(line.label)) {
      // Non-canonical: draw the line but skip dot+label (already rendered with canonical)
      const canon = canonicalFor.get(line.label)!;
      steps.push({
        step: steps.length + 1,
        title: `${line.description}`,
        explanation: `${line.description} — coincide cu ${canon} (punct comun în acest triunghi).`,
        elements_added: [line.label],
        cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
      });
      continue;
    }

    const foot = line.footPoint;
    cumulativeTikz += `  \\fill[black] (${foot[0].toFixed(3)},${foot[1].toFixed(3)}) circle (0.04);\n`;

    const groupLabels = canonicals.get(line.label);
    const displayLabel = groupLabels ? groupLabels.join(' = ') : line.label;
    const offset = labelOffsetForPointOnSide(foot, line.sideStart, line.sideEnd, centroidPoint, 0.25);
    cumulativeTikz += `  \\node at (${(foot[0] + offset.nx).toFixed(3)},${(foot[1] + offset.ny).toFixed(3)}) {$${displayLabel}$};\n`;

    steps.push({
      step: steps.length + 1,
      title: line.description,
      explanation: line.description,
      elements_added: [line.label],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Side labels: sloped, 8pt offset, position adaptive to avoid foot-point overlap.
  // Paths B→C, C→A, A→B ensure "below" is exterior for our geometry.
  if (input.show_sides) {
    const fmt = input.side_label_format ?? 'value_only';
    const cons = input.constructions ?? [];
    const posA = sideHasConstructedPoint('BC', cons) ? '0.15' : '0.5';
    const posB = sideHasConstructedPoint('CA', cons) ? '0.15' : '0.5';
    const posC = sideHasConstructedPoint('AB', cons) ? '0.15' : '0.5';
    cumulativeTikz += `  \\path (${B[0].toFixed(3)},${B[1].toFixed(3)}) -- (${C[0].toFixed(3)},${C[1].toFixed(3)}) node[pos=${posA}, sloped, below=8pt] {$${formatSideLabel('a', a, fmt)}$};\n`;
    cumulativeTikz += `  \\path (${C[0].toFixed(3)},${C[1].toFixed(3)}) -- (${A[0].toFixed(3)},${A[1].toFixed(3)}) node[pos=${posB}, sloped, below=8pt] {$${formatSideLabel('b', b, fmt)}$};\n`;
    cumulativeTikz += `  \\path (${A[0].toFixed(3)},${A[1].toFixed(3)}) -- (${B[0].toFixed(3)},${B[1].toFixed(3)}) node[pos=${posC}, sloped, below=8pt] {$${formatSideLabel('c', c, fmt)}$};\n`;
  }

  // Angle labels: show_angle_values auto-fills, angle_labels allows custom/override.
  const effectiveAngleLabels = [...(input.angle_labels ?? [])];
  if (input.show_angle_values) {
    for (const v of ['A', 'B', 'C'] as const) {
      if (!effectiveAngleLabels.some((al) => al.vertex === v)) {
        effectiveAngleLabels.push({ vertex: v, text: formatAngle(angles[v]) });
      }
    }
  }
  for (const al of effectiveAngleLabels) {
    const V = al.vertex === 'A' ? A : al.vertex === 'B' ? B : C;
    const [P1, P2]: [Point, Point] =
      al.vertex === 'A' ? [B, C] : al.vertex === 'B' ? [A, C] : [A, B];
    cumulativeTikz +=
      '  ' +
      Markers.angleLabelTikz(V, P1, P2, al.text, {
        show_arc: al.show_arc,
        arc_radius: al.arc_radius,
        color: al.color,
      }) +
      '\n';
  }

  // Custom segment labels (AI-authored).
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
