/**
 * limits.ts — Limit visualization: approach arrows, open/closed points.
 * ZERO AI — pure math + TikZ.
 */

import {
  fmt, fmtLabel,
  evaluateExpression,
  sampleFunctionSmart,
  pointsToTikzSegments,
  generateAxesTikz,
  wrapTikz,
  markedPointTikz,
  type GraphOutput,
} from './_helpers';

export type LimitSide = 'left' | 'right' | 'both';

export interface LimitVisualizationInput {
  expression: string;
  approach_point: number;     // x → a
  limit_value?: number;       // L (if known/given; else computed numerically)
  side?: LimitSide;           // default 'both'
  domain?: [number, number];
  range?: [number, number];
  show_grid?: boolean;
  show_approach_arrows?: boolean;
  show_open_point?: boolean;  // open circle at (a, f(a)) if discontinuous
  show_closed_point?: boolean;// filled circle at actual limit value
  label?: string;
}

export function generateLimitVisualization(input: LimitVisualizationInput): GraphOutput {
  const { expression } = input;
  const a = input.approach_point;
  const side = input.side ?? 'both';

  const fn = (x: number) => evaluateExpression(expression, x);

  // Compute limit numerically
  const h = 1e-7;
  const limitLeft = fn(a - h);
  const limitRight = fn(a + h);
  const limitVal = input.limit_value ?? (
    isFinite(limitLeft) && isFinite(limitRight) && Math.abs(limitLeft - limitRight) < 1e-4
      ? (limitLeft + limitRight) / 2
      : NaN
  );

  const [xmin, xmax] = input.domain ?? [a - 4, a + 4];
  const fnActual = fn(a);
  const centerY = isFinite(limitVal) ? limitVal : (isFinite(fnActual) ? fnActual : 0);
  const spread = 4;
  const [ymin, ymax] = input.range ?? [centerY - spread, centerY + spread];

  const points = sampleFunctionSmart(fn, [xmin, xmax], 300, ymin, ymax);
  const curveTikz = pointsToTikzSegments(points, 'thick, blue');

  const axesTikz = generateAxesTikz(xmin, xmax, ymin, ymax, { show_grid: input.show_grid });

  let limitTikz = '';

  // Vertical dashed at x = a
  limitTikz += `  \\draw[gray!60, dashed] (${fmt(a)},${fmt(ymin)}) -- (${fmt(a)},${fmt(ymax)});\n`;
  limitTikz += `  \\node[below] at (${fmt(a)},${fmt(ymin)}) {\\small $a=${fmtLabel(a)}$};\n`;

  // Horizontal dashed at y = L
  if (isFinite(limitVal)) {
    limitTikz += `  \\draw[orange!80!black, dashed] (${fmt(xmin)},${fmt(limitVal)}) -- (${fmt(xmax)},${fmt(limitVal)});\n`;
    limitTikz += `  \\node[orange!80!black, right] at (${fmt(xmax)},${fmt(limitVal)}) {\\small $L=${fmtLabel(limitVal)}$};\n`;
  }

  // Approach arrows on x-axis
  if (input.show_approach_arrows !== false) {
    const arrowOffset = (xmax - xmin) * 0.08;
    if (side === 'left' || side === 'both') {
      // Arrow from left toward a
      limitTikz += `  \\draw[->, orange, thick] (${fmt(a - arrowOffset * 2)},${fmt(ymin * 0.15)}) -- (${fmt(a - 0.15)},${fmt(ymin * 0.15)});\n`;
    }
    if (side === 'right' || side === 'both') {
      // Arrow from right toward a
      limitTikz += `  \\draw[->, orange, thick] (${fmt(a + arrowOffset * 2)},${fmt(ymin * 0.15)}) -- (${fmt(a + 0.15)},${fmt(ymin * 0.15)});\n`;
    }
  }

  // Open circle at (a, f(a)) if function not defined or discontinuous
  if (input.show_open_point !== false && isFinite(limitVal)) {
    const fa = fn(a);
    if (!isFinite(fa) || Math.abs(fa - limitVal) > 0.05) {
      // Open circle at limit value
      limitTikz += `  \\draw[blue, fill=white] (${fmt(a)},${fmt(limitVal)}) circle (0.09);\n`;
    }
  }

  // Filled circle at actual value or limit
  if (input.show_closed_point !== false && isFinite(limitVal)) {
    const fa = fn(a);
    if (isFinite(fa) && Math.abs(fa - limitVal) < 0.05) {
      limitTikz += markedPointTikz(a, limitVal, `(${fmtLabel(a)},${fmtLabel(limitVal)})`, { anchor: 'above right' });
    }
  }

  // Label
  let equationTikz = '';
  const expr = input.label ?? expression;
  const sideSym = side === 'left' ? '^{-}' : side === 'right' ? '^{+}' : '';
  const limitLabel = isFinite(limitVal) ? `= ${fmtLabel(limitVal)}` : '';
  equationTikz += `  \\node[blue, above right] at (${fmt(xmin)},${fmt(ymax)}) {\\small $\\lim_{x\\to ${fmtLabel(a)}${sideSym}} f(x) ${limitLabel}$};\n`;
  equationTikz += `  \\node[gray, below right] at (${fmt(xmin)},${fmt(ymax * 0.85)}) {\\small $f(x)=${expr}$};\n`;

  const body = axesTikz + curveTikz + limitTikz + equationTikz;
  const tikz = wrapTikz(body, 0.7);

  return {
    tikz,
    computed: {
      expression,
      approach_point: a,
      limit_value: isFinite(limitVal) ? limitVal : 'does not exist',
      limit_from_left: isFinite(limitLeft) ? parseFloat(limitLeft.toFixed(6)) : 'infinity',
      limit_from_right: isFinite(limitRight) ? parseFloat(limitRight.toFixed(6)) : 'infinity',
      side,
    },
  };
}
