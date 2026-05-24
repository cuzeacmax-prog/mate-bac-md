/**
 * frequencyPolygon.ts — Frequency polygon (midpoints connected by lines).
 * Optionally overlaid on a histogram.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface FrequencyPolygonInput {
  intervals: Array<{ start: number; end: number; frequency: number }>;
  show_histogram?: boolean;    // also draw histogram bars (default false)
  bar_color?: string;
  polygon_color?: string;
  show_points?: boolean;
  title?: string;
  x_label?: string;
  y_label?: string;
  show_cumulative?: boolean;   // also plot ogive (cumulative polygon)
}

export function generateFrequencyPolygon(input: FrequencyPolygonInput): GraphOutput {
  const { intervals } = input;
  if (intervals.length === 0) return { tikz: '', computed: {} };

  const totalFreq = intervals.reduce((s, b) => s + b.frequency, 0);
  const maxFreq = Math.max(...intervals.map(b => b.frequency));
  const yMax = maxFreq * 1.2;

  const xMin = intervals[0].start;
  const xMax = intervals[intervals.length - 1].end;

  const barColor = input.bar_color ?? 'blue!20';
  const polyColor = input.polygon_color ?? 'red!80!black';

  let tikz = `\\begin{tikzpicture}[scale=0.85]\n`;

  // Axes
  tikz += `  \\draw[->] (${fmt(xMin - 0.3)},0) -- (${fmt(xMax + 0.3)},0) node[right] {$${input.x_label ?? 'x'}$};\n`;
  tikz += `  \\draw[->] (${fmt(xMin - 0.3)},0) -- (${fmt(xMin - 0.3)},${fmt(yMax)}) node[above] {$${input.y_label ?? 'f_i'}$};\n`;

  // Y ticks
  const yStep = Math.ceil(maxFreq / 5) || 1;
  for (let y = yStep; y <= maxFreq; y += yStep) {
    tikz += `  \\draw (${fmt(xMin - 0.35)},${fmt(y)}) -- (${fmt(xMin - 0.25)},${fmt(y)}) node[left] {\\small $${y}$};\n`;
  }

  // Histogram bars
  if (input.show_histogram) {
    for (const bar of intervals) {
      tikz += `  \\fill[${barColor}] (${fmt(bar.start)},0) rectangle (${fmt(bar.end)},${fmt(bar.frequency)});\n`;
      tikz += `  \\draw[black!40, thin] (${fmt(bar.start)},0) rectangle (${fmt(bar.end)},${fmt(bar.frequency)});\n`;
    }
  }

  // X tick labels at interval boundaries
  for (const bar of intervals) {
    tikz += `  \\draw (${fmt(bar.start)},0) -- (${fmt(bar.start)},${fmt(-0.08)}) node[below, font=\\footnotesize] {$${fmtLabel(bar.start)}$};\n`;
  }
  tikz += `  \\draw (${fmt(xMax)},0) -- (${fmt(xMax)},${fmt(-0.08)}) node[below, font=\\footnotesize] {$${fmtLabel(xMax)}$};\n`;

  // Midpoints
  const midpoints = intervals.map(bar => [(bar.start + bar.end) / 2, bar.frequency] as [number, number]);

  // Extend to ghost points at 0 (one interval width before first and after last)
  const w = intervals[0].end - intervals[0].start;
  const ghostLeft: [number, number] = [midpoints[0][0] - w, 0];
  const ghostRight: [number, number] = [midpoints[midpoints.length - 1][0] + w, 0];
  const allPts = [ghostLeft, ...midpoints, ghostRight];

  const coordStr = allPts.map(([x, y]) => `(${fmt(x)},${fmt(y)})`).join(' ');
  tikz += `  \\draw[${polyColor}, thick] plot coordinates {${coordStr}};\n`;

  if (input.show_points !== false) {
    for (const [x, y] of midpoints) {
      tikz += `  \\filldraw[${polyColor}] (${fmt(x)},${fmt(y)}) circle (0.07);\n`;
    }
  }

  // Cumulative (ogive)
  if (input.show_cumulative) {
    let cumFreq = 0;
    const ogivePoints: [number, number][] = [[xMin, 0]];
    for (const bar of intervals) {
      cumFreq += bar.frequency;
      ogivePoints.push([bar.end, cumFreq]);
    }
    const ogiveStr = ogivePoints.map(([x, y]) => `(${fmt(x)},${fmt(y)})`).join(' ');
    tikz += `  \\draw[orange!80!black, thick, dashed] plot coordinates {${ogiveStr}};\n`;
    tikz += `  \\node[orange!80!black, right, font=\\footnotesize] at (${fmt(xMax)},${fmt(totalFreq)}) {ogiva};\n`;
  }

  if (input.title) {
    tikz += `  \\node[above, font=\\bfseries] at (${fmt((xMin + xMax) / 2)},${fmt(yMax)}) {${input.title}};\n`;
  }

  tikz += `\\end{tikzpicture}`;

  const mean = midpoints.reduce((s, [x, f]) => s + x * f, 0) / totalFreq;
  const variance = midpoints.reduce((s, [x, f]) => s + f * (x - mean) ** 2, 0) / totalFreq;

  return {
    tikz,
    computed: {
      total_frequency: totalFreq,
      mean: parseFloat(mean.toFixed(4)),
      variance: parseFloat(variance.toFixed(4)),
      std_deviation: parseFloat(Math.sqrt(variance).toFixed(4)),
    },
  };
}
