import type { Point } from './types';

function deg2rad(d: number) {
  return (d * Math.PI) / 180;
}
function fmt(n: number, digits = 3) {
  return n.toFixed(digits);
}

// ─── Math helpers ───────────────────────────────────────────────────────────

export function regularPolygonVertices(
  sides: number,
  radius: number,
  center: Point = [0, 0],
  startAngleDeg = 90,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const a = deg2rad(startAngleDeg - (360 * i) / sides);
    pts.push([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)]);
  }
  return pts;
}

export function apothem(sides: number, radius: number): number {
  return radius * Math.cos(Math.PI / sides);
}

export function centralAngle(sides: number): number {
  return 360 / sides;
}

export function polygonArea(sides: number, radius: number): number {
  return 0.5 * sides * radius * radius * Math.sin((2 * Math.PI) / sides);
}

export function polygonPerimeter(sides: number, radius: number): number {
  return 2 * sides * radius * Math.sin(Math.PI / sides);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RegularPolygonInput {
  sides: number;
  radius: number;
  center?: Point;
  start_angle?: number;

  show_circumcircle?: boolean;
  show_incircle?: boolean;
  show_radii?: boolean;
  show_apothem?: boolean;
  show_diagonals_from_vertex?: number;
  label_vertices?: boolean;
  show_central_angles?: boolean;
}

export interface RegularPolygonOutput {
  tikz: string;
  points: Record<string, Point>;
  computed: {
    apothem: number;
    central_angle: number;
    interior_angle: number;
    area: number;
    perimeter: number;
    side_length: number;
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;
  }>;
}

// ─── Vertex labels ──────────────────────────────────────────────────────────

function vertexLabel(i: number, n: number): string {
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  if (n <= 8) return labels[i] ?? `V_{${i + 1}}`;
  return `V_{${i + 1}}`;
}

// ─── Generator ──────────────────────────────────────────────────────────────

export function generateRegularPolygonAdvanced(input: RegularPolygonInput): RegularPolygonOutput {
  const n = input.sides;
  const r = input.radius;
  const center: Point = input.center ?? [0, 0];
  const startAngle = input.start_angle ?? 90;
  const [cx, cy] = center;

  const verts = regularPolygonVertices(n, r, center, startAngle);
  const ap = apothem(n, r);
  const ca = centralAngle(n);
  const interiorAngle = ((n - 2) * 180) / n;
  const area = polygonArea(n, r);
  const perim = polygonPerimeter(n, r);
  const sideLen = 2 * r * Math.sin(Math.PI / n);

  const points: Record<string, Point> = { O: center };
  for (let i = 0; i < n; i++) {
    points[vertexLabel(i, n)] = verts[i];
  }

  const steps: RegularPolygonOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Step 1: circumcircle (optional) + polygon outline
  if (input.show_circumcircle) {
    cum += `  \\draw[dashed, gray] (${fmt(cx)},${fmt(cy)}) circle (${fmt(r)});\n`;
  }

  // Outline
  const pathPts = verts.map((p) => `(${fmt(p[0])},${fmt(p[1])})`).join(' -- ');
  cum += `  \\draw[thick] ${pathPts} -- cycle;\n`;

  // Center
  cum += `  \\fill (${fmt(cx)},${fmt(cy)}) circle (0.04) node[below] {$O$};\n`;

  // Labels
  if (input.label_vertices !== false) {
    for (let i = 0; i < n; i++) {
      const p = verts[i];
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      const anc = dy > 0.01 ? (dx < -0.01 ? 'above left' : 'above right') : (dx < -0.01 ? 'below left' : 'below right');
      cum += `  \\node[${anc}] at (${fmt(p[0])},${fmt(p[1])}) {$${vertexLabel(i, n)}$};\n`;
      cum += `  \\fill (${fmt(p[0])},${fmt(p[1])}) circle (0.04);\n`;
    }
  }

  steps.push({
    step: 1,
    title: `Poligon regulat cu ${n} laturi`,
    explanation: `Poligon regulat cu ${n} laturi, raza circumscrisă R = ${r}, unghiul interior = ${interiorAngle.toFixed(1)}°.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Step 2: incircle
  if (input.show_incircle) {
    cum += `  \\draw[dashed, blue] (${fmt(cx)},${fmt(cy)}) circle (${fmt(ap)});\n`;
    steps.push({
      step: 2,
      title: 'Cercul înscris',
      explanation: `Raza cercului înscris (apotema) a = ${ap.toFixed(3)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 3: radii from center
  if (input.show_radii) {
    for (let i = 0; i < n; i++) {
      cum += `  \\draw[thin, gray] (${fmt(cx)},${fmt(cy)}) -- (${fmt(verts[i][0])},${fmt(verts[i][1])});\n`;
    }
    steps.push({
      step: steps.length + 1,
      title: 'Razele',
      explanation: `Razele de la centru O la vârfuri, R = ${r}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 4: apothem (first one)
  if (input.show_apothem) {
    const firstSideMid: Point = [
      (verts[0][0] + verts[1][0]) / 2,
      (verts[0][1] + verts[1][1]) / 2,
    ];
    cum += `  \\draw[blue] (${fmt(cx)},${fmt(cy)}) -- (${fmt(firstSideMid[0])},${fmt(firstSideMid[1])}) node[midway, right] {$a=${fmt(ap, 2)}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Apotema',
      explanation: `Apotema a = R·cos(π/${n}) = ${ap.toFixed(3)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 5: diagonals from one vertex
  if (input.show_diagonals_from_vertex !== undefined && input.show_diagonals_from_vertex < n) {
    const v = input.show_diagonals_from_vertex;
    for (let i = 0; i < n; i++) {
      if (i === v || i === (v + 1) % n || i === (v - 1 + n) % n) continue;
      cum += `  \\draw[dashed, gray] (${fmt(verts[v][0])},${fmt(verts[v][1])}) -- (${fmt(verts[i][0])},${fmt(verts[i][1])});\n`;
    }
    steps.push({
      step: steps.length + 1,
      title: `Diagonalele din ${vertexLabel(v, n)}`,
      explanation: `Diagonalele din vârful ${vertexLabel(v, n)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 6: central angles
  if (input.show_central_angles && input.show_radii) {
    const arcR = r * 0.3;
    const a0 = startAngle;
    cum += `  \\draw[thin, orange] (${fmt(cx)},${fmt(cy)}) ++(${fmt(a0)}:${fmt(arcR)}) arc (${fmt(a0)}:${fmt(a0 - ca)}:${fmt(arcR)});\n`;
    const midA = a0 - ca / 2;
    const lx = cx + arcR * 1.4 * Math.cos(deg2rad(midA));
    const ly = cy + arcR * 1.4 * Math.sin(deg2rad(midA));
    cum += `  \\node[orange, small] at (${fmt(lx)},${fmt(ly)}) {$${fmt(ca, 1)}°$};\n`;
  }

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: {
      apothem: ap,
      central_angle: ca,
      interior_angle: interiorAngle,
      area,
      perimeter: perim,
      side_length: sideLen,
    },
    construction_steps: steps,
  };
}
