/**
 * reduction.ts — Angle reduction formulas visualization.
 * Shows equivalent angle and reduction rule on the unit circle.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface AngleReductionInput {
  angle_deg: number;           // original angle (e.g. 150, 210, 330, -45)
  show_reference_angle?: boolean;
  show_reduction_formula?: boolean;
  show_quadrant_label?: boolean;
  radius?: number;
}

function canonicalize(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function quadrant(deg: number): 1 | 2 | 3 | 4 {
  const d = canonicalize(deg);
  if (d < 90) return 1;
  if (d < 180) return 2;
  if (d < 270) return 3;
  return 4;
}

function referenceAngle(deg: number): number {
  const d = canonicalize(deg);
  if (d <= 90) return d;
  if (d <= 180) return 180 - d;
  if (d <= 270) return d - 180;
  return 360 - d;
}

function reductionFormulas(deg: number): { sin: string; cos: string; tan: string } {
  const d = canonicalize(deg);
  const ref = referenceAngle(d);
  const q = quadrant(d);

  const sinSign = (q === 1 || q === 2) ? '' : '-';
  const cosSign = (q === 1 || q === 4) ? '' : '-';
  const tanSign = (q === 1 || q === 3) ? '' : '-';

  const refStr = fmtLabel(ref);
  return {
    sin: `${sinSign}\\sin ${refStr}°`,
    cos: `${cosSign}\\cos ${refStr}°`,
    tan: `${tanSign}\\tan ${refStr}°`,
  };
}

export function generateAngleReduction(input: AngleReductionInput): GraphOutput {
  const R = input.radius ?? 2.5;
  const deg = input.angle_deg;
  const cDeg = canonicalize(deg);
  const refDeg = referenceAngle(deg);
  const q = quadrant(deg);

  const rad = (cDeg * Math.PI) / 180;
  const refRad = (refDeg * Math.PI) / 180;

  const px = R * Math.cos(rad);
  const py = R * Math.sin(rad);

  let tikz = `\\begin{tikzpicture}[scale=1.0]\n`;

  // Light quadrant shading
  const quadColors: Record<number, string> = { 1: 'green!8', 2: 'blue!8', 3: 'orange!8', 4: 'red!8' };
  tikz += `  \\fill[${quadColors[q]}] (0,0) -- (${fmt(R + 0.3)},0) arc (0:90:${fmt(R + 0.3)}) -- cycle;\n`;

  // Circle
  tikz += `  \\draw[black!60, thick] (0,0) circle (${fmt(R)});\n`;

  // Axes
  tikz += `  \\draw[->, thick] (${fmt(-R - 0.4)},0) -- (${fmt(R + 0.5)},0) node[right] {$x$};\n`;
  tikz += `  \\draw[->, thick] (0,${fmt(-R - 0.4)}) -- (0,${fmt(R + 0.5)}) node[above] {$y$};\n`;

  // Reference angle dashed line (in Q1)
  const rpx = R * Math.cos(refRad);
  const rpy = R * Math.sin(refRad);
  tikz += `  \\draw[green!60!black, dashed, thin] (0,0) -- (${fmt(rpx)},${fmt(rpy)});\n`;
  tikz += `  \\filldraw[green!60!black, opacity=0.7] (${fmt(rpx)},${fmt(rpy)}) circle (0.07);\n`;
  tikz += `  \\node[green!60!black, above right, font=\\small] at (${fmt(rpx)},${fmt(rpy)}) {$${fmtLabel(refDeg)}°$};\n`;

  // Actual angle line
  tikz += `  \\draw[blue, thick] (0,0) -- (${fmt(px)},${fmt(py)});\n`;
  tikz += `  \\filldraw[blue] (${fmt(px)},${fmt(py)}) circle (0.09);\n`;

  // Angle arc
  const arcR = R * 0.2;
  tikz += `  \\draw[orange!80!black] (${fmt(arcR)},0) arc (0:${fmt(cDeg)}:${fmt(arcR)});\n`;
  const midRad = (cDeg * Math.PI) / 180 / 2;
  tikz += `  \\node[orange!80!black, font=\\small] at (${fmt(arcR * 1.6 * Math.cos(midRad))},${fmt(arcR * 1.6 * Math.sin(midRad))}) {$${fmtLabel(deg)}°$};\n`;

  // Reference angle arc (small, in Q1 portion)
  const refArcR = R * 0.12;
  // Compute the start of reference angle based on quadrant
  const refStart: Record<number, number> = { 1: 0, 2: 180, 3: 180, 4: 360 };
  const refDir: Record<number, number> = { 1: 1, 2: -1, 3: 1, 4: -1 };
  const arcStartDeg = refStart[q];
  const arcEndDeg = arcStartDeg + refDir[q] * refDeg;
  tikz += `  \\draw[green!60!black, thin] (${fmt(refArcR * Math.cos((arcStartDeg * Math.PI) / 180))},${fmt(refArcR * Math.sin((arcStartDeg * Math.PI) / 180))}) arc (${fmt(arcStartDeg)}:${fmt(arcEndDeg)}:${fmt(refArcR)});\n`;

  // Quadrant label
  if (input.show_quadrant_label !== false) {
    const qlabels: Record<number, [number, number, string]> = {
      1: [R * 0.6, R * 0.6, 'Q_1'],
      2: [-R * 0.6, R * 0.6, 'Q_2'],
      3: [-R * 0.6, -R * 0.6, 'Q_3'],
      4: [R * 0.6, -R * 0.6, 'Q_4'],
    };
    const [qlx, qly, qlabel] = qlabels[q];
    tikz += `  \\node[gray, font=\\large] at (${fmt(qlx)},${fmt(qly)}) {$${qlabel}$};\n`;
  }

  // Reduction formulas
  if (input.show_reduction_formula !== false) {
    const formulas = reductionFormulas(deg);
    const fboxX = R + 0.4;
    const fboxY = R * 0.5;
    tikz += `  \\node[draw, rounded corners, fill=yellow!10, align=left, font=\\small, inner sep=5pt] at (${fmt(fboxX + 2.2)},${fmt(fboxY)}) {\n`;
    tikz += `    $\\sin ${fmtLabel(deg)}° = ${formulas.sin}$\\\\[3pt]\n`;
    tikz += `    $\\cos ${fmtLabel(deg)}° = ${formulas.cos}$\\\\[3pt]\n`;
    tikz += `    $\\tan ${fmtLabel(deg)}° = ${formulas.tan}$\n`;
    tikz += `  };\n`;
  }

  tikz += `\\end{tikzpicture}`;

  const formulas = reductionFormulas(deg);
  return {
    tikz,
    computed: {
      original_angle: deg,
      canonical_angle: cDeg,
      reference_angle: refDeg,
      quadrant: q,
      sin_formula: formulas.sin,
      cos_formula: formulas.cos,
      tan_formula: formulas.tan,
      sin_value: parseFloat(Math.sin(rad).toFixed(6)),
      cos_value: parseFloat(Math.cos(rad).toFixed(6)),
    },
  };
}
