/**
 * dihedralAngle.ts — Dihedral angle between two planes.
 * Visualized as two half-planes meeting at an edge with the angle arc.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface DihedralAngleInput {
  angle_deg: number;          // dihedral angle in degrees
  edge_length?: number;       // length of the common edge (default 3)
  plane_width?: number;       // width of each half-plane shown (default 2.5)
  label_edge?: string;        // label on common edge (default 'l')
  label_planes?: [string, string]; // labels for the two planes
  show_perpendicular?: boolean; // show the perpendicular lines defining the angle
}

export function generateDihedralAngle(input: DihedralAngleInput): GraphOutput {
  const theta = (input.angle_deg * Math.PI) / 180;
  const L = input.edge_length ?? 3;
  const W = input.plane_width ?? 2.5;
  const labelEdge = input.label_edge ?? 'l';
  const [labelP1, labelP2] = input.label_planes ?? ['\\alpha', '\\beta'];

  // Projection: draw in 2D
  // Edge along y-axis: (0,0) to (0,L)
  // Two half planes: one goes right (angle 0), one at angle theta
  // Plane 1: from edge, extends in direction (1,0)
  // Plane 2: from edge, extends in direction (cos θ, sin θ) rotated from "right"

  // For visual, we place the edge slightly tilted for 3D feel
  const edgeTilt = 0.3; // how much z-perspective to add

  // Edge from (0,0) to (edgeTilt·L, L)
  const ex = edgeTilt * L;
  const ey = L;

  // Point on edge (midpoint) for angle visualization
  const midX = ex / 2;
  const midY = ey / 2;

  // Plane 1 perpendicular at midpoint: goes right (positive x)
  const p1x = midX + W;
  const p1y = midY;

  // Plane 2 perpendicular: rotated by theta from plane 1 direction
  const p2x = midX + W * Math.cos(theta);
  const p2y = midY + W * Math.sin(theta);

  let tikz = `\\begin{tikzpicture}[scale=1.0, >=stealth]\n`;

  // Plane 1 region (light blue)
  tikz += `  \\fill[blue!10] (0,0) -- (${fmt(ex)},${fmt(ey)}) -- (${fmt(ex + W)},${fmt(ey)}) -- (${fmt(W)},0) -- cycle;\n`;
  tikz += `  \\draw[blue!50, thick] (0,0) -- (${fmt(W)},0) -- (${fmt(ex + W)},${fmt(ey)}) -- (${fmt(ex)},${fmt(ey)});\n`;
  tikz += `  \\node[blue!70, font=\\small] at (${fmt(W * 0.6)},${fmt(ey * 0.4)}) {$${labelP1}$};\n`;

  // Plane 2 region (green)
  const p2rx = W * Math.cos(theta);
  const p2ry = W * Math.sin(theta);
  tikz += `  \\fill[green!10] (0,0) -- (${fmt(ex)},${fmt(ey)}) -- (${fmt(ex + p2rx)},${fmt(ey + p2ry)}) -- (${fmt(p2rx)},${fmt(p2ry)}) -- cycle;\n`;
  tikz += `  \\draw[green!60!black, thick] (0,0) -- (${fmt(p2rx)},${fmt(p2ry)}) -- (${fmt(ex + p2rx)},${fmt(ey + p2ry)}) -- (${fmt(ex)},${fmt(ey)});\n`;
  tikz += `  \\node[green!60!black, font=\\small] at (${fmt(p2rx * 0.6)},${fmt(p2ry * 0.6 + ey * 0.3)}) {$${labelP2}$};\n`;

  // Common edge
  tikz += `  \\draw[black, very thick] (0,0) -- (${fmt(ex)},${fmt(ey)}) node[right] {$${labelEdge}$};\n`;

  // Perpendicular lines at midpoint
  if (input.show_perpendicular !== false) {
    tikz += `  \\draw[blue!70, thick, ->] (${fmt(midX)},${fmt(midY)}) -- (${fmt(p1x)},${fmt(p1y)}) node[right] {$m_1$};\n`;
    tikz += `  \\draw[green!60!black, thick, ->] (${fmt(midX)},${fmt(midY)}) -- (${fmt(p2x)},${fmt(p2y)}) node[above right] {$m_2$};\n`;
    // Right angle marker on plane 1 perp
    tikz += `  \\draw[gray, thin] (${fmt(midX + 0.15)},${fmt(midY)}) -- (${fmt(midX + 0.15)},${fmt(midY + 0.15)}) -- (${fmt(midX)},${fmt(midY + 0.15)});\n`;
  }

  // Angle arc
  const arcR = W * 0.25;
  tikz += `  \\draw[red!80!black, thick] (${fmt(midX + arcR)},${fmt(midY)}) arc (0:${fmt(input.angle_deg)}:${fmt(arcR)}) node[midway, right, font=\\small] {$${fmtLabel(input.angle_deg)}°$};\n`;

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      dihedral_angle_deg: input.angle_deg,
      dihedral_angle_rad: parseFloat(theta.toFixed(6)),
    },
  };
}
