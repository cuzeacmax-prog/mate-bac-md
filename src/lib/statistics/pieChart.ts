/**
 * pieChart.ts — Pie chart with arc calculations.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface PieSlice {
  label: string;
  value: number;
  color?: string;
}

export interface PieChartInput {
  slices: PieSlice[];
  radius?: number;        // default 2.5
  title?: string;
  show_percentages?: boolean;
  show_values?: boolean;
  start_angle?: number;   // degrees, default 90 (top)
}

const DEFAULT_COLORS = [
  'blue!50', 'red!50', 'green!60', 'orange!60', 'violet!50',
  'cyan!50', 'yellow!50', 'magenta!50', 'teal!50', 'lime!50',
];

export function generatePieChart(input: PieChartInput): GraphOutput {
  const { slices } = input;
  if (slices.length === 0) return { tikz: '', computed: {} };

  const R = input.radius ?? 2.5;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const startAngle = input.start_angle ?? 90;

  let tikz = `\\begin{tikzpicture}[scale=1.0]\n`;

  let currentAngle = startAngle;
  const computedSlices: Array<{ label: string; value: number; percentage: number; angle_start: number; angle_end: number }> = [];

  for (let i = 0; i < slices.length; i++) {
    const sl = slices[i];
    const pct = sl.value / total;
    const sweepDeg = pct * 360;
    const endAngle = currentAngle - sweepDeg; // clockwise
    const midAngle = (currentAngle + endAngle) / 2;
    const color = sl.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];

    // Slice: from current to end, clockwise (so end < start in standard math coords)
    // TikZ arc: draw (0,0) -- (R·cos(start), R·sin(start)) arc (start:end:R) -- cycle
    // For clockwise: arc goes from startAngle to endAngle decreasing
    const x1 = R * Math.cos((currentAngle * Math.PI) / 180);
    const y1 = R * Math.sin((currentAngle * Math.PI) / 180);

    tikz += `  \\fill[${color}] (0,0) -- (${fmt(x1)},${fmt(y1)}) arc (${fmt(currentAngle)}:${fmt(endAngle)}:${fmt(R)}) -- cycle;\n`;
    tikz += `  \\draw[black!60, thin] (0,0) -- (${fmt(x1)},${fmt(y1)}) arc (${fmt(currentAngle)}:${fmt(endAngle)}:${fmt(R)}) -- cycle;\n`;

    // Label in middle of slice
    const labelR = R * 0.65;
    const lx = labelR * Math.cos((midAngle * Math.PI) / 180);
    const ly = labelR * Math.sin((midAngle * Math.PI) / 180);

    let labelText = sl.label;
    if (input.show_percentages !== false) {
      labelText += `\\\\${(pct * 100).toFixed(1)}\\%`;
    }
    if (input.show_values) {
      labelText += `\\\\${fmtLabel(sl.value)}`;
    }
    tikz += `  \\node[align=center, font=\\footnotesize] at (${fmt(lx)},${fmt(ly)}) {${labelText}};\n`;

    computedSlices.push({
      label: sl.label,
      value: sl.value,
      percentage: parseFloat((pct * 100).toFixed(2)),
      angle_start: currentAngle,
      angle_end: endAngle,
    });

    currentAngle = endAngle;
  }

  if (input.title) {
    tikz += `  \\node[above, font=\\bfseries] at (0,${fmt(R + 0.5)}) {${input.title}};\n`;
  }

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      total,
      slices: computedSlices,
    },
  };
}
