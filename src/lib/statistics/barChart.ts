/**
 * barChart.ts — Vertical and horizontal bar chart.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface BarChartInput {
  categories: string[];
  values: number[];
  orientation?: 'vertical' | 'horizontal'; // default vertical
  bar_color?: string | string[];
  title?: string;
  x_label?: string;
  y_label?: string;
  show_value_labels?: boolean;
  bar_width?: number; // fraction 0–1, default 0.6
}

export function generateBarChart(input: BarChartInput): GraphOutput {
  const { categories, values } = input;
  const n = categories.length;
  if (n === 0) return { tikz: '', computed: {} };

  const orientation = input.orientation ?? 'vertical';
  const barW = input.bar_width ?? 0.6;
  const maxVal = Math.max(...values);
  const axisMax = maxVal * 1.15;
  const gap = 1.0; // spacing between bars

  const barColors = Array.isArray(input.bar_color)
    ? input.bar_color
    : Array(n).fill(input.bar_color ?? 'blue!50');

  let tikz = `\\begin{tikzpicture}[scale=0.85]\n`;

  if (orientation === 'vertical') {
    const totalWidth = n * gap;
    // Axes
    tikz += `  \\draw[->] (0,0) -- (${fmt(totalWidth + 0.3)},0) node[right] {$${input.x_label ?? ''}$};\n`;
    tikz += `  \\draw[->] (0,0) -- (0,${fmt(axisMax)}) node[above] {$${input.y_label ?? ''}$};\n`;

    // Y ticks
    const yStep = parseFloat((maxVal / 5).toFixed(1)) || 1;
    for (let y = yStep; y <= maxVal + 1e-9; y = parseFloat((y + yStep).toFixed(6))) {
      tikz += `  \\draw (-0.05,${fmt(y)}) -- (0.05,${fmt(y)}) node[left] {\\small $${fmtLabel(y)}$};\n`;
    }

    // Bars
    for (let i = 0; i < n; i++) {
      const xCenter = (i + 0.5) * gap;
      const h = values[i];
      const color = barColors[i % barColors.length];
      tikz += `  \\fill[${color}] (${fmt(xCenter - barW / 2)},0) rectangle (${fmt(xCenter + barW / 2)},${fmt(h)});\n`;
      tikz += `  \\draw[black!60, thin] (${fmt(xCenter - barW / 2)},0) rectangle (${fmt(xCenter + barW / 2)},${fmt(h)});\n`;
      // Category label
      tikz += `  \\node[below, font=\\footnotesize, align=center] at (${fmt(xCenter)},0) {${categories[i]}};\n`;
      // Value label
      if (input.show_value_labels !== false) {
        tikz += `  \\node[above, font=\\footnotesize] at (${fmt(xCenter)},${fmt(h)}) {$${fmtLabel(h)}$};\n`;
      }
    }
  } else {
    // Horizontal
    const totalHeight = n * gap;
    tikz += `  \\draw[->] (0,0) -- (${fmt(axisMax + 0.3)},0) node[right] {$${input.y_label ?? ''}$};\n`;
    tikz += `  \\draw[->] (0,0) -- (0,${fmt(totalHeight + 0.3)}) node[above] {$${input.x_label ?? ''}$};\n`;

    const xStep = parseFloat((maxVal / 5).toFixed(1)) || 1;
    for (let x = xStep; x <= maxVal + 1e-9; x = parseFloat((x + xStep).toFixed(6))) {
      tikz += `  \\draw (${fmt(x)},-0.05) -- (${fmt(x)},0.05) node[below] {\\small $${fmtLabel(x)}$};\n`;
    }

    for (let i = 0; i < n; i++) {
      const yCenter = (i + 0.5) * gap;
      const w = values[i];
      const color = barColors[i % barColors.length];
      tikz += `  \\fill[${color}] (0,${fmt(yCenter - barW / 2)}) rectangle (${fmt(w)},${fmt(yCenter + barW / 2)});\n`;
      tikz += `  \\draw[black!60, thin] (0,${fmt(yCenter - barW / 2)}) rectangle (${fmt(w)},${fmt(yCenter + barW / 2)});\n`;
      tikz += `  \\node[left, font=\\footnotesize] at (0,${fmt(yCenter)}) {${categories[i]}};\n`;
      if (input.show_value_labels !== false) {
        tikz += `  \\node[right, font=\\footnotesize] at (${fmt(w)},${fmt(yCenter)}) {$${fmtLabel(w)}$};\n`;
      }
    }
  }

  if (input.title) {
    const cx = orientation === 'vertical' ? (n * gap) / 2 : axisMax / 2;
    const cy = orientation === 'vertical' ? axisMax : n * gap + 0.3;
    tikz += `  \\node[above, font=\\bfseries] at (${fmt(cx)},${fmt(cy)}) {${input.title}};\n`;
  }

  tikz += `\\end{tikzpicture}`;

  const total = values.reduce((s, v) => s + v, 0);
  return {
    tikz,
    computed: {
      total: total,
      max_value: maxVal,
      categories: n,
    },
  };
}
