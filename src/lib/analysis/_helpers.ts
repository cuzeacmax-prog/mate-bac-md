/**
 * _helpers.ts — Shared helpers for all analysis (function plot) calculators.
 * Pure math + TikZ string generation. Zero AI, zero external dependencies.
 */

// ─── Formatting ───────────────────────────────────────────────────────────────

export function fmt(n: number, d = 3): string {
  if (!isFinite(n)) return '0';
  return n.toFixed(d);
}

export function fmtLabel(n: number): string {
  // Smart label: integer if close, else 2 decimals
  if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
  return parseFloat(n.toFixed(2)).toString();
}

// ─── Expression evaluator ─────────────────────────────────────────────────────

// Custom functions available in expressions
const _cotFunc = (x: number) => Math.cos(x) / Math.sin(x);
const _secFunc = (x: number) => 1 / Math.cos(x);
const _cscFunc = (x: number) => 1 / Math.sin(x);

export function evaluateExpression(expr: string, x: number): number {
  try {
    const sanitized = expr
      .replace(/\^/g, '**')
      // Implicit multiplication: 2x → 2*x, )( → )*(, )(x → )*(x
      .replace(/(\d)\s*(x)/g, '$1*$2')
      .replace(/(\))\s*(\()/g, '$1*$2')
      .replace(/(\))\s*(x)/g, '$1*$2')
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      .replace(/\bcot\b/g, '_cot')
      .replace(/\bsec\b/g, '_sec')
      .replace(/\bcsc\b/g, '_csc')
      .replace(/\bln\b/g, 'Math.log')
      .replace(/\blog2\b/g, '(Math.log(x)/Math.log(2))')
      .replace(/\blog10\b/g, 'Math.log10')
      .replace(/\blog\b/g, 'Math.log10')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\bcbrt\b/g, 'Math.cbrt')
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bexp\b/g, 'Math.exp')
      .replace(/\bpi\b/g, `${Math.PI}`)
      .replace(/\be\b/g, `${Math.E}`)
      .replace(/\bPI\b/g, `${Math.PI}`);

    // eslint-disable-next-line no-new-func
    return new Function(
      'x', '_cot', '_sec', '_csc',
      `"use strict"; try { return +(${sanitized}); } catch(e) { return NaN; }`,
    )(x, _cotFunc, _secFunc, _cscFunc) as number;
  } catch {
    return NaN;
  }
}

// ─── Function sampling ────────────────────────────────────────────────────────

export type SampledPoint = [number, number] | null;

export function sampleFunction(
  fn: (x: number) => number,
  domain: [number, number],
  numPoints = 150,
  ymin = -10,
  ymax = 10,
): SampledPoint[] {
  const [a, b] = domain;
  const step = (b - a) / numPoints;
  const points: SampledPoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const x = a + i * step;
    try {
      const y = fn(x);
      if (!isFinite(y) || isNaN(y) || y < ymin - 0.5 || y > ymax + 0.5) {
        points.push(null);
      } else {
        points.push([x, y]);
      }
    } catch {
      points.push(null);
    }
  }

  return points;
}

// Detect discontinuities by large jumps
export function sampleFunctionSmart(
  fn: (x: number) => number,
  domain: [number, number],
  numPoints = 200,
  ymin = -10,
  ymax = 10,
): SampledPoint[] {
  const points = sampleFunction(fn, domain, numPoints, ymin, ymax);
  // Insert null before large jumps (discontinuities)
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (prev && curr) {
      const jump = Math.abs(curr[1] - prev[1]);
      if (jump > (ymax - ymin) * 0.5) {
        points[i - 1] = null;
      }
    }
  }
  return points;
}

// ─── Points to TikZ path segments ─────────────────────────────────────────────

export function pointsToTikzSegments(
  points: SampledPoint[],
  style = 'thick, blue',
): string {
  let tikz = '';
  let seg: Array<[number, number]> = [];

  const flushSeg = () => {
    if (seg.length < 2) { seg = []; return; }
    tikz += `  \\draw[${style}] plot[smooth] coordinates {${seg.map(([x, y]) => `(${fmt(x)},${fmt(y)})`).join(' ')}};\n`;
    seg = [];
  };

  for (const pt of points) {
    if (pt === null) {
      flushSeg();
    } else {
      seg.push(pt);
    }
  }
  flushSeg();
  return tikz;
}

// ─── Axes + Grid TikZ ─────────────────────────────────────────────────────────

export interface AxesOptions {
  show_grid?: boolean;
  grid_step?: number;
  x_ticks?: number[];
  y_ticks?: number[];
  x_tick_labels?: string[];
  y_tick_labels?: string[];
  x_label?: string;
  y_label?: string;
  show_origin_label?: boolean;
  tick_size?: number;
}

export function generateAxesTikz(
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
  opts: AxesOptions = {},
): string {
  let tikz = '';
  const ts = opts.tick_size ?? 0.08;

  // Grid
  if (opts.show_grid) {
    const step = opts.grid_step ?? 1;
    tikz += `  \\draw[gray!25, very thin] (${fmt(xmin)},${fmt(ymin)}) grid[step=${fmt(step)}] (${fmt(xmax)},${fmt(ymax)});\n`;
  }

  // X axis
  tikz += `  \\draw[->, thick] (${fmt(xmin - 0.3)},0) -- (${fmt(xmax + 0.5)},0) node[right] {$${opts.x_label ?? 'x'}$};\n`;
  // Y axis
  tikz += `  \\draw[->, thick] (0,${fmt(ymin - 0.3)}) -- (0,${fmt(ymax + 0.5)}) node[above] {$${opts.y_label ?? 'y'}$};\n`;

  // Origin
  if (opts.show_origin_label !== false) {
    tikz += `  \\node[below left, small] at (0,0) {$O$};\n`;
  }

  // X ticks
  const xTicks = opts.x_ticks ??
    Array.from({ length: Math.floor(xmax) - Math.ceil(xmin) + 1 }, (_, i) => Math.ceil(xmin) + i)
      .filter(v => v !== 0 && v >= xmin && v <= xmax);
  for (let i = 0; i < xTicks.length; i++) {
    const v = xTicks[i];
    const lbl = opts.x_tick_labels?.[i] ?? fmtLabel(v);
    tikz += `  \\draw (${fmt(v)},${fmt(ts)}) -- (${fmt(v)},${fmt(-ts)}) node[below] {\\small $${lbl}$};\n`;
  }

  // Y ticks
  const yTicks = opts.y_ticks ??
    Array.from({ length: Math.floor(ymax) - Math.ceil(ymin) + 1 }, (_, i) => Math.ceil(ymin) + i)
      .filter(v => v !== 0 && v >= ymin && v <= ymax);
  for (let i = 0; i < yTicks.length; i++) {
    const v = yTicks[i];
    const lbl = opts.y_tick_labels?.[i] ?? fmtLabel(v);
    tikz += `  \\draw (${fmt(ts)},${fmt(v)}) -- (${fmt(-ts)},${fmt(v)}) node[left] {\\small $${lbl}$};\n`;
  }

  return tikz;
}

// ─── Auto range from samples ──────────────────────────────────────────────────

export function autoRange(
  fn: (x: number) => number,
  domain: [number, number],
  numPoints = 50,
  padding = 0.5,
): [number, number] {
  let ymin = Infinity, ymax = -Infinity;
  const [a, b] = domain;
  const step = (b - a) / numPoints;
  for (let i = 0; i <= numPoints; i++) {
    const x = a + i * step;
    try {
      const y = fn(x);
      if (isFinite(y) && !isNaN(y)) {
        ymin = Math.min(ymin, y);
        ymax = Math.max(ymax, y);
      }
    } catch { /* skip */ }
  }
  if (!isFinite(ymin)) { ymin = -5; ymax = 5; }
  return [ymin - padding, ymax + padding];
}

// ─── Numeric derivative ───────────────────────────────────────────────────────

export function numericalDerivative(
  fn: (x: number) => number,
  x: number,
  h = 1e-6,
): number {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

// ─── GraphOutput type ─────────────────────────────────────────────────────────

export interface GraphOutput {
  tikz: string;
  points?: Record<string, [number, number]>;
  computed?: Record<string, unknown>;
  construction_steps?: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;
  }>;
}

// ─── TikZ wrappers ────────────────────────────────────────────────────────────

export function wrapTikz(body: string, scale = 0.75): string {
  return `\\begin{tikzpicture}[scale=${fmt(scale, 2)}, line cap=round, line join=round]\n${body}\\end{tikzpicture}`;
}

// ─── Marked point helper ──────────────────────────────────────────────────────

export function markedPointTikz(
  x: number, y: number, label: string,
  opts: { anchor?: string; color?: string; show_coords?: boolean } = {},
): string {
  const color = opts.color ?? 'red!70!black';
  const anchor = opts.anchor ?? 'above right';
  const lbl = opts.show_coords
    ? `${label}(${fmtLabel(x)}, ${fmtLabel(y)})`
    : label;
  return `  \\fill[${color}] (${fmt(x)},${fmt(y)}) circle (0.07) node[${anchor}] {\\small $${lbl}$};\n`;
}

// ─── Pi-axis ticks ────────────────────────────────────────────────────────────

export function piAxisTicks(
  xmin: number,
  xmax: number,
  denominator = 2,
): { ticks: number[]; labels: string[] } {
  const pi = Math.PI;
  const step = pi / denominator;
  const ticks: number[] = [];
  const labels: string[] = [];

  let k = Math.ceil(xmin / step);
  while (k * step <= xmax + 1e-9) {
    const val = k * step;
    ticks.push(val);
    // Label
    if (k === 0) labels.push('0');
    else if (k === 1 && denominator === 1) labels.push('\\pi');
    else if (k === -1 && denominator === 1) labels.push('-\\pi');
    else if (denominator === 1) labels.push(`${k}\\pi`);
    else if (k === 1) labels.push(`\\frac{\\pi}{${denominator}}`);
    else if (k === -1) labels.push(`-\\frac{\\pi}{${denominator}}`);
    else {
      // Simplify fraction
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const g = gcd(Math.abs(k), denominator);
      const num = k / g;
      const den = denominator / g;
      if (den === 1) labels.push(num === 1 ? '\\pi' : num === -1 ? '-\\pi' : `${num}\\pi`);
      else labels.push(num < 0 ? `-\\frac{${Math.abs(num)}\\pi}{${den}}` : `\\frac{${num}\\pi}{${den}}`);
    }
    k++;
  }
  return { ticks, labels };
}
