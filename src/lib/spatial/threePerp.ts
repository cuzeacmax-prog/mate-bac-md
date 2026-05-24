/**
 * threePerp.ts — Three perpendiculars theorem visualization.
 * If MA ⊥ plane α and AB ⊥ BC (B on α), then MB ⊥ BC.
 * Visualized with a rectangular prism / plane.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface ThreePerpInput {
  base_width?: number;     // width of the base plane shown
  base_depth?: number;     // depth of the base plane
  height?: number;         // height of point M above plane
  point_b_x?: number;      // x of foot B (0..base_width)
  point_b_z?: number;      // z of foot B (0..base_depth)
  point_c_x?: number;      // direction of BC in x
  point_c_z?: number;      // direction of BC in z
  show_labels?: boolean;
  show_right_angle_markers?: boolean;
}

function cab(x: number, y: number, z: number, scale = 0.45, angleDeg = 30): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [x + scale * z * Math.cos(a), y + scale * z * Math.sin(a)];
}

export function generateThreePerp(input: ThreePerpInput): GraphOutput {
  const W = input.base_width ?? 5;
  const D = input.base_depth ?? 4;
  const H = input.height ?? 3;
  const bx = input.point_b_x ?? W * 0.4;
  const bz = input.point_b_z ?? D * 0.4;

  // C direction (must be on the base plane, perpendicular to AB projected)
  // Default: BC goes in z-direction (perpendicular to xz diagonal)
  const cx = bx + (input.point_c_x ?? 1.5);
  const cz = bz + (input.point_c_z ?? 0);

  // Key points
  const M = cab(bx, H, bz);   // M above B
  const B = cab(bx, 0, bz);   // foot of M on plane
  const C = cab(cx, 0, cz);   // C on plane

  // Base plane corners
  const v1 = cab(0, 0, 0);
  const v2 = cab(W, 0, 0);
  const v3 = cab(W, 0, D);
  const v4 = cab(0, 0, D);

  let tikz = `\\begin{tikzpicture}[scale=0.85, >=stealth]\n`;

  // Base plane
  tikz += `  \\fill[blue!8] (${fmt(v1[0])},${fmt(v1[1])}) -- (${fmt(v2[0])},${fmt(v2[1])}) -- (${fmt(v3[0])},${fmt(v3[1])}) -- (${fmt(v4[0])},${fmt(v4[1])}) -- cycle;\n`;
  tikz += `  \\draw[blue!50, thin] (${fmt(v1[0])},${fmt(v1[1])}) -- (${fmt(v2[0])},${fmt(v2[1])}) -- (${fmt(v3[0])},${fmt(v3[1])}) -- (${fmt(v4[0])},${fmt(v4[1])}) -- cycle;\n`;
  tikz += `  \\node[blue!60, font=\\small] at (${fmt((v3[0] + v1[0]) / 2)},${fmt((v3[1] + v1[1]) / 2 - 0.2)}) {$\\alpha$};\n`;

  // MA (vertical, perpendicular to plane)
  tikz += `  \\draw[red!70, very thick] (${fmt(M[0])},${fmt(M[1])}) -- (${fmt(B[0])},${fmt(B[1])}) node[midway, left] {$MA \\perp \\alpha$};\n`;

  // BC (on the plane)
  tikz += `  \\draw[green!60!black, very thick, ->] (${fmt(B[0])},${fmt(B[1])}) -- (${fmt(C[0])},${fmt(C[1])}) node[below right] {$C$};\n`;

  // MB
  tikz += `  \\draw[orange!80!black, thick] (${fmt(M[0])},${fmt(M[1])}) -- (${fmt(C[0])},${fmt(C[1])});\n`;

  // MC (if A=B for simplicity)
  tikz += `  \\draw[violet, thick] (${fmt(M[0])},${fmt(M[1])}) -- (${fmt(C[0])},${fmt(C[1])});\n`;

  // Right angle markers
  if (input.show_right_angle_markers !== false) {
    // Right angle at B: MA ⊥ plane → right angle at B (bottom)
    const sz = 0.18;
    tikz += `  \\draw[red!60, thin] (${fmt(B[0] + sz)},${fmt(B[1])}) -- (${fmt(B[0] + sz)},${fmt(B[1] + sz)}) -- (${fmt(B[0])},${fmt(B[1] + sz)});\n`;
    // Right angle for BC ⊥ ... (approximate, show small square near C)
    const bc_dx = C[0] - B[0], bc_dy = C[1] - B[1];
    const bc_len = Math.sqrt(bc_dx * bc_dx + bc_dy * bc_dy);
    const ux = bc_dx / bc_len * sz, uy = bc_dy / bc_len * sz;
    tikz += `  \\draw[green!60!black, thin] (${fmt(C[0] - ux)},${fmt(C[1] - uy)}) -- (${fmt(C[0] - ux + uy)},${fmt(C[1] - uy - ux)}) -- (${fmt(C[0] + uy)},${fmt(C[1] - ux)});\n`;
  }

  // Labels
  if (input.show_labels !== false) {
    tikz += `  \\filldraw[red!70] (${fmt(M[0])},${fmt(M[1])}) circle (0.09) node[above right, font=\\small] {$M$};\n`;
    tikz += `  \\filldraw[blue!70] (${fmt(B[0])},${fmt(B[1])}) circle (0.09) node[below right, font=\\small] {$B$};\n`;
    tikz += `  \\filldraw[green!60!black] (${fmt(C[0])},${fmt(C[1])}) circle (0.09);\n`;

    // Theorem statement
    tikz += `  \\node[draw, rounded corners, fill=yellow!10, font=\\footnotesize, align=left, inner sep=4pt] at (${fmt(W * 0.72)},${fmt(H * 0.7)}) {\n`;
    tikz += `    $MA \\perp \\alpha$\\\\$AB \\perp BC$\\\\$\\Rightarrow MB \\perp BC$\n`;
    tikz += `  };\n`;
  }

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      point_M: `(${bx}, ${H}, ${bz})`,
      point_B: `(${bx}, 0, ${bz})`,
      point_C: `(${cx}, 0, ${cz})`,
      MB_length: parseFloat(Math.sqrt(bx ** 2 + H ** 2 + bz ** 2 - 2 * bx * bx - 2 * bz * bz + bx ** 2 + bz ** 2 + H ** 2 - H ** 2).toFixed(4)),
      height: H,
    },
  };
}
