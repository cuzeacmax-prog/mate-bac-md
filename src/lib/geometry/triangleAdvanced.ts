import * as Tri from './triangle';
import * as Markers from './markers';
import type { Point, Triangle } from './types';
import { midSegment, perpendicularBisector, medianTriangle } from './triangle';

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

function sideOppositeVertex(vertex: 'A' | 'B' | 'C', t: Triangle): [Point, Point] {
  if (vertex === 'A') return [t.B, t.C];
  if (vertex === 'B') return [t.C, t.A];
  return [t.A, t.B];
}

// Fractional position of foot along sideStart→sideEnd (clamped to [0,1]).
function footFraction(foot: Point, sideStart: Point, sideEnd: Point): number {
  const dx = sideEnd[0] - sideStart[0];
  const dy = sideEnd[1] - sideStart[1];
  const len2 = dx * dx + dy * dy;
  return Math.max(0, Math.min(1,
    ((foot[0] - sideStart[0]) * dx + (foot[1] - sideStart[1]) * dy) / len2,
  ));
}

// Intersection of infinite lines p1p2 and p3p4. Returns null if parallel.
function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const dx1 = p2[0] - p1[0], dy1 = p2[1] - p1[1];
  const dx2 = p4[0] - p3[0], dy2 = p4[1] - p3[1];
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p3[0] - p1[0]) * dy2 - (p3[1] - p1[1]) * dx2) / denom;
  return [p1[0] + t * dx1, p1[1] + t * dy1];
}

// Computes absolute position + rotation for a label placed exterior to the triangle,
// parallel to the side P1P2. Works for any triangle orientation.
function exteriorLabelPosition(
  P1: Point,
  P2: Point,
  centroid: Point,
  offset: number = 0.3,
): { x: number; y: number; rotation: number } {
  const midX = (P1[0] + P2[0]) / 2;
  const midY = (P1[1] + P2[1]) / 2;
  let extX = midX - centroid[0];
  let extY = midY - centroid[1];
  const len = Math.sqrt(extX * extX + extY * extY);
  if (len > 0) { extX /= len; extY /= len; }
  const dx = P2[0] - P1[0];
  const dy = P2[1] - P1[1];
  let rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (rotation > 90 || rotation < -90) rotation += 180;
  return { x: midX + extX * offset, y: midY + extY * offset, rotation };
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
// Canonical is chosen by priority: non-subscripted name first, then D/E/F/H/M order.
function detectCoincidences(
  lines: Array<{ label: string; footPoint: Point }>,
  tol = 0.05,
): { canonicals: Map<string, string[]>; canonicalFor: Map<string, string> } {
  function pickCanonical(group: string[]): string {
    const nonSub = group.filter(l => !l.includes('_'));
    if (nonSub.length > 0) return nonSub[0];
    const priority = ['I', 'O', 'G', 'H', 'M', 'D', 'E', 'F'];
    for (const p of priority) {
      const m = group.find(l => l.startsWith(p));
      if (m) return m;
    }
    return group[0];
  }

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
      const canonical = pickCanonical(group);
      const ordered = [canonical, ...group.filter(l => l !== canonical)];
      canonicals.set(canonical, ordered);
      for (const m of ordered.slice(1)) canonicalFor.set(m, canonical);
    }
  }
  return { canonicals, canonicalFor };
}

// Deduces {a, b, c} from any valid combination of sides and angles.
function deduceTriangleSides(input: TriangleAdvancedInput): { a: number; b: number; c: number } {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const { a, b, c } = input;
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

  /** Angle labels at the intersection of two named construction lines. */
  intersection_angle_labels?: Array<{
    between: [string, string]; // e.g. ["bisector_A", "median_B"]
    text: string;
    show_arc?: boolean;
    arc_radius?: number;
    color?: string;
  }>;

  // ── NEW: linii mijlocii, triunghi median, mediatoare, centroid ────────────────

  /** Afișează liniile mijlocii (segmentele de mijloc). true = toate 3, sau array boolean [a, b, c]. */
  show_midsegments?: boolean | boolean[];

  /** Afișează triunghiul median (linii între cele 3 mijloace de laturi). */
  show_median_triangle?: boolean;

  /** Afișează mediatoarele. true = toate 3, sau array boolean [a, b, c]. */
  show_perpendicular_bisectors?: boolean | boolean[];

  /** Afișează centrul de greutate G ca punct cu etichetă. */
  show_centroid?: boolean;

  /** Afișează circumcentrul O (intersecția mediatoarelor) ca punct cu etichetă. */
  show_circumcenter_point?: boolean;
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
  const conEndpoints = new Map<string, [Point, Point]>();

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
      conEndpoints.set(`${con.type}_${con.from}`, [vertexPos, footPoint]);
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

    // Single canonical name (priority: non-subscripted > D/E/F/H/M order)
    const groupLabels = canonicals.get(line.label);
    const displayLabel = line.label;
    const mergeNote = groupLabels && groupLabels.length > 1
      ? ` Notă: ${groupLabels.join(', ')} coincid în acest triunghi special.`
      : '';
    const footLP = exteriorLabelPosition(foot, foot, centroidPoint, 0.22);
    cumulativeTikz += `  \\node at (${footLP.x.toFixed(3)},${footLP.y.toFixed(3)}) {$${displayLabel}$};\n`;

    steps.push({
      step: steps.length + 1,
      title: line.description,
      explanation: line.description + mergeNote,
      elements_added: [line.label],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // ── NEW: linii mijlocii ────────────────────────────────────────────────────────
  const showMidsegs = input.show_midsegments;
  if (showMidsegs) {
    const flags: [boolean, boolean, boolean] =
      Array.isArray(showMidsegs)
        ? [showMidsegs[0] ?? true, showMidsegs[1] ?? true, showMidsegs[2] ?? true]
        : [true, true, true];

    const midsegs: Array<['a' | 'b' | 'c', boolean]> = [['a', flags[0]], ['b', flags[1]], ['c', flags[2]]];
    for (const [side, show] of midsegs) {
      if (!show) continue;
      const seg = midSegment(triangle, side);
      cumulativeTikz += `  \\draw[thick, teal!70!black] (${seg.start[0].toFixed(3)},${seg.start[1].toFixed(3)}) -- (${seg.end[0].toFixed(3)},${seg.end[1].toFixed(3)});\n`;
      const midX = (seg.start[0] + seg.end[0]) / 2;
      const midY = (seg.start[1] + seg.end[1]) / 2;
      const lp = exteriorLabelPosition(seg.start, seg.end, centroidPoint, 0.28);
      cumulativeTikz += `  \\node[rotate=${lp.rotation.toFixed(1)}, teal!70!black, font=\\small] at (${lp.x.toFixed(3)},${lp.y.toFixed(3)}) {$m_${side}$};\n`;
      // midpoints as dots
      cumulativeTikz += `  \\fill[teal!70!black] (${seg.start[0].toFixed(3)},${seg.start[1].toFixed(3)}) circle (0.04);\n`;
      cumulativeTikz += `  \\fill[teal!70!black] (${seg.end[0].toFixed(3)},${seg.end[1].toFixed(3)}) circle (0.04);\n`;
      // suppress midX warning
      void midX; void midY;
    }
    steps.push({
      step: steps.length + 1,
      title: 'Liniile mijlocii',
      explanation: 'Linia mijlocie este paralelă cu latura corespunzătoare și egală cu jumătatea ei.',
      elements_added: ['midsegments'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // ── NEW: triunghi median ───────────────────────────────────────────────────────
  if (input.show_median_triangle) {
    const mt = medianTriangle(triangle);
    // Ma = mt.B, Mb = mt.C, Mc = mt.A  (din definiția medianTriangle)
    const Ma = mt.B; // mijlocul BC
    const Mb = mt.C; // mijlocul CA
    const Mc = mt.A; // mijlocul AB
    cumulativeTikz += `  \\draw[thick, violet!70!black, dashed] (${Mc[0].toFixed(3)},${Mc[1].toFixed(3)}) -- (${Ma[0].toFixed(3)},${Ma[1].toFixed(3)}) -- (${Mb[0].toFixed(3)},${Mb[1].toFixed(3)}) -- cycle;\n`;
    // Labels
    const labelOffset = 0.2;
    const maCent = centroidPoint;
    [{ p: Ma, l: 'M_a' }, { p: Mb, l: 'M_b' }, { p: Mc, l: 'M_c' }].forEach(({ p, l }) => {
      cumulativeTikz += `  \\fill[violet!70!black] (${p[0].toFixed(3)},${p[1].toFixed(3)}) circle (0.04);\n`;
      const lp = exteriorLabelPosition(p, p, maCent, labelOffset);
      cumulativeTikz += `  \\node[violet!70!black] at (${lp.x.toFixed(3)},${lp.y.toFixed(3)}) {$${l}$};\n`;
    });
    steps.push({
      step: steps.length + 1,
      title: 'Triunghiul median',
      explanation: 'Triunghiul median MaMbMc are laturile paralele cu laturile triunghiului original și egale cu jumătatea lor.',
      elements_added: ['median_triangle'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // ── NEW: mediatoare ────────────────────────────────────────────────────────────
  const showPerpBis = input.show_perpendicular_bisectors;
  if (showPerpBis) {
    const flags: [boolean, boolean, boolean] =
      Array.isArray(showPerpBis)
        ? [showPerpBis[0] ?? true, showPerpBis[1] ?? true, showPerpBis[2] ?? true]
        : [true, true, true];

    const sides: Array<['a' | 'b' | 'c', boolean]> = [['a', flags[0]], ['b', flags[1]], ['c', flags[2]]];
    // Extend length relative to triangle size
    const extLen = (triangle.sideA + triangle.sideB + triangle.sideC) / 15;
    for (const [side, show] of sides) {
      if (!show) continue;
      const bisec = perpendicularBisector(triangle, side, extLen);
      cumulativeTikz += `  \\draw[thick, orange!80!black] (${bisec.start[0].toFixed(3)},${bisec.start[1].toFixed(3)}) -- (${bisec.end[0].toFixed(3)},${bisec.end[1].toFixed(3)});\n`;
      cumulativeTikz += `  \\fill[orange!80!black] (${bisec.midPt[0].toFixed(3)},${bisec.midPt[1].toFixed(3)}) circle (0.04);\n`;
    }
    // Circumcenter = intersection of perpendicular bisectors
    const oP = Tri.circumcenter(triangle);
    cumulativeTikz += `  \\fill[orange!80!black] (${oP[0].toFixed(3)},${oP[1].toFixed(3)}) circle (0.06);\n`;
    cumulativeTikz += `  \\node[right=2pt, orange!80!black] at (${oP[0].toFixed(3)},${oP[1].toFixed(3)}) {$O$};\n`;
    points['O'] = oP;
    steps.push({
      step: steps.length + 1,
      title: 'Mediatoarele',
      explanation: 'Mediatoarele laturilor se intersectează în circumcentrul O — centrul cercului circumscris.',
      elements_added: ['perpendicular_bisectors', 'O'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // ── NEW: centroid explicit ─────────────────────────────────────────────────────
  if (input.show_centroid) {
    const G = centroidPoint;
    cumulativeTikz += `  \\fill[green!50!black] (${G[0].toFixed(3)},${G[1].toFixed(3)}) circle (0.06);\n`;
    cumulativeTikz += `  \\node[right=2pt, green!50!black] at (${G[0].toFixed(3)},${G[1].toFixed(3)}) {$G$};\n`;
    points['G'] = G;
    steps.push({
      step: steps.length + 1,
      title: 'Centrul de greutate G',
      explanation: 'Centrul de greutate G este intersecția celor 3 mediane. Împarte fiecare mediană în raport 2:1 față de vârf.',
      elements_added: ['G'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Side labels using centroid-relative exterior position — always outside triangle,
  // parallel to each side. Extra offset when a foot-point letter already sits near the side.
  if (input.show_sides) {
    const fmt = input.side_label_format ?? 'value_only';
    const cons = input.constructions ?? [];
    const offsetA = cons.some(con => con.from === 'A') ? 0.55 : 0.3;
    const offsetB = cons.some(con => con.from === 'B') ? 0.55 : 0.3;
    const offsetC = cons.some(con => con.from === 'C') ? 0.55 : 0.3;
    const lpA = exteriorLabelPosition(B, C, centroidPoint, offsetA);
    const lpB = exteriorLabelPosition(C, A, centroidPoint, offsetB);
    const lpC = exteriorLabelPosition(A, B, centroidPoint, offsetC);
    cumulativeTikz += `  \\node[rotate=${lpA.rotation.toFixed(2)}] at (${lpA.x.toFixed(3)},${lpA.y.toFixed(3)}) {$${formatSideLabel('a', a, fmt)}$};\n`;
    cumulativeTikz += `  \\node[rotate=${lpB.rotation.toFixed(2)}] at (${lpB.x.toFixed(3)},${lpB.y.toFixed(3)}) {$${formatSideLabel('b', b, fmt)}$};\n`;
    cumulativeTikz += `  \\node[rotate=${lpC.rotation.toFixed(2)}] at (${lpC.x.toFixed(3)},${lpC.y.toFixed(3)}) {$${formatSideLabel('c', c, fmt)}$};\n`;
  }

  // Angle labels: show_angle_values auto-fills, angle_labels allows custom/override.
  const effectiveAngleLabels = [...(input.angle_labels ?? [])];
  if (input.show_angle_values) {
    for (const v of ['A', 'B', 'C'] as const) {
      if (rightAngles.includes(v)) continue; // right angle already marked with square
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

  // Intersection angle labels: arc + text at the crossing of two construction lines.
  for (const ial of (input.intersection_angle_labels ?? [])) {
    const ep1 = conEndpoints.get(ial.between[0]);
    const ep2 = conEndpoints.get(ial.between[1]);
    if (!ep1 || !ep2) continue;
    const P = lineIntersection(ep1[0], ep1[1], ep2[0], ep2[1]);
    if (!P) continue;
    cumulativeTikz +=
      '  ' +
      Markers.angleLabelTikz(P as Point, ep1[0], ep2[0], ial.text, {
        show_arc: ial.show_arc,
        arc_radius: ial.arc_radius,
        color: ial.color,
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
