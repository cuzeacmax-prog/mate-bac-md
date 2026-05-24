/**
 * functionTrig.ts — Trigonometric function plot calculators.
 * Supports sin, cos, tan, cot with A·f(Bx + C) + D form.
 * Handles discontinuities in tan/cot by splitting branches.
 * ZERO AI — pure math + TikZ.
 */

import {
  fmt, fmtLabel,
  sampleFunctionSmart,
  pointsToTikzSegments,
  generateAxesTikz,
  wrapTikz,
  markedPointTikz,
  piAxisTicks,
  type GraphOutput,
} from './_helpers';

const PI = Math.PI;

export type TrigType = 'sin' | 'cos' | 'tan' | 'cot';

export interface TrigFunctionInput {
  type: TrigType;
  amplitude?: number;        // A  (default 1)
  frequency?: number;        // B  (default 1)
  phase?: number;            // C  (default 0, in radians)
  vertical_shift?: number;   // D  (default 0)
  domain?: [number, number]; // default [-2π, 2π]
  range?: [number, number];  // y limits; default auto for sin/cos, [-4,4] for tan/cot
  show_grid?: boolean;
  show_period_marker?: boolean;
  show_amplitude_lines?: boolean;
  show_max_min_points?: boolean;
  show_zeros?: boolean;
  show_asymptotes?: boolean;
  x_axis_in_pi?: boolean;    // label x-axis with π/2, π, 3π/2, …
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTrigFn(type: TrigType, A: number, B: number, C: number, D: number) {
  return (x: number): number => {
    const arg = B * x + C;
    switch (type) {
      case 'sin': return A * Math.sin(arg) + D;
      case 'cos': return A * Math.cos(arg) + D;
      case 'tan': {
        const v = Math.tan(arg);
        if (!isFinite(v)) return NaN;
        return A * v + D;
      }
      case 'cot': {
        const s = Math.sin(arg);
        if (Math.abs(s) < 1e-10) return NaN;
        return A * (Math.cos(arg) / s) + D;
      }
    }
  };
}

/** Period of the function (in x-units) */
function period(B: number, type: TrigType): number {
  return type === 'tan' || type === 'cot' ? PI / Math.abs(B) : 2 * PI / Math.abs(B);
}

/** Asymptote x-positions for tan: B·x + C = π/2 + k·π → x = (π/2 + k·π - C)/B */
function tanAsymptotes(B: number, C: number, xmin: number, xmax: number): number[] {
  const xs: number[] = [];
  // x = (π/2 - C + k·π) / B for integer k
  let k = Math.floor((B * xmin - PI / 2 + C) / PI) - 1;
  while (true) {
    const x = (PI / 2 + k * PI - C) / B;
    if (x > xmax + 1e-9) break;
    if (x >= xmin - 1e-9) xs.push(x);
    k++;
  }
  return xs;
}

/** Asymptote x-positions for cot: B·x + C = k·π → x = (k·π - C)/B */
function cotAsymptotes(B: number, C: number, xmin: number, xmax: number): number[] {
  const xs: number[] = [];
  let k = Math.floor((B * xmin + C) / PI) - 1;
  while (true) {
    const x = (k * PI - C) / B;
    if (x > xmax + 1e-9) break;
    if (x >= xmin - 1e-9) xs.push(x);
    k++;
  }
  return xs;
}

/** Zeros of A·sin/cos(Bx+C)+D */
function sinCosZeros(type: TrigType, A: number, B: number, C: number, D: number, xmin: number, xmax: number): number[] {
  if (Math.abs(A) < 1e-10) return [];
  const ratio = -D / A;
  if (Math.abs(ratio) > 1 + 1e-9) return [];
  const base = Math.asin(Math.max(-1, Math.min(1, ratio)));
  const zeros: number[] = [];
  // For sin: Bx+C = base + 2kπ  or  π-base + 2kπ
  // For cos: Bx+C = ±acos(ratio) + 2kπ
  const candidates = type === 'sin'
    ? [base, PI - base]
    : [Math.acos(Math.max(-1, Math.min(1, ratio))), -Math.acos(Math.max(-1, Math.min(1, ratio)))];

  for (const ang of candidates) {
    let k = Math.floor((B * xmin + C - ang) / (2 * PI)) - 1;
    while (true) {
      const x = (ang - C + 2 * k * PI) / B;
      if (x > xmax + 1e-9) break;
      if (x >= xmin - 1e-9) zeros.push(x);
      k++;
    }
  }
  return zeros.filter((v, i, arr) => arr.findIndex(w => Math.abs(w - v) < 1e-6) === i).sort((a, b) => a - b);
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateTrigFunctionPlot(input: TrigFunctionInput): GraphOutput {
  const { type } = input;
  const A = input.amplitude ?? 1;
  const B = input.frequency ?? 1;
  const C = input.phase ?? 0;
  const D = input.vertical_shift ?? 0;

  const defaultDomain: [number, number] = [-2 * PI, 2 * PI];
  const [xmin, xmax] = input.domain ?? defaultDomain;

  const isBoundedType = type === 'sin' || type === 'cos';
  const yRange = input.range ?? (isBoundedType ? [D - Math.abs(A) - 0.5, D + Math.abs(A) + 0.5] : [-4, 4]);
  const [ymin, ymax] = yRange;

  const fn = makeTrigFn(type, A, B, C, D);

  // Sample — smart (null at discontinuities)
  const points = sampleFunctionSmart(fn, [xmin, xmax], 400, ymin, ymax);
  const curveTikz = pointsToTikzSegments(points, 'thick, blue');

  // Asymptotes
  let asymptoteTikz = '';
  const asymptotes: number[] = [];
  if (type === 'tan' || type === 'cot') {
    const xs = type === 'tan'
      ? tanAsymptotes(B, C, xmin, xmax)
      : cotAsymptotes(B, C, xmin, xmax);
    asymptotes.push(...xs);
    if (input.show_asymptotes !== false) {
      for (const x of xs) {
        asymptoteTikz += `  \\draw[red!60, dashed, thin] (${fmt(x)},${fmt(ymin - 0.3)}) -- (${fmt(x)},${fmt(ymax + 0.3)});\n`;
      }
    }
  }

  // Axes
  let xTicks: number[] | undefined;
  let xTickLabels: string[] | undefined;
  if (input.x_axis_in_pi !== false) {
    // Determine best denominator based on period
    const T = period(B, type);
    let denom = 2;
    // For period = π, use denominator=1 (ticks at multiples of π); for 2π use 2
    if (Math.abs(T - PI) < 0.01) denom = 1;
    else if (Math.abs(T - 2 * PI) < 0.01) denom = 2;
    else if (Math.abs(T - PI / 2) < 0.01) denom = 4;
    const { ticks, labels } = piAxisTicks(xmin, xmax, denom);
    xTicks = ticks;
    xTickLabels = labels;
  }

  const axesTikz = generateAxesTikz(xmin, xmax, ymin, ymax, {
    show_grid: input.show_grid,
    x_ticks: xTicks,
    x_tick_labels: xTickLabels,
  });

  // Amplitude lines (horizontal dashed at ±A+D)
  let amplitudeTikz = '';
  if (input.show_amplitude_lines && isBoundedType && Math.abs(A) > 0.01) {
    const topY = D + Math.abs(A);
    const botY = D - Math.abs(A);
    amplitudeTikz += `  \\draw[green!60!black, dashed] (${fmt(xmin)},${fmt(topY)}) -- (${fmt(xmax)},${fmt(topY)}) node[right] {\\small $y=${fmtLabel(topY)}$};\n`;
    amplitudeTikz += `  \\draw[green!60!black, dashed] (${fmt(xmin)},${fmt(botY)}) -- (${fmt(xmax)},${fmt(botY)}) node[right] {\\small $y=${fmtLabel(botY)}$};\n`;
    if (Math.abs(D) > 0.01) {
      amplitudeTikz += `  \\draw[green!50, dashed, thin] (${fmt(xmin)},${fmt(D)}) -- (${fmt(xmax)},${fmt(D)});\n`;
    }
  }

  // Period marker
  let periodTikz = '';
  if (input.show_period_marker) {
    const T = period(B, type);
    // Draw a double-headed arrow for one period starting near x=0
    // Find start of a period near xmin that is visible
    const startX = Math.ceil(xmin / T) * T;
    const endX = startX + T;
    if (endX <= xmax + 1e-9) {
      const arrowY = ymin + (ymax - ymin) * 0.08;
      periodTikz += `  \\draw[<->, orange, thick] (${fmt(startX)},${fmt(arrowY)}) -- (${fmt(endX)},${fmt(arrowY)}) node[midway, below] {\\small $T=${fmtLabel(T / PI)}\\pi$};\n`;
    }
  }

  // Max / min points
  let extremaTikz = '';
  if (input.show_max_min_points && isBoundedType) {
    const T = period(B, type);
    // Maxima: sin at Bx+C = π/2, cos at Bx+C = 0
    // Minima: sin at Bx+C = 3π/2 or -π/2, cos at Bx+C = π
    const maxArg = type === 'sin' ? PI / 2 : 0;
    const minArg = type === 'sin' ? -PI / 2 : PI;

    const yMax = D + Math.abs(A);
    const yMin = D - Math.abs(A);

    for (let arg = maxArg; ; arg += 2 * PI) {
      const x = (arg - C) / B;
      if (x > xmax + 1e-9) break;
      if (x >= xmin - 1e-9) extremaTikz += markedPointTikz(x, yMax, '', { color: 'red', anchor: 'above' });
    }
    for (let arg = maxArg; ; arg -= 2 * PI) {
      const x = (arg - C) / B;
      if (x < xmin - 1e-9) break;
      if (x <= xmax + 1e-9) extremaTikz += markedPointTikz(x, yMax, '', { color: 'red', anchor: 'above' });
    }
    for (let arg = minArg; ; arg += 2 * PI) {
      const x = (arg - C) / B;
      if (x > xmax + 1e-9) break;
      if (x >= xmin - 1e-9) extremaTikz += markedPointTikz(x, yMin, '', { color: 'red!70!blue', anchor: 'below' });
    }
    for (let arg = minArg; ; arg -= 2 * PI) {
      const x = (arg - C) / B;
      if (x < xmin - 1e-9) break;
      if (x <= xmax + 1e-9) extremaTikz += markedPointTikz(x, yMin, '', { color: 'red!70!blue', anchor: 'below' });
    }
  }

  // Zeros
  let zerosTikz = '';
  if (input.show_zeros && isBoundedType) {
    const zeros = sinCosZeros(type, A, B, C, D, xmin, xmax);
    for (const z of zeros) {
      zerosTikz += `  \\fill[black!70] (${fmt(z)},0) circle (0.06);\n`;
    }
  }

  // Equation label
  const phaseStr = Math.abs(C) < 1e-6 ? '' : (C > 0 ? `+${fmtLabel(C)}` : fmtLabel(C));
  const BStr = Math.abs(B - 1) < 1e-6 ? '' : fmtLabel(B);
  const AStr = Math.abs(A - 1) < 1e-6 ? '' : fmtLabel(A);
  const DStr = Math.abs(D) < 1e-6 ? '' : (D > 0 ? `+${fmtLabel(D)}` : fmtLabel(D));
  const equation = `y = ${AStr}\\${type}(${BStr}x${phaseStr})${DStr}`;
  const equationTikz = `  \\node[blue, above right] at (${fmt(xmin)},${fmt(ymax)}) {\\small $${equation}$};\n`;

  const body = axesTikz + amplitudeTikz + asymptoteTikz + curveTikz + periodTikz + extremaTikz + zerosTikz + equationTikz;
  const tikz = wrapTikz(body, 0.7);

  const T = period(B, type);
  return {
    tikz,
    computed: {
      type,
      amplitude: Math.abs(A),
      period: T,
      period_in_pi: T / PI,
      phase_shift: -C / B,
      vertical_shift: D,
      asymptote_count: asymptotes.length,
      equation,
    },
  };
}
