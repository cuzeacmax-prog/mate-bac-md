/**
 * translation.ts — Translation transformation visualization.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface TranslationInput {
  points: Array<{ x: number; y: number; label?: string }>;
  vector: { dx: number; dy: number };
  domain?: [number, number];
  show_grid?: boolean;
  show_vector?: boolean;
  show_labels?: boolean;
}

export function generateTranslation(input: TranslationInput): GraphOutput {
  const { dx, dy } = input.vector;
  const range = input.domain ?? [-6, 6];
  const [rmin, rmax] = range;

  let tikz = `\\begin{tikzpicture}[scale=0.7, >=stealth]\n`;

  if (input.show_grid) {
    tikz += `  \\draw[gray!20] (${fmt(rmin)},${fmt(rmin)}) grid (${fmt(rmax)},${fmt(rmax)});\n`;
  }

  tikz += `  \\draw[->, thick] (${fmt(rmin - 0.2)},0) -- (${fmt(rmax + 0.3)},0) node[right] {$x$};\n`;
  tikz += `  \\draw[->, thick] (0,${fmt(rmin - 0.2)}) -- (0,${fmt(rmax + 0.3)}) node[above] {$y$};\n`;

  // Translation vector arrow (from origin)
  if (input.show_vector !== false) {
    tikz += `  \\draw[->, orange!80!black, very thick] (0,0) -- (${fmt(dx)},${fmt(dy)}) node[above right] {$\\vec{v}=(${fmtLabel(dx)},${fmtLabel(dy)})$};\n`;
  }

  const colors = ['blue!70', 'red!70', 'green!60!black', 'violet'];
  const computed: Array<{ original: [number, number]; translated: [number, number] }> = [];

  for (let i = 0; i < input.points.length; i++) {
    const pt = input.points[i];
    const color = colors[i % colors.length];
    const lbl = pt.label ?? String.fromCharCode(65 + i);
    const tx = pt.x + dx;
    const ty = pt.y + dy;

    tikz += `  \\filldraw[${color}] (${fmt(pt.x)},${fmt(pt.y)}) circle (0.09);\n`;
    if (input.show_labels !== false) {
      tikz += `  \\node[${color}, above right, font=\\small] at (${fmt(pt.x)},${fmt(pt.y)}) {$${lbl}(${fmtLabel(pt.x)},${fmtLabel(pt.y)})$};\n`;
    }

    tikz += `  \\filldraw[${color}, opacity=0.6] (${fmt(tx)},${fmt(ty)}) circle (0.09);\n`;
    if (input.show_labels !== false) {
      tikz += `  \\node[${color}, opacity=0.8, above right, font=\\small] at (${fmt(tx)},${fmt(ty)}) {$${lbl}'(${fmtLabel(tx)},${fmtLabel(ty)})$};\n`;
    }

    // Arrow showing translation
    tikz += `  \\draw[->, ${color}, thin, dashed] (${fmt(pt.x)},${fmt(pt.y)}) -- (${fmt(tx)},${fmt(ty)});\n`;
    computed.push({ original: [pt.x, pt.y], translated: [tx, ty] });
  }

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      vector: { dx, dy },
      points: computed,
    },
  };
}
