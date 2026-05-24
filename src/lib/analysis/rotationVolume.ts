/**
 * rotationVolume.ts — Solid of revolution visualization (Pappus / washer method).
 * Shows the generating curve + axis + indication of the 3D solid.
 * Volume computed numerically via disk/washer method.
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

export interface RotationVolumeInput {
  expression: string;    // f(x) — outer radius (rotated around x-axis)
  inner_expression?: string; // g(x) — inner radius (for washer method)
  a: number;             // lower bound
  b: number;             // upper bound
  axis?: 'x' | 'y';     // rotation axis (default 'x')
  domain?: [number, number];
  range?: [number, number];
  show_grid?: boolean;
  show_washer?: boolean; // show washer cross-sections
  num_washers?: number;  // default 5
  label?: string;
}

function numericalVolume(
  fn: (x: number) => number,
  gn: ((x: number) => number) | null,
  a: number,
  b: number,
  n = 2000,
): number {
  const h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = a + (i + 0.5) * h;
    const R = Math.abs(fn(x));
    const r = gn !== null ? Math.abs(gn(x)) : 0;
    if (isFinite(R) && isFinite(r)) {
      sum += Math.PI * (R * R - r * r) * h;
    }
  }
  return sum;
}

export function generateRotationVolume(input: RotationVolumeInput): GraphOutput {
  const { expression, a, b } = input;
  const fn = (x: number) => evaluateExpression(expression, x);
  const gn = input.inner_expression
    ? (x: number) => evaluateExpression(input.inner_expression!, x)
    : null;

  const domPad = (b - a) * 0.4;
  const [xmin, xmax] = input.domain ?? [a - domPad, b + domPad];
  const [ymin, ymax] = input.range ?? [-5, 5];

  const axesTikz = generateAxesTikz(xmin, xmax, ymin, ymax, { show_grid: input.show_grid });

  const points = sampleFunctionSmart(fn, [xmin, xmax], 250, ymin, ymax);
  const curveTikz = pointsToTikzSegments(points, 'thick, blue');

  // Reflected curve (y → -y), shown dashed — simulates rotation
  const reflPoints = sampleFunctionSmart(
    (x) => -fn(x),
    [xmin, xmax], 250, ymin, ymax,
  );
  const reflCurveTikz = pointsToTikzSegments(reflPoints, 'blue, dashed, thin');

  // Fill region between curve and its reflection (rotational "shadow")
  const fillPts = sampleFunction(fn, [a, b], 80, ymin, ymax);
  const validFill = fillPts.filter((p): p is [number, number] => p !== null);
  let fillTikz = '';
  if (validFill.length > 1) {
    const fwd = validFill.map(([x, y]) => `(${fmt(x)},${fmt(y)})`).join(' ');
    const rev = [...validFill].reverse().map(([x, y]) => `(${fmt(x)},${fmt(-y)})`).join(' ');
    fillTikz = `  \\fill[blue!10, opacity=0.7] plot[smooth] coordinates {${fwd}} -- plot[smooth] coordinates {${rev}} -- cycle;\n`;
  }

  // Washer cross-sections
  let washerTikz = '';
  if (input.show_washer !== false) {
    const nW = input.num_washers ?? 5;
    const step = (b - a) / (nW + 1);
    for (let i = 1; i <= nW; i++) {
      const x = a + i * step;
      const R = Math.abs(fn(x));
      const r = gn ? Math.abs(gn(x)) : 0;
      if (!isFinite(R)) continue;
      // Draw ellipse representing the washer face (in 2D projection)
      const EY = 0.25; // ellipse y-factor
      // Outer ellipse
      washerTikz += `  \\draw[blue!60, thin] (${fmt(x)},0) ellipse (${fmt(EY * R)} and ${fmt(R)});\n`;
      // Inner ellipse if washer
      if (r > 0.01 && isFinite(r)) {
        washerTikz += `  \\draw[white, fill=white] (${fmt(x)},0) ellipse (${fmt(EY * r)} and ${fmt(r)});\n`;
        washerTikz += `  \\draw[blue!40, thin] (${fmt(x)},0) ellipse (${fmt(EY * r)} and ${fmt(r)});\n`;
      }
    }
  }

  // Bound verticals
  const fa = fn(a), fb = fn(b);
  let boundsTikz = '';
  if (isFinite(fa)) {
    boundsTikz += `  \\draw[gray!60, dashed] (${fmt(a)},${fmt(-Math.abs(fa))}) -- (${fmt(a)},${fmt(Math.abs(fa))});\n`;
    boundsTikz += `  \\node[below] at (${fmt(a)},${fmt(ymin)}) {\\small $${fmtLabel(a)}$};\n`;
  }
  if (isFinite(fb)) {
    boundsTikz += `  \\draw[gray!60, dashed] (${fmt(b)},${fmt(-Math.abs(fb))}) -- (${fmt(b)},${fmt(Math.abs(fb))});\n`;
    boundsTikz += `  \\node[below] at (${fmt(b)},${fmt(ymin)}) {\\small $${fmtLabel(b)}$};\n`;
  }

  // Volume value
  const volume = numericalVolume(fn, gn, a, b);

  const labelTikz = `  \\node[blue, above right] at (${fmt(xmin)},${fmt(ymax)}) {\\small $V = \\pi\\int_{${fmtLabel(a)}}^{${fmtLabel(b)}}[f(x)]^2\\,dx \\approx ${fmtLabel(volume)}$};\n`;
  const exprTikz = `  \\node[gray, below right] at (${fmt(xmin)},${fmt(ymax * 0.82)}) {\\small $f(x)=${input.label ?? expression}$};\n`;

  const body = axesTikz + fillTikz + washerTikz + curveTikz + reflCurveTikz + boundsTikz + labelTikz + exprTikz;
  const tikz = wrapTikz(body, 0.7);

  return {
    tikz,
    computed: {
      expression,
      lower_bound: a,
      upper_bound: b,
      volume: parseFloat(volume.toFixed(6)),
      volume_over_pi: parseFloat((volume / Math.PI).toFixed(6)),
    },
  };
}
