/**
 * asymptotes.ts — Asymptote visualization for function graphs.
 * Supports vertical, horizontal, and oblique asymptotes.
 * ZERO AI — pure math + TikZ.
 */

import {
  fmt, fmtLabel,
  evaluateExpression,
  sampleFunctionSmart,
  pointsToTikzSegments,
  generateAxesTikz,
  wrapTikz,
  type GraphOutput,
} from './_helpers';

export interface AsymptoteSpec {
  type: 'vertical' | 'horizontal' | 'oblique';
  /** For vertical: x = value */
  x?: number;
  /** For horizontal: y = value */
  y?: number;
  /** For oblique: y = slope·x + intercept */
  slope?: number;
  intercept?: number;
  label?: string;
}

export interface AsymptotePlotInput {
  expression: string;          // f(x) expression string
  domain: [number, number];
  range?: [number, number];
  asymptotes: AsymptoteSpec[];
  show_grid?: boolean;
  show_approach_arrows?: boolean; // arrows showing x→asymptote
  label?: string;
}

export function generateAsymptotePlot(input: AsymptotePlotInput): GraphOutput {
  const { expression, asymptotes } = input;
  const [xmin, xmax] = input.domain;
  const [ymin, ymax] = input.range ?? [-8, 8];

  const fn = (x: number) => evaluateExpression(expression, x);
  const points = sampleFunctionSmart(fn, [xmin, xmax], 350, ymin, ymax);
  const curveTikz = pointsToTikzSegments(points, 'thick, blue');

  const axesTikz = generateAxesTikz(xmin, xmax, ymin, ymax, { show_grid: input.show_grid });

  let asymTikz = '';
  for (const a of asymptotes) {
    const lbl = a.label ?? '';
    switch (a.type) {
      case 'vertical': {
        const x = a.x ?? 0;
        asymTikz += `  \\draw[red!70, dashed, thick] (${fmt(x)},${fmt(ymin - 0.2)}) -- (${fmt(x)},${fmt(ymax + 0.2)});\n`;
        asymTikz += `  \\node[red!70, above right] at (${fmt(x)},${fmt(ymax)}) {\\small $x=${fmtLabel(x)}${lbl}$};\n`;
        break;
      }
      case 'horizontal': {
        const y = a.y ?? 0;
        asymTikz += `  \\draw[orange!80!black, dashed, thick] (${fmt(xmin - 0.2)},${fmt(y)}) -- (${fmt(xmax + 0.2)},${fmt(y)});\n`;
        asymTikz += `  \\node[orange!80!black, right] at (${fmt(xmax)},${fmt(y)}) {\\small $y=${fmtLabel(y)}${lbl}$};\n`;
        break;
      }
      case 'oblique': {
        const m = a.slope ?? 0;
        const b = a.intercept ?? 0;
        const y1 = m * xmin + b;
        const y2 = m * xmax + b;
        asymTikz += `  \\draw[violet, dashed, thick] (${fmt(xmin)},${fmt(y1)}) -- (${fmt(xmax)},${fmt(y2)});\n`;
        const mStr = Math.abs(m - 1) < 1e-9 ? '' : fmtLabel(m);
        const bStr = Math.abs(b) < 1e-9 ? '' : (b > 0 ? `+${fmtLabel(b)}` : fmtLabel(b));
        asymTikz += `  \\node[violet, right] at (${fmt(xmax)},${fmt(y2)}) {\\small $y=${mStr}x${bStr}${lbl}$};\n`;
        break;
      }
    }
  }

  let equationTikz = '';
  if (input.label) {
    equationTikz = `  \\node[blue, above right] at (${fmt(xmin)},${fmt(ymax)}) {\\small $${input.label}$};\n`;
  }

  const body = axesTikz + asymTikz + curveTikz + equationTikz;
  const tikz = wrapTikz(body, 0.7);

  return {
    tikz,
    computed: {
      expression,
      asymptote_count: asymptotes.length,
      vertical_asymptotes: asymptotes.filter(a => a.type === 'vertical').map(a => a.x ?? 0),
      horizontal_asymptotes: asymptotes.filter(a => a.type === 'horizontal').map(a => a.y ?? 0),
    },
  };
}

// ─── Auto-detect horizontal/oblique asymptote from limits ────────────────────

export function detectHorizontalAsymptote(fn: (x: number) => number, large = 1e6): { y: number } | null {
  const yRight = fn(large);
  const yLeft = fn(-large);
  if (isFinite(yRight) && Math.abs(yRight - yLeft) < 0.01) {
    return { y: parseFloat(yRight.toFixed(4)) };
  }
  return null;
}
