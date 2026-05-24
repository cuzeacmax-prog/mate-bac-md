/**
 * homothety.ts — Homothety (scaling from a center) visualization.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface HomothetyInput {
  points: Array<{ x: number; y: number; label?: string }>;
  center?: { x: number; y: number }; // default origin
  ratio: number;                       // k (negative = also rotates by 180°)
  domain?: [number, number];
  show_grid?: boolean;
  show_lines?: boolean;  // lines from center through original to image
}

export function generateHomothety(input: HomothetyInput): GraphOutput {
  const cx = input.center?.x ?? 0;
  const cy = input.center?.y ?? 0;
  const k = input.ratio;
  const range = input.domain ?? [-8, 8];
  const [rmin, rmax] = range;

  let tikz = `\\begin{tikzpicture}[scale=0.6, >=stealth]\n`;

  if (input.show_grid) {
    tikz += `  \\draw[gray!20] (${fmt(rmin)},${fmt(rmin)}) grid (${fmt(rmax)},${fmt(rmax)});\n`;
  }

  tikz += `  \\draw[->, thick] (${fmt(rmin - 0.2)},0) -- (${fmt(rmax + 0.3)},0) node[right] {$x$};\n`;
  tikz += `  \\draw[->, thick] (0,${fmt(rmin - 0.2)}) -- (0,${fmt(rmax + 0.3)}) node[above] {$y$};\n`;

  // Center
  tikz += `  \\filldraw[orange] (${fmt(cx)},${fmt(cy)}) circle (0.12) node[below right, font=\\small] {$O'$};\n`;

  // Label
  const kStr = fmtLabel(k);
  tikz += `  \\node[orange!80!black, font=\\small] at (${fmt(rmax - 1)},${fmt(rmax - 0.3)}) {$H(O',k=${kStr})$};\n`;

  const colors = ['blue!70', 'red!70', 'green!60!black', 'violet'];
  const computed: Array<{ original: [number, number]; image: [number, number] }> = [];

  for (let i = 0; i < input.points.length; i++) {
    const pt = input.points[i];
    const color = colors[i % colors.length];
    const lbl = pt.label ?? String.fromCharCode(65 + i);

    // Image: O' + k·(P - O')
    const ix = cx + k * (pt.x - cx);
    const iy = cy + k * (pt.y - cy);

    // Line through center
    if (input.show_lines !== false) {
      // Extend the line beyond both points
      tikz += `  \\draw[${color}, very thin, opacity=0.35] (${fmt(cx)},${fmt(cy)}) -- (${fmt(pt.x)},${fmt(pt.y)});\n`;
      tikz += `  \\draw[${color}, very thin, opacity=0.35] (${fmt(cx)},${fmt(cy)}) -- (${fmt(ix)},${fmt(iy)});\n`;
    }

    // Original
    tikz += `  \\filldraw[${color}] (${fmt(pt.x)},${fmt(pt.y)}) circle (0.09) node[above right, font=\\small] {$${lbl}(${fmtLabel(pt.x)},${fmtLabel(pt.y)})$};\n`;
    // Image
    tikz += `  \\filldraw[${color}, opacity=0.6] (${fmt(ix)},${fmt(iy)}) circle (0.09) node[above right, font=\\small, opacity=0.8] {$${lbl}'(${fmtLabel(ix)},${fmtLabel(iy)})$};\n`;

    computed.push({ original: [pt.x, pt.y], image: [ix, iy] });
  }

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      center: [cx, cy],
      ratio: k,
      points: computed,
    },
  };
}
