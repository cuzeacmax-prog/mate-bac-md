/**
 * symmetry.ts — Axial and central symmetry visualization.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export type SymmetryAxis = 'x' | 'y' | 'y=x' | 'y=-x' | { x?: number; slope?: number };

export interface SymmetryInput {
  points: Array<{ x: number; y: number; label?: string }>;
  axis?: SymmetryAxis;         // default 'y' (x=0)
  center?: { x: number; y: number }; // for central symmetry
  type?: 'axial' | 'central';  // default 'axial'
  domain?: [number, number];   // viewing window
  show_grid?: boolean;
  show_axis?: boolean;
  show_connecting_lines?: boolean;
}

function reflectPoint(px: number, py: number, axis: SymmetryAxis): [number, number] {
  if (axis === 'x') return [px, -py];
  if (axis === 'y') return [-px, py];
  if (axis === 'y=x') return [py, px];
  if (axis === 'y=-x') return [-py, -px];
  if (typeof axis === 'object') {
    const ax = axis.x; // vertical line x=ax
    const m = axis.slope;
    if (ax !== undefined) return [2 * ax - px, py];
    if (m !== undefined) {
      // Reflection over y = m·x line (through origin)
      const d = (2 * (py - m * px)) / (m * m + 1);
      return [px + m * d, py - d];
    }
  }
  return [-px, py];
}

export function generateSymmetry(input: SymmetryInput): GraphOutput {
  const range = input.domain ?? [-6, 6];
  const [rmin, rmax] = range;
  const type = input.type ?? 'axial';
  const axis = input.axis ?? 'y';
  const center = input.center ?? { x: 0, y: 0 };

  let tikz = `\\begin{tikzpicture}[scale=0.7]\n`;

  // Grid
  if (input.show_grid) {
    tikz += `  \\draw[gray!20] (${fmt(rmin)},${fmt(rmin)}) grid (${fmt(rmax)},${fmt(rmax)});\n`;
  }

  // Axes
  tikz += `  \\draw[->, thick] (${fmt(rmin - 0.2)},0) -- (${fmt(rmax + 0.3)},0) node[right] {$x$};\n`;
  tikz += `  \\draw[->, thick] (0,${fmt(rmin - 0.2)}) -- (0,${fmt(rmax + 0.3)}) node[above] {$y$};\n`;

  // Axis of symmetry
  if (type === 'axial' && input.show_axis !== false) {
    if (axis === 'x') {
      tikz += `  \\draw[orange!80!black, dashed, thick] (${fmt(rmin)},0) -- (${fmt(rmax)},0) node[right] {$\\text{os}$};\n`;
    } else if (axis === 'y') {
      tikz += `  \\draw[orange!80!black, dashed, thick] (0,${fmt(rmin)}) -- (0,${fmt(rmax)});\n`;
    } else if (axis === 'y=x') {
      tikz += `  \\draw[orange!80!black, dashed, thick] (${fmt(rmin)},${fmt(rmin)}) -- (${fmt(rmax)},${fmt(rmax)}) node[right] {$y=x$};\n`;
    } else if (axis === 'y=-x') {
      tikz += `  \\draw[orange!80!black, dashed, thick] (${fmt(rmin)},${fmt(rmax)}) -- (${fmt(rmax)},${fmt(rmin)}) node[right] {$y=-x$};\n`;
    } else if (typeof axis === 'object' && axis.x !== undefined) {
      tikz += `  \\draw[orange!80!black, dashed, thick] (${fmt(axis.x)},${fmt(rmin)}) -- (${fmt(axis.x)},${fmt(rmax)}) node[above] {$x=${fmtLabel(axis.x)}$};\n`;
    }
  }

  if (type === 'central') {
    tikz += `  \\filldraw[orange] (${fmt(center.x)},${fmt(center.y)}) circle (0.1) node[above right] {$O'$};\n`;
  }

  const colors = ['blue!70', 'red!70', 'green!60!black', 'violet'];
  const computed: Record<string, unknown> = { type, reflected_points: [] as unknown[] };

  for (let i = 0; i < input.points.length; i++) {
    const pt = input.points[i];
    const color = colors[i % colors.length];
    const lbl = pt.label ?? String.fromCharCode(65 + i);

    let rx: number, ry: number;
    if (type === 'axial') {
      [rx, ry] = reflectPoint(pt.x, pt.y, axis);
    } else {
      rx = 2 * center.x - pt.x;
      ry = 2 * center.y - pt.y;
    }

    // Original
    tikz += `  \\filldraw[${color}] (${fmt(pt.x)},${fmt(pt.y)}) circle (0.09) node[above right, font=\\small] {$${lbl}(${fmtLabel(pt.x)},${fmtLabel(pt.y)})$};\n`;
    // Reflected
    tikz += `  \\filldraw[${color}, opacity=0.6] (${fmt(rx)},${fmt(ry)}) circle (0.09) node[above right, font=\\small, opacity=0.8] {$${lbl}'(${fmtLabel(rx)},${fmtLabel(ry)})$};\n`;
    // Connecting line
    if (input.show_connecting_lines !== false) {
      tikz += `  \\draw[${color}, very thin, dashed] (${fmt(pt.x)},${fmt(pt.y)}) -- (${fmt(rx)},${fmt(ry)});\n`;
    }

    (computed.reflected_points as unknown[]).push({ original: [pt.x, pt.y], reflected: [rx, ry] });
  }

  tikz += `\\end{tikzpicture}`;

  return { tikz, computed };
}
