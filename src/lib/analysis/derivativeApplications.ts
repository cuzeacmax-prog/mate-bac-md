/**
 * derivativeApplications.ts — Monotonicity, convexity, extrema visualization.
 * Colors intervals: increasing=green, decreasing=red, inflections=orange.
 * ZERO AI — pure math + TikZ.
 */

import {
  fmt, fmtLabel,
  evaluateExpression,
  numericalDerivative,
  sampleFunctionSmart,
  pointsToTikzSegments,
  generateAxesTikz,
  wrapTikz,
  markedPointTikz,
  type GraphOutput,
} from './_helpers';

export interface MonotonicityInput {
  expression: string;
  domain: [number, number];
  range?: [number, number];
  show_grid?: boolean;
  show_derivative?: boolean;   // also plot f' (dashed orange)
  show_extrema?: boolean;
  show_inflections?: boolean;
  show_convexity?: boolean;
  label?: string;
}

// ─── Monotonicity + extrema ───────────────────────────────────────────────────

export function generateMonotonicityPlot(input: MonotonicityInput): GraphOutput {
  const { expression } = input;
  const [xmin, xmax] = input.domain;
  const fn = (x: number) => evaluateExpression(expression, x);
  const dfn = (x: number) => numericalDerivative(fn, x);

  const [ymin, ymax] = input.range ?? [-6, 6];
  const points = sampleFunctionSmart(fn, [xmin, xmax], 300, ymin, ymax);

  // Sample derivative to classify intervals
  const numSamples = 120;
  const step = (xmax - xmin) / numSamples;

  type Interval = { x1: number; x2: number; sign: 1 | -1 | 0 };
  const intervals: Interval[] = [];
  let curSign: 1 | -1 | 0 = 0;
  let curStart = xmin;

  for (let i = 0; i <= numSamples; i++) {
    const x = xmin + i * step;
    const d = dfn(x);
    const sign: 1 | -1 | 0 = Math.abs(d) < 1e-4 ? 0 : d > 0 ? 1 : -1;
    if (sign !== curSign) {
      if (i > 0) intervals.push({ x1: curStart, x2: x, sign: curSign });
      curSign = sign;
      curStart = x;
    }
  }
  intervals.push({ x1: curStart, x2: xmax, sign: curSign });

  // Colored curves per interval
  let coloredCurves = '';
  for (const iv of intervals) {
    const segPoints = sampleFunctionSmart(fn, [iv.x1, iv.x2], 60, ymin, ymax);
    const color = iv.sign === 1 ? 'green!60!black' : iv.sign === -1 ? 'red!70!black' : 'orange';
    coloredCurves += pointsToTikzSegments(segPoints, `ultra thick, ${color}`);
  }
  void points;

  const axesTikz = generateAxesTikz(xmin, xmax, ymin, ymax, { show_grid: input.show_grid });

  // Extrema: where sign changes
  let extremaTikz = '';
  if (input.show_extrema !== false) {
    for (let i = 1; i < intervals.length; i++) {
      const prev = intervals[i - 1];
      const curr = intervals[i];
      const x = curr.x1;
      const y = fn(x);
      if (isFinite(y)) {
        if (prev.sign === 1 && curr.sign === -1) {
          // Local max
          extremaTikz += markedPointTikz(x, y, `M(${fmtLabel(x)})`, { anchor: 'above', color: 'green!60!black' });
        } else if (prev.sign === -1 && curr.sign === 1) {
          // Local min
          extremaTikz += markedPointTikz(x, y, `m(${fmtLabel(x)})`, { anchor: 'below', color: 'red!70!black' });
        }
      }
    }
  }

  // Derivative curve
  let derivTikz = '';
  if (input.show_derivative) {
    const dPoints = sampleFunctionSmart(dfn, [xmin, xmax], 200, ymin, ymax);
    derivTikz = pointsToTikzSegments(dPoints, 'orange, dashed, thin');
    derivTikz += `  \\node[orange, right] at (${fmt(xmax)},${fmt(dfn(xmax))}) {\\small $f'$};\n`;
  }

  // Convexity coloring via second derivative
  let convexTikz = '';
  if (input.show_convexity) {
    const d2fn = (x: number) => numericalDerivative(dfn, x);
    const numSamp2 = 100;
    const step2 = (xmax - xmin) / numSamp2;
    // shade concave up regions lightly
    for (let i = 0; i < numSamp2; i++) {
      const xa = xmin + i * step2;
      const xb = xa + step2;
      const mid = (xa + xb) / 2;
      const d2 = d2fn(mid);
      if (d2 > 0.05) {
        const ya = fn(xa), yb = fn(xb);
        if (isFinite(ya) && isFinite(yb)) {
          convexTikz += `  \\fill[cyan!15] (${fmt(xa)},${fmt(Math.max(ya, ymin))}) -- (${fmt(xb)},${fmt(Math.max(yb, ymin))}) -- (${fmt(xb)},${fmt(ymin)}) -- (${fmt(xa)},${fmt(ymin)}) -- cycle;\n`;
        }
      } else if (d2 < -0.05) {
        const ya = fn(xa), yb = fn(xb);
        if (isFinite(ya) && isFinite(yb)) {
          convexTikz += `  \\fill[pink!25] (${fmt(xa)},${fmt(Math.min(ya, ymax))}) -- (${fmt(xb)},${fmt(Math.min(yb, ymax))}) -- (${fmt(xb)},${fmt(ymax)}) -- (${fmt(xa)},${fmt(ymax)}) -- cycle;\n`;
        }
      }
    }
  }

  const labelTikz = `  \\node[blue, above right] at (${fmt(xmin)},${fmt(ymax)}) {\\small $f(x)=${input.label ?? expression}$};\n`;

  const body = axesTikz + convexTikz + coloredCurves + derivTikz + extremaTikz + labelTikz;
  const tikz = wrapTikz(body, 0.7);

  const extremaList = intervals
    .slice(1)
    .map((curr, i) => {
      const prev = intervals[i];
      const x = curr.x1;
      const y = fn(x);
      if (!isFinite(y)) return null;
      if (prev.sign === 1 && curr.sign === -1) return { type: 'max', x, y };
      if (prev.sign === -1 && curr.sign === 1) return { type: 'min', x, y };
      return null;
    })
    .filter(Boolean);

  return {
    tikz,
    computed: {
      expression,
      monotonicity_intervals: intervals.map(iv => ({
        x1: parseFloat(iv.x1.toFixed(4)),
        x2: parseFloat(iv.x2.toFixed(4)),
        type: iv.sign === 1 ? 'increasing' : iv.sign === -1 ? 'decreasing' : 'constant',
      })),
      extrema: extremaList,
    },
  };
}
