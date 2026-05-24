/**
 * triangleTrig.ts — Right triangle with trig ratios labeled.
 * Supports both right triangle and general triangle with law of sines/cosines.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface RightTriangleTrigInput {
  /** Angle in degrees at vertex A (one of the acute angles) */
  angle_deg: number;
  /** Length of the hypotenuse (default 5) */
  hypotenuse?: number;
  show_angle_labels?: boolean;
  show_side_labels?: boolean;
  show_trig_ratios?: boolean;  // box with sin/cos/tan values
  show_right_angle_marker?: boolean;
  angle_vertex?: 'A' | 'B';   // which acute angle is labeled (default 'A')
}

export interface GeneralTriangleTrigInput {
  /** Sides a, b, c (opposite to angles A, B, C) */
  side_a?: number;
  side_b?: number;
  side_c?: number;
  /** Angles in degrees */
  angle_A?: number;
  angle_B?: number;
  show_law_of_sines?: boolean;
  show_law_of_cosines?: boolean;
}

export function generateRightTriangleTrig(input: RightTriangleTrigInput): GraphOutput {
  const theta = (input.angle_deg * Math.PI) / 180;
  const hyp = input.hypotenuse ?? 5;
  const adj = hyp * Math.cos(theta);
  const opp = hyp * Math.sin(theta);

  // Right angle at C (bottom right), angle at A (bottom left), angle at B (top right)
  // A=(0,0), B=(adj,opp), C=(adj,0)
  const A: [number, number] = [0, 0];
  const B: [number, number] = [adj, opp];
  const C: [number, number] = [adj, 0];

  let tikz = `\\begin{tikzpicture}[scale=1.0]\n`;

  // Triangle
  tikz += `  \\draw[thick] (${fmt(A[0])},${fmt(A[1])}) -- (${fmt(B[0])},${fmt(B[1])}) -- (${fmt(C[0])},${fmt(C[1])}) -- cycle;\n`;

  // Right angle marker at C
  if (input.show_right_angle_marker !== false) {
    const sz = hyp * 0.06;
    tikz += `  \\draw (${fmt(adj - sz)},0) -- (${fmt(adj - sz)},${fmt(sz)}) -- (${fmt(adj)},${fmt(sz)});\n`;
  }

  // Side labels
  if (input.show_side_labels !== false) {
    // Hypotenuse AB: midpoint + offset
    tikz += `  \\node[above left] at (${fmt(adj / 2)},${fmt(opp / 2)}) {$c=${fmtLabel(hyp)}$};\n`;
    // Adjacent AC: midpoint below
    tikz += `  \\node[below] at (${fmt(adj / 2)},0) {$b=${fmtLabel(adj)}$};\n`;
    // Opposite BC: midpoint right
    tikz += `  \\node[right] at (${fmt(adj)},${fmt(opp / 2)}) {$a=${fmtLabel(opp)}$};\n`;
  }

  // Vertex labels
  tikz += `  \\node[left] at (0,0) {$A$};\n`;
  tikz += `  \\node[above] at (${fmt(adj)},${fmt(opp)}) {$B$};\n`;
  tikz += `  \\node[right] at (${fmt(adj)},0) {$C$};\n`;

  // Angle arc at A
  if (input.show_angle_labels !== false) {
    const arcR = hyp * 0.12;
    tikz += `  \\draw[orange!80!black] (${fmt(arcR)},0) arc (0:${fmt(input.angle_deg)}:${fmt(arcR)});\n`;
    tikz += `  \\node[orange!80!black, right] at (${fmt(arcR * 1.1)},${fmt(arcR * 0.5)}) {$${fmtLabel(input.angle_deg)}°$};\n`;
    // Complementary angle at B
    const compAngle = 90 - input.angle_deg;
    tikz += `  \\node[gray, below left, font=\\small] at (${fmt(adj)},${fmt(opp)}) {$${fmtLabel(compAngle)}°$};\n`;
  }

  // Trig ratios table
  const sinVal = parseFloat(Math.sin(theta).toFixed(4));
  const cosVal = parseFloat(Math.cos(theta).toFixed(4));
  const tanVal = parseFloat(Math.tan(theta).toFixed(4));

  if (input.show_trig_ratios !== false) {
    const boxX = adj + hyp * 0.15;
    const boxY = opp * 0.5;
    tikz += `  \\node[draw, rounded corners, fill=blue!5, align=left, font=\\small, inner sep=5pt] at (${fmt(boxX + 1.5)},${fmt(boxY)}) {\n`;
    tikz += `    $\\sin ${fmtLabel(input.angle_deg)}° = \\dfrac{a}{c} = \\dfrac{${fmtLabel(opp)}}{${fmtLabel(hyp)}} = ${sinVal}$\\\\[4pt]\n`;
    tikz += `    $\\cos ${fmtLabel(input.angle_deg)}° = \\dfrac{b}{c} = \\dfrac{${fmtLabel(adj)}}{${fmtLabel(hyp)}} = ${cosVal}$\\\\[4pt]\n`;
    tikz += `    $\\tan ${fmtLabel(input.angle_deg)}° = \\dfrac{a}{b} = \\dfrac{${fmtLabel(opp)}}{${fmtLabel(adj)}} = ${tanVal}$\n`;
    tikz += `  };\n`;
  }

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      angle_A_deg: input.angle_deg,
      angle_B_deg: 90 - input.angle_deg,
      hypotenuse: hyp,
      opposite: parseFloat(opp.toFixed(4)),
      adjacent: parseFloat(adj.toFixed(4)),
      sin: sinVal,
      cos: cosVal,
      tan: tanVal,
    },
  };
}
