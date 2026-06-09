import type { Point } from './types';

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function pt(center: Point, radius: number, angleDeg: number): Point {
  return [
    center[0] + radius * Math.cos(deg2rad(angleDeg)),
    center[1] + radius * Math.sin(deg2rad(angleDeg)),
  ];
}

function fmt(n: number, d = 3): string {
  return n.toFixed(d);
}

export function chordEndpoints(
  center: Point,
  radius: number,
  angle1Deg: number,
  angle2Deg: number,
): [Point, Point] {
  return [pt(center, radius, angle1Deg), pt(center, radius, angle2Deg)];
}

export function tangentPointsFromExternal(
  center: Point,
  radius: number,
  externalPoint: Point,
): [Point, Point] {
  const dx = externalPoint[0] - center[0];
  const dy = externalPoint[1] - center[1];
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= radius) throw new Error('Point must be outside the circle');
  const alpha = Math.atan2(dy, dx);
  const delta = Math.acos(radius / d);
  return [
    [
      center[0] + radius * Math.cos(alpha - delta - Math.PI / 2),
      center[1] + radius * Math.sin(alpha - delta - Math.PI / 2),
    ],
    [
      center[0] + radius * Math.cos(alpha + delta + Math.PI / 2),
      center[1] + radius * Math.sin(alpha + delta + Math.PI / 2),
    ],
  ];
}

export function secantIntersections(
  center: Point,
  radius: number,
  externalPoint: Point,
  angleDeg: number,
): [Point, Point] | null {
  const cosA = Math.cos(deg2rad(angleDeg));
  const sinA = Math.sin(deg2rad(angleDeg));
  const dx = externalPoint[0] - center[0];
  const dy = externalPoint[1] - center[1];
  const b = 2 * (dx * cosA + dy * sinA);
  const cc = dx * dx + dy * dy - radius * radius;
  const disc = b * b - 4 * cc;
  if (disc < 0) return null;
  const t1 = (-b - Math.sqrt(disc)) / 2;
  const t2 = (-b + Math.sqrt(disc)) / 2;
  return [
    [externalPoint[0] + t1 * cosA, externalPoint[1] + t1 * sinA],
    [externalPoint[0] + t2 * cosA, externalPoint[1] + t2 * sinA],
  ];
}

export function arcLength(radius: number, centralAngleDeg: number): number {
  return radius * deg2rad(centralAngleDeg);
}

export function sectorArea(radius: number, centralAngleDeg: number): number {
  return 0.5 * radius * radius * deg2rad(centralAngleDeg);
}

export function segmentArea(radius: number, centralAngleDeg: number): number {
  const theta = deg2rad(centralAngleDeg);
  return 0.5 * radius * radius * (theta - Math.sin(theta));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CircleAdvancedInput {
  radius: number;
  center?: Point;

  show_center?: boolean;
  show_radius?: boolean;
  radius_label?: string;

  chords?: Array<{
    angle1: number;
    angle2: number;
    label_endpoints?: [string, string];
    label_chord?: string;
    show_perpendicular_from_center?: boolean;
  }>;

  tangents?: Array<{
    from_external_point: Point;
    show_both?: boolean;
    label_point?: string;
    label_tangent_points?: [string, string];
  }>;

  secants?: Array<{
    through_external_point: Point;
    angle: number;
    label_intersections?: [string, string];
  }>;

  diameters?: Array<{
    angle: number;
    label_endpoints?: [string, string];
  }>;

  highlight_arc?: {
    angle1: number;
    angle2: number;
    color?: string;
    label?: string;
  };

  highlight_sector?: {
    angle1: number;
    angle2: number;
    fill_color?: string;
    label?: string;
  };
}

export interface CircleAdvancedOutput {
  tikz: string;
  points: Record<string, Point>;
  computed: {
    chord_lengths?: number[];
    tangent_lengths?: number[];
    arc_length?: number;
    sector_area?: number;
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;
  }>;
}

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateCircleAdvanced(input: CircleAdvancedInput): CircleAdvancedOutput {
  const center: Point = input.center ?? [0, 0];
  const r = input.radius;
  const [cx, cy] = center;

  const points: Record<string, Point> = { O: center };
  const computed: CircleAdvancedOutput['computed'] = {};
  const steps: CircleAdvancedOutput['construction_steps'] = [];

  const base = `\\begin{tikzpicture}\n`;
  let cum = base;

  // Step 1: Circle + center + radius
  cum += `  \\draw[thick] (${fmt(cx)},${fmt(cy)}) circle (${fmt(r)});\n`;
  if (input.show_center !== false) {
    cum += `  \\fill (${fmt(cx)},${fmt(cy)}) circle (0.05);\n`;
    cum += `  \\node[below left] at (${fmt(cx)},${fmt(cy)}) {$O$};\n`;
  }
  if (input.show_radius) {
    const rEnd: Point = [cx + r, cy];
    const rLbl = input.radius_label ?? 'r';
    cum += `  \\draw[thick] (${fmt(cx)},${fmt(cy)}) -- (${fmt(rEnd[0])},${fmt(rEnd[1])}) node[midway, above] {$${rLbl}$};\n`;
    points['R'] = rEnd;
  }

  steps.push({
    step: 1,
    title: 'Cercul',
    explanation: `Trasăm cercul cu centrul O și raza r = ${r}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Step 2: Chords
  const chordLengths: number[] = [];
  for (const ch of input.chords ?? []) {
    const [A, B] = chordEndpoints(center, r, ch.angle1, ch.angle2);
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    chordLengths.push(len);

    cum += `  \\draw[thick] (${fmt(A[0])},${fmt(A[1])}) -- (${fmt(B[0])},${fmt(B[1])});\n`;
    cum += `  \\fill (${fmt(A[0])},${fmt(A[1])}) circle (0.05);\n`;
    cum += `  \\fill (${fmt(B[0])},${fmt(B[1])}) circle (0.05);\n`;

    if (ch.label_endpoints) {
      const [lA, lB] = ch.label_endpoints;
      const offA = [A[0] - cx, A[1] - cy];
      const offB = [B[0] - cx, B[1] - cy];
      const ancA = offA[1] > 0 ? 'above' : 'below';
      const ancB = offB[1] > 0 ? 'above' : 'below';
      cum += `  \\node[${ancA}] at (${fmt(A[0])},${fmt(A[1])}) {$${lA}$};\n`;
      cum += `  \\node[${ancB}] at (${fmt(B[0])},${fmt(B[1])}) {$${lB}$};\n`;
      if (lA) points[lA] = A;
      if (lB) points[lB] = B;
    }

    if (ch.label_chord) {
      const midX = (A[0] + B[0]) / 2;
      const midY = (A[1] + B[1]) / 2;
      cum += `  \\node[above right] at (${fmt(midX)},${fmt(midY)}) {$${ch.label_chord}$};\n`;
    }

    if (ch.show_perpendicular_from_center) {
      const midX = (A[0] + B[0]) / 2;
      const midY = (A[1] + B[1]) / 2;
      cum += `  \\draw[dashed] (${fmt(cx)},${fmt(cy)}) -- (${fmt(midX)},${fmt(midY)});\n`;
    }
  }
  if (chordLengths.length) computed.chord_lengths = chordLengths;

  if ((input.chords ?? []).length > 0) {
    steps.push({
      step: 2,
      title: 'Coarde',
      explanation: 'Trasăm coardele pe cerc.',
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 3: Tangents
  const tangentLengths: number[] = [];
  for (const tg of input.tangents ?? []) {
    const P = tg.from_external_point;
    try {
      const [T1, T2] = tangentPointsFromExternal(center, r, P);
      const dx = T1[0] - P[0];
      const dy = T1[1] - P[1];
      tangentLengths.push(Math.sqrt(dx * dx + dy * dy));

      if (tg.label_point) {
        cum += `  \\fill (${fmt(P[0])},${fmt(P[1])}) circle (0.05) node[right] {$${tg.label_point}$};\n`;
        points[tg.label_point] = P;
      }

      cum += `  \\draw[thick] (${fmt(P[0])},${fmt(P[1])}) -- (${fmt(T1[0])},${fmt(T1[1])});\n`;
      cum += `  \\fill (${fmt(T1[0])},${fmt(T1[1])}) circle (0.05);\n`;

      if (tg.show_both !== false) {
        cum += `  \\draw[thick] (${fmt(P[0])},${fmt(P[1])}) -- (${fmt(T2[0])},${fmt(T2[1])});\n`;
        cum += `  \\fill (${fmt(T2[0])},${fmt(T2[1])}) circle (0.05);\n`;
      }

      if (tg.label_tangent_points) {
        const [l1, l2] = tg.label_tangent_points;
        const a1 = T1[1] > cy ? 'above' : 'below';
        const a2 = T2[1] > cy ? 'above' : 'below';
        cum += `  \\node[${a1}] at (${fmt(T1[0])},${fmt(T1[1])}) {$${l1}$};\n`;
        cum += `  \\node[${a2}] at (${fmt(T2[0])},${fmt(T2[1])}) {$${l2}$};\n`;
        if (l1) points[l1] = T1;
        if (l2) points[l2] = T2;
      }
    } catch {
      // external point inside circle — skip
    }
  }
  if (tangentLengths.length) computed.tangent_lengths = tangentLengths;

  if ((input.tangents ?? []).length > 0) {
    steps.push({
      step: 3,
      title: 'Tangente',
      explanation: 'Trasăm tangentele din punctele exterioare.',
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 4: Secants
  for (const sc of input.secants ?? []) {
    const pts = secantIntersections(center, r, sc.through_external_point, sc.angle);
    if (!pts) continue;
    const [I1, I2] = pts;
    const P = sc.through_external_point;

    cum += `  \\draw[thick] (${fmt(P[0])},${fmt(P[1])}) -- (${fmt(I1[0])},${fmt(I1[1])});\n`;
    cum += `  \\draw[thick] (${fmt(P[0])},${fmt(P[1])}) -- (${fmt(I2[0])},${fmt(I2[1])});\n`;
    cum += `  \\fill (${fmt(I1[0])},${fmt(I1[1])}) circle (0.05);\n`;
    cum += `  \\fill (${fmt(I2[0])},${fmt(I2[1])}) circle (0.05);\n`;

    if (sc.label_intersections) {
      const [l1, l2] = sc.label_intersections;
      cum += `  \\node[above right] at (${fmt(I1[0])},${fmt(I1[1])}) {$${l1}$};\n`;
      cum += `  \\node[above right] at (${fmt(I2[0])},${fmt(I2[1])}) {$${l2}$};\n`;
      if (l1) points[l1] = I1;
      if (l2) points[l2] = I2;
    }
  }

  if ((input.secants ?? []).length > 0) {
    steps.push({
      step: 4,
      title: 'Secante',
      explanation: 'Trasăm secantele.',
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 5: Diameters
  for (const d of input.diameters ?? []) {
    const E = pt(center, r, d.angle);
    const F = pt(center, r, d.angle + 180);
    cum += `  \\draw[thick] (${fmt(E[0])},${fmt(E[1])}) -- (${fmt(F[0])},${fmt(F[1])});\n`;
    cum += `  \\fill (${fmt(E[0])},${fmt(E[1])}) circle (0.05);\n`;
    cum += `  \\fill (${fmt(F[0])},${fmt(F[1])}) circle (0.05);\n`;
    if (d.label_endpoints) {
      const [l1, l2] = d.label_endpoints;
      const a1 = E[1] > cy ? 'above' : 'below';
      const a2 = F[1] > cy ? 'above' : 'below';
      cum += `  \\node[${a1}] at (${fmt(E[0])},${fmt(E[1])}) {$${l1}$};\n`;
      cum += `  \\node[${a2}] at (${fmt(F[0])},${fmt(F[1])}) {$${l2}$};\n`;
      if (l1) points[l1] = E;
      if (l2) points[l2] = F;
    }
  }

  // Step 6: Arc / Sector highlights
  if (input.highlight_arc) {
    const arc = input.highlight_arc;
    const color = arc.color ?? 'blue';
    const a1 = arc.angle1;
    let a2 = arc.angle2;
    if (a2 < a1) a2 += 360;
    cum += `  \\draw[${color}, ultra thick] (${fmt(cx)},${fmt(cy)}) ++(${fmt(a1)}:${fmt(r)}) arc (${fmt(a1)}:${fmt(a2)}:${fmt(r)});\n`;
    if (arc.label) {
      const midAngle = (a1 + a2) / 2;
      const lx = cx + (r + 0.3) * Math.cos(deg2rad(midAngle));
      const ly = cy + (r + 0.3) * Math.sin(deg2rad(midAngle));
      cum += `  \\node[${color}] at (${fmt(lx)},${fmt(ly)}) {$${arc.label}$};\n`;
    }
    computed.arc_length = arcLength(r, a2 - a1);
  }

  if (input.highlight_sector) {
    const sec = input.highlight_sector;
    const color = sec.fill_color ?? 'blue!20';
    const a1 = sec.angle1;
    let a2 = sec.angle2;
    if (a2 < a1) a2 += 360;
    cum += `  \\fill[${color}] (${fmt(cx)},${fmt(cy)}) -- ++(${fmt(a1)}:${fmt(r)}) arc (${fmt(a1)}:${fmt(a2)}:${fmt(r)}) -- cycle;\n`;
    if (sec.label) {
      const midAngle = (a1 + a2) / 2;
      const lx = cx + (r * 0.6) * Math.cos(deg2rad(midAngle));
      const ly = cy + (r * 0.6) * Math.sin(deg2rad(midAngle));
      cum += `  \\node at (${fmt(lx)},${fmt(ly)}) {$${sec.label}$};\n`;
    }
    computed.sector_area = sectorArea(r, a2 - a1);
  }

  if (input.highlight_arc || input.highlight_sector) {
    steps.push({
      step: steps.length + 1,
      title: 'Arc / Sector',
      explanation: 'Evidențiem arcul sau sectorul de cerc.',
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed,
    construction_steps: steps,
  };
}
