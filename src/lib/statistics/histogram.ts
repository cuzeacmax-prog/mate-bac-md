/**
 * histogram.ts — Frequency histogram (equal-width intervals).
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface HistogramInput {
  intervals: Array<{ start: number; end: number; frequency: number; label?: string }>;
  title?: string;
  x_label?: string;
  y_label?: string;
  bar_color?: string;
  show_frequency_labels?: boolean;
  show_relative_frequency?: boolean; // y axis as relative freq (%)
}

export function generateHistogram(input: HistogramInput): GraphOutput {
  const bars = input.intervals;
  if (bars.length === 0) return { tikz: '', computed: {} };

  const totalFreq = bars.reduce((s, b) => s + b.frequency, 0);
  const maxFreq = Math.max(...bars.map(b => b.frequency));
  const yMax = maxFreq * 1.15;
  const xMin = bars[0].start;
  const xMax = bars[bars.length - 1].end;

  const barColor = input.bar_color ?? 'blue!50';
  const xLabel = input.x_label ?? 'x';
  const yLabel = input.y_label ?? (input.show_relative_frequency ? '\\%' : 'f_i');

  let tikz = `\\begin{tikzpicture}[scale=0.85]\n`;

  // Axes
  tikz += `  \\draw[->] (${fmt(xMin - 0.2)},0) -- (${fmt(xMax + 0.3)},0) node[right] {$${xLabel}$};\n`;
  tikz += `  \\draw[->] (${fmt(xMin - 0.2)},0) -- (${fmt(xMin - 0.2)},${fmt(yMax)}) node[above] {$${yLabel}$};\n`;

  // Y ticks (5 levels)
  const yStep = Math.ceil(maxFreq / 5);
  for (let y = yStep; y <= maxFreq; y += yStep) {
    const displayY = input.show_relative_frequency ? parseFloat(((y / totalFreq) * 100).toFixed(1)) : y;
    tikz += `  \\draw (${fmt(xMin - 0.2 - 0.05)},${fmt(y)}) -- (${fmt(xMin - 0.2 + 0.05)},${fmt(y)}) node[left] {\\small $${displayY}$};\n`;
  }

  // Bars
  for (const bar of bars) {
    const h = bar.frequency;
    tikz += `  \\fill[${barColor}] (${fmt(bar.start)},0) rectangle (${fmt(bar.end)},${fmt(h)});\n`;
    tikz += `  \\draw[black!70, thin] (${fmt(bar.start)},0) rectangle (${fmt(bar.end)},${fmt(h)});\n`;

    // X-axis tick labels
    const lbl = bar.label ?? fmtLabel(bar.start);
    tikz += `  \\node[below, font=\\footnotesize] at (${fmt(bar.start)},0) {$${lbl}$};\n`;

    // Frequency labels on top
    if (input.show_frequency_labels !== false) {
      const dispH = input.show_relative_frequency ? `${((h / totalFreq) * 100).toFixed(1)}\\%` : String(h);
      tikz += `  \\node[above, font=\\footnotesize] at (${fmt((bar.start + bar.end) / 2)},${fmt(h)}) {$${dispH}$};\n`;
    }
  }

  // Last x tick
  tikz += `  \\node[below, font=\\footnotesize] at (${fmt(xMax)},0) {$${fmtLabel(xMax)}$};\n`;

  if (input.title) {
    tikz += `  \\node[above, font=\\bfseries, align=center] at (${fmt((xMin + xMax) / 2)},${fmt(yMax)}) {${input.title}};\n`;
  }

  tikz += `\\end{tikzpicture}`;

  const mean = bars.reduce((s, b) => s + (b.start + b.end) / 2 * b.frequency, 0) / totalFreq;

  return {
    tikz,
    computed: {
      total_frequency: totalFreq,
      mean_class_mark: parseFloat(mean.toFixed(4)),
      num_classes: bars.length,
    },
  };
}
