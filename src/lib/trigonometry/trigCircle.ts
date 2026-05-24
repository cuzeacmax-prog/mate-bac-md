/**
 * trigCircle.ts — Unit circle with sin/cos/tan projections and special angles.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

const PI = Math.PI;

export interface TrigCircleInput {
  angle_deg?: number;          // show a specific angle (default 30)
  show_special_angles?: boolean; // mark all 30,45,60,90... points
  show_sin_projection?: boolean; // vertical dashed to y-axis
  show_cos_projection?: boolean; // horizontal dashed to x-axis
  show_tan_line?: boolean;      // tangent line segment at x=1
  show_labels?: boolean;        // sin, cos labels
  show_coordinates?: boolean;   // (cos θ, sin θ) label
  show_angle_arc?: boolean;
  radius?: number;              // default 2.5
}

function degToRad(d: number) { return (d * PI) / 180; }

const SPECIAL_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
const SPECIAL_LABELS: Record<number, string> = {
  0: '0', 30: '\\frac{\\pi}{6}', 45: '\\frac{\\pi}{4}', 60: '\\frac{\\pi}{3}',
  90: '\\frac{\\pi}{2}', 120: '\\frac{2\\pi}{3}', 135: '\\frac{3\\pi}{4}', 150: '\\frac{5\\pi}{6}',
  180: '\\pi', 210: '\\frac{7\\pi}{6}', 225: '\\frac{5\\pi}{4}', 240: '\\frac{4\\pi}{3}',
  270: '\\frac{3\\pi}{2}', 300: '\\frac{5\\pi}{3}', 315: '\\frac{7\\pi}{4}', 330: '\\frac{11\\pi}{6}',
  360: '2\\pi',
};

function specialValues(deg: number): { sin: string; cos: string } {
  const map: Record<number, [string, string]> = {
    0: ['0', '1'], 30: ['\\frac{1}{2}', '\\frac{\\sqrt{3}}{2}'],
    45: ['\\frac{\\sqrt{2}}{2}', '\\frac{\\sqrt{2}}{2}'], 60: ['\\frac{\\sqrt{3}}{2}', '\\frac{1}{2}'],
    90: ['1', '0'], 180: ['0', '-1'], 270: ['-1', '0'],
  };
  const base = ((deg % 360) + 360) % 360;
  if (map[base]) return { sin: map[base][0], cos: map[base][1] };
  const s = parseFloat(Math.sin(degToRad(deg)).toFixed(4)).toString();
  const c = parseFloat(Math.cos(degToRad(deg)).toFixed(4)).toString();
  return { sin: s, cos: c };
}

export function generateTrigCircle(input: TrigCircleInput): GraphOutput {
  const R = input.radius ?? 2.5;
  const angleDeg = input.angle_deg ?? 30;
  const angleRad = degToRad(angleDeg);
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  let tikz = `\\begin{tikzpicture}[scale=1.0]\n`;

  // Grid light
  tikz += `  \\draw[gray!15, thin] (${fmt(-R - 0.3)},${fmt(-R - 0.3)}) grid (${fmt(R + 0.3)},${fmt(R + 0.3)});\n`;

  // Unit circle
  tikz += `  \\draw[black!70, thick] (0,0) circle (${fmt(R)});\n`;

  // Axes
  tikz += `  \\draw[->, thick] (${fmt(-R - 0.4)},0) -- (${fmt(R + 0.6)},0) node[right] {$x$};\n`;
  tikz += `  \\draw[->, thick] (0,${fmt(-R - 0.4)}) -- (0,${fmt(R + 0.6)}) node[above] {$y$};\n`;

  // Axis labels ±1
  tikz += `  \\node[below right, font=\\small] at (${fmt(R)},0) {$1$};\n`;
  tikz += `  \\node[below left, font=\\small] at (${fmt(-R)},0) {$-1$};\n`;
  tikz += `  \\node[above right, font=\\small] at (0,${fmt(R)}) {$1$};\n`;
  tikz += `  \\node[below right, font=\\small] at (0,${fmt(-R)}) {$-1$};\n`;
  tikz += `  \\node[below left, font=\\small] at (0,0) {$O$};\n`;

  // Special angle markers
  if (input.show_special_angles !== false) {
    for (const deg of SPECIAL_ANGLES) {
      if (deg === 360) continue;
      const rad = degToRad(deg);
      const px = R * Math.cos(rad);
      const py = R * Math.sin(rad);
      tikz += `  \\filldraw[black!60] (${fmt(px)},${fmt(py)}) circle (0.05);\n`;
      // Label outside circle
      const labelR = R + 0.35;
      const lx = labelR * Math.cos(rad);
      const ly = labelR * Math.sin(rad);
      const lbl = SPECIAL_LABELS[deg] ?? `${deg}°`;
      tikz += `  \\node[font=\\tiny, align=center] at (${fmt(lx)},${fmt(ly)}) {$${lbl}$};\n`;
    }
  }

  // Angle arc
  if (input.show_angle_arc !== false && Math.abs(angleDeg) > 0.5) {
    const arcR = R * 0.2;
    tikz += `  \\draw[orange!80!black, thin] (${fmt(arcR)},0) arc (0:${fmt(angleDeg)}:${fmt(arcR)});\n`;
    const midRad = degToRad(angleDeg / 2);
    const mx = arcR * 1.5 * Math.cos(midRad);
    const my = arcR * 1.5 * Math.sin(midRad);
    tikz += `  \\node[orange!80!black, font=\\small] at (${fmt(mx)},${fmt(my)}) {$${fmtLabel(angleDeg)}°$};\n`;
  }

  // Radius to angle point
  const px = R * cosA;
  const py = R * sinA;
  tikz += `  \\draw[blue, thick] (0,0) -- (${fmt(px)},${fmt(py)});\n`;
  tikz += `  \\filldraw[blue] (${fmt(px)},${fmt(py)}) circle (0.09);\n`;

  // Sin projection (vertical)
  if (input.show_sin_projection !== false) {
    tikz += `  \\draw[red!70, thick, dashed] (${fmt(px)},0) -- (${fmt(px)},${fmt(py)});\n`;
    tikz += `  \\draw[red!70, thin] (${fmt(px - 0.08)},0) -- (${fmt(px - 0.08)},0.08) -- (${fmt(px)},0.08);\n`;
    if (input.show_labels !== false) {
      tikz += `  \\node[red!70, right, font=\\small] at (${fmt(px)},${fmt(py / 2)}) {$\\sin\\theta$};\n`;
    }
  }

  // Cos projection (horizontal)
  if (input.show_cos_projection !== false) {
    tikz += `  \\draw[green!60!black, thick, dashed] (0,${fmt(py)}) -- (${fmt(px)},${fmt(py)});\n`;
    if (input.show_labels !== false) {
      tikz += `  \\node[green!60!black, above, font=\\small] at (${fmt(px / 2)},${fmt(py)}) {$\\cos\\theta$};\n`;
    }
  }

  // Tangent line at x=1
  if (input.show_tan_line && Math.abs(cosA) > 0.1) {
    const tanVal = sinA / cosA;
    const tanY = R * tanVal;
    tikz += `  \\draw[violet, thick] (${fmt(R)},0) -- (${fmt(R)},${fmt(tanY)});\n`;
    tikz += `  \\draw[violet, thin, dashed] (0,0) -- (${fmt(R)},${fmt(tanY)});\n`;
    tikz += `  \\node[violet, right, font=\\small] at (${fmt(R)},${fmt(tanY / 2)}) {$\\tan\\theta$};\n`;
    tikz += `  \\filldraw[violet] (${fmt(R)},${fmt(tanY)}) circle (0.07);\n`;
  }

  // Coordinates label
  if (input.show_coordinates !== false) {
    const vals = specialValues(angleDeg);
    const anchor = sinA >= 0 ? 'above' : 'below';
    tikz += `  \\node[blue, ${anchor} right, font=\\footnotesize] at (${fmt(px)},${fmt(py)}) {$(\\cos\\theta,\\sin\\theta)$};\n`;
    tikz += `  \\node[blue, ${anchor} right, font=\\tiny] at (${fmt(px + 0.1)},${fmt(py - (sinA >= 0 ? 0.35 : -0.35))}) {$=(${vals.cos},${vals.sin})$};\n`;
  }

  tikz += `\\end{tikzpicture}`;

  const vals = specialValues(angleDeg);
  return {
    tikz,
    computed: {
      angle_deg: angleDeg,
      sin: parseFloat(sinA.toFixed(6)),
      cos: parseFloat(cosA.toFixed(6)),
      tan: Math.abs(cosA) > 1e-9 ? parseFloat((sinA / cosA).toFixed(6)) : 'undefined',
      sin_exact: vals.sin,
      cos_exact: vals.cos,
    },
  };
}
