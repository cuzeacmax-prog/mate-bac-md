/**
 * projections3D.ts — Orthogonal projection of points onto planes.
 * Shows a cube or rectangular prism with projection of a space point
 * onto a face, edge, or the base plane.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

// Cabinet projection: (x,y,z) → 2D
function cab(x: number, y: number, z: number, scale = 0.45, angleDeg = 30): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [x + scale * z * Math.cos(a), y + scale * z * Math.sin(a)];
}

export interface Projection3DInput {
  /** Prism dimensions */
  width?: number;   // a (x-direction)
  depth?: number;   // b (z-direction)
  height?: number;  // c (y-direction)
  /** Point to project */
  point?: { x: number; y: number; z: number; label?: string };
  /** Projection target */
  project_onto?: 'base' | 'front_face' | 'side_face' | 'edge';
  show_projection_lines?: boolean;
  show_labels?: boolean;
}

export function generateProjection3D(input: Projection3DInput): GraphOutput {
  const a = input.width ?? 4;
  const b = input.depth ?? 3;
  const c = input.height ?? 3;

  // 8 vertices of the prism A(0,0,0) B(a,0,0) C(a,0,b) D(0,0,b)
  // A'(0,c,0) B'(a,c,0) C'(a,c,b) D'(0,c,b)
  const verts = {
    A: cab(0, 0, 0), B: cab(a, 0, 0), C: cab(a, 0, b), D: cab(0, 0, b),
    Ap: cab(0, c, 0), Bp: cab(a, c, 0), Cp: cab(a, c, b), Dp: cab(0, c, b),
  };

  let tikz = `\\begin{tikzpicture}[scale=0.8, >=stealth]\n`;

  // Hidden edges
  tikz += `  \\draw[black!30, dashed, thin] (${fmt(verts.A[0])},${fmt(verts.A[1])}) -- (${fmt(verts.B[0])},${fmt(verts.B[1])});\n`;
  tikz += `  \\draw[black!30, dashed, thin] (${fmt(verts.A[0])},${fmt(verts.A[1])}) -- (${fmt(verts.D[0])},${fmt(verts.D[1])});\n`;
  tikz += `  \\draw[black!30, dashed, thin] (${fmt(verts.A[0])},${fmt(verts.A[1])}) -- (${fmt(verts.Ap[0])},${fmt(verts.Ap[1])});\n`;

  // Visible edges
  const edges: Array<[keyof typeof verts, keyof typeof verts]> = [
    ['B', 'C'], ['C', 'D'], ['D', 'Dp'], ['Dp', 'Cp'], ['Cp', 'Bp'],
    ['Bp', 'Ap'], ['Ap', 'Dp'], ['B', 'Bp'], ['C', 'Cp'],
  ];
  for (const [u, v] of edges) {
    tikz += `  \\draw[black!70, thick] (${fmt(verts[u][0])},${fmt(verts[u][1])}) -- (${fmt(verts[v][0])},${fmt(verts[v][1])});\n`;
  }

  // Vertex labels
  if (input.show_labels !== false) {
    tikz += `  \\node[below left, font=\\small] at (${fmt(verts.A[0])},${fmt(verts.A[1])}) {$A$};\n`;
    tikz += `  \\node[below, font=\\small] at (${fmt(verts.B[0])},${fmt(verts.B[1])}) {$B$};\n`;
    tikz += `  \\node[right, font=\\small] at (${fmt(verts.C[0])},${fmt(verts.C[1])}) {$C$};\n`;
    tikz += `  \\node[left, font=\\small] at (${fmt(verts.D[0])},${fmt(verts.D[1])}) {$D$};\n`;
    tikz += `  \\node[above left, font=\\small] at (${fmt(verts.Ap[0])},${fmt(verts.Ap[1])}) {$A'$};\n`;
    tikz += `  \\node[above, font=\\small] at (${fmt(verts.Bp[0])},${fmt(verts.Bp[1])}) {$B'$};\n`;
    tikz += `  \\node[above right, font=\\small] at (${fmt(verts.Cp[0])},${fmt(verts.Cp[1])}) {$C'$};\n`;
    tikz += `  \\node[above left, font=\\small] at (${fmt(verts.Dp[0])},${fmt(verts.Dp[1])}) {$D'$};\n`;
  }

  // Project a point
  let computedProjection: Record<string, number | string> = {};
  if (input.point) {
    const { x: px, y: py, z: pz, label: plabel = 'P' } = input.point;
    const pp = cab(px, py, pz);

    tikz += `  \\filldraw[red] (${fmt(pp[0])},${fmt(pp[1])}) circle (0.09) node[above right, font=\\small] {$${plabel}$};\n`;

    const target = input.project_onto ?? 'base';
    let projX = px, projY = 0, projZ = pz;

    if (target === 'base') { projY = 0; }
    else if (target === 'front_face') { projZ = 0; }
    else if (target === 'side_face') { projX = 0; }

    const proj = cab(projX, projY, projZ);
    const projLabel = `${plabel}'`;

    tikz += `  \\filldraw[blue!70] (${fmt(proj[0])},${fmt(proj[1])}) circle (0.08) node[below right, font=\\small] {$${projLabel}$};\n`;

    if (input.show_projection_lines !== false) {
      tikz += `  \\draw[red!70, dashed, thick] (${fmt(pp[0])},${fmt(pp[1])}) -- (${fmt(proj[0])},${fmt(proj[1])});\n`;
    }

    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2 + (pz - projZ) ** 2);
    computedProjection = {
      point: `(${px}, ${py}, ${pz})`,
      projection: `(${projX}, ${projY}, ${projZ})`,
      distance: parseFloat(dist.toFixed(4)),
      target,
    };
  }

  // Dimension labels
  tikz += `  \\node[below, font=\\footnotesize] at (${fmt((verts.A[0] + verts.B[0]) / 2)},${fmt((verts.A[1] + verts.B[1]) / 2 - 0.1)}) {$a=${fmtLabel(a)}$};\n`;
  tikz += `  \\node[left, font=\\footnotesize] at (${fmt((verts.A[0] + verts.Ap[0]) / 2 - 0.1)},${fmt((verts.A[1] + verts.Ap[1]) / 2)}) {$c=${fmtLabel(c)}$};\n`;

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      dimensions: { width: a, depth: b, height: c },
      ...computedProjection,
    },
  };
}
