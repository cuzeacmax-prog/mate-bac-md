/**
 * integral.ts — Definite integral area visualization.
 * Fills region between curve and x-axis (or between two curves).
 * Uses simple Riemann sum for numeric approximation.
 * ZERO AI — pure math + TikZ.
 */

import {
  fmt, fmtLabel,
  evaluateExpression,
  sampleFunction,
  sampleFunctionSmart,
  pointsToTikzSegments,
  generateAxesTikz,
  wrapTikz,
  type GraphOutput,
} from './_helpers';

export interface IntegralVisualizationInput {
  expression: string;          // f(x)
  a: number;                   // lower bound
  b: number;                   // upper bound
  domain?: [number, number];   // full domain shown
  range?: [number, number];
  show_grid?: boolean;
  show_riemann?: boolean;      // show Riemann rectangles (n=10)
  riemann_n?: number;          // number of rectangles (default 8)
  riemann_method?: 'left' | 'right' | 'midpoint'; // default midpoint
  fill_color?: string;         // default 'blue!20'
  show_bounds?: boolean;       // dashed verticals at a, b
  label?: string;
}

function numericalIntegral(fn: (x: number) => number, a: number, b: number, n = 1000): number {
  const h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = a + (i + 0.5) * h;
    const y = fn(x);
    if (isFinite(y)) sum += y * h;
  }
  return sum;
}

export function generateIntegralVisualization(input: IntegralVisualizationInput): GraphOutput {
  const { expression, a, b } = input;
  const fn = (x: number) => evaluateExpression(expression, x);

  const domainPad = (b - a) * 0.4;
  const [xmin, xmax] = input.domain ?? [a - domainPad, b + domainPad];
  const [ymin, ymax] = input.range ?? [-4, 6];

  const points = sampleFunctionSmart(fn, [xmin, xmax], 300, ymin, ymax);
  const curveTikz = pointsToTikzSegments(points, 'thick, blue');
  const axesTikz = generateAxesTikz(xmin, xmax, ymin, ymax, { show_grid: input.show_grid });

  // Filled region between curve and x-axis from a to b
  const fillColor = input.fill_color ?? 'blue!20';
  const fillPoints = sampleFunction(fn, [a, b], 80, ymin, ymax);
  let fillTikz = '';
  // Build closed path: a→0, curve points, b→0
  const validFillPts = fillPoints.filter((p): p is [number, number] => p !== null);
  if (validFillPts.length > 1) {
    const coordStr = validFillPts.map(([x, y]) => `(${fmt(x)},${fmt(y)})`).join(' ');
    fillTikz += `  \\fill[${fillColor}] (${fmt(a)},0) -- plot[smooth] coordinates {${coordStr}} -- (${fmt(b)},0) -- cycle;\n`;
  }

  // Bound verticals
  let boundsTikz = '';
  if (input.show_bounds !== false) {
    const fa = fn(a), fb = fn(b);
    if (isFinite(fa)) {
      boundsTikz += `  \\draw[gray!60, dashed] (${fmt(a)},0) -- (${fmt(a)},${fmt(fa)});\n`;
      boundsTikz += `  \\node[below] at (${fmt(a)},0) {\\small $a=${fmtLabel(a)}$};\n`;
    }
    if (isFinite(fb)) {
      boundsTikz += `  \\draw[gray!60, dashed] (${fmt(b)},0) -- (${fmt(b)},${fmt(fb)});\n`;
      boundsTikz += `  \\node[below] at (${fmt(b)},0) {\\small $b=${fmtLabel(b)}$};\n`;
    }
  }

  // Riemann rectangles
  let riemannTikz = '';
  if (input.show_riemann) {
    const n = input.riemann_n ?? 8;
    const method = input.riemann_method ?? 'midpoint';
    const h = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const xLeft = a + i * h;
      const xRight = xLeft + h;
      const xSample = method === 'left' ? xLeft : method === 'right' ? xRight : (xLeft + xRight) / 2;
      const y = fn(xSample);
      if (isFinite(y)) {
        const rectYmin = Math.min(0, y);
        const rectYmax = Math.max(0, y);
        const col = y >= 0 ? 'blue!30' : 'red!20';
        riemannTikz += `  \\fill[${col}, opacity=0.6] (${fmt(xLeft)},${fmt(rectYmin)}) rectangle (${fmt(xRight)},${fmt(rectYmax)});\n`;
        riemannTikz += `  \\draw[blue!50, thin] (${fmt(xLeft)},${fmt(rectYmin)}) rectangle (${fmt(xRight)},${fmt(rectYmax)});\n`;
      }
    }
  }

  // Compute integral
  const integralValue = numericalIntegral(fn, a, b);

  // Label
  const labelTikz = `  \\node[blue, above right] at (${fmt(xmin)},${fmt(ymax)}) {\\small $\\displaystyle\\int_{${fmtLabel(a)}}^{${fmtLabel(b)}} f(x)\\,dx \\approx ${fmtLabel(integralValue)}$};\n`;
  const exprTikz = `  \\node[gray, below right] at (${fmt(xmin)},${fmt(ymax * 0.82)}) {\\small $f(x)=${input.label ?? expression}$};\n`;

  const body = axesTikz + fillTikz + riemannTikz + curveTikz + boundsTikz + labelTikz + exprTikz;
  const tikz = wrapTikz(body, 0.7);

  return {
    tikz,
    computed: {
      expression,
      lower_bound: a,
      upper_bound: b,
      integral_value: parseFloat(integralValue.toFixed(6)),
    },
  };
}
