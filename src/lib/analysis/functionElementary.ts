/**
 * functionElementary.ts — Calculatoare pentru funcțiile elementare din BAC MD.
 * Funcții: liniară, pătratică, putere, radical, exponențială, logaritmică, modul.
 * ZERO AI. Matematică pură deterministă.
 */

import {
  fmt, fmtLabel, GraphOutput,
  generateAxesTikz, pointsToTikzSegments,
  sampleFunction, autoRange, wrapTikz, markedPointTikz,
} from './_helpers';

// ─── GraphOutput re-export ─────────────────────────────────────────────────────
export type { GraphOutput };

// ─── Linear Function: y = ax + b ─────────────────────────────────────────────

export interface LinearFunctionInput {
  a: number;           // pantă
  b: number;           // ordonată la origine
  domain?: [number, number];
  show_grid?: boolean;
  show_slope_triangle?: boolean;
  show_intercepts?: boolean;
  show_equation?: boolean;
}

export function generateLinearFunctionPlot(input: LinearFunctionInput): GraphOutput {
  const { a, b } = input;
  const domain: [number, number] = input.domain ?? [-5, 5];
  const [xmin, xmax] = domain;
  const fn = (x: number) => a * x + b;
  const yVals = [fn(xmin), fn(xmax)];
  const ymin = Math.min(...yVals, -1) - 1;
  const ymax = Math.max(...yVals, 1) + 1;

  const points: Record<string, [number, number]> = {};

  let body = generateAxesTikz(xmin, xmax, ymin, ymax, { show_grid: input.show_grid ?? true });

  // The line: just 2 points is enough
  body += `  \\draw[thick, blue] (${fmt(xmin)},${fmt(fn(xmin))}) -- (${fmt(xmax)},${fmt(fn(xmax))});\n`;

  // Slope triangle
  if (input.show_slope_triangle && a !== 0) {
    const x1 = 1;
    const x2 = x1 + 1;
    const y1 = fn(x1);
    const y2 = fn(x2);
    body += `  \\draw[red, thin] (${fmt(x1)},${fmt(y1)}) -- (${fmt(x2)},${fmt(y1)}) -- (${fmt(x2)},${fmt(y2)}) -- cycle;\n`;
    body += `  \\node[below, red, font=\\small] at (${fmt((x1 + x2) / 2)},${fmt(y1)}) {$1$};\n`;
    body += `  \\node[right, red, font=\\small] at (${fmt(x2)},${fmt((y1 + y2) / 2)}) {$${fmtLabel(a)}$};\n`;
  }

  // X intercept: ax + b = 0 → x = -b/a
  if (input.show_intercepts !== false && a !== 0) {
    const xi = -b / a;
    if (xi >= xmin && xi <= xmax) {
      body += markedPointTikz(xi, 0, `(${fmtLabel(xi)}, 0)`, { anchor: 'below right', color: 'red!70!black', show_coords: false });
      body += `  \\node[below, red!70!black, font=\\small] at (${fmt(xi)},0) {$${fmtLabel(xi)}$};\n`;
      points['X0'] = [xi, 0];
    }
  }
  // Y intercept: (0, b)
  if (input.show_intercepts !== false && b !== 0) {
    body += `  \\fill[red!70!black] (0,${fmt(b)}) circle (0.07) node[right, font=\\small] {$(0, ${fmtLabel(b)})$};\n`;
    points['Y0'] = [0, b];
  }

  // Equation label
  if (input.show_equation !== false) {
    const sign = b >= 0 ? '+' : '';
    body += `  \\node[above, blue] at (${fmt(xmax - 0.5)},${fmt(fn(xmax - 0.5))}) {\\small $y=${fmtLabel(a)}x${sign}${fmtLabel(b)}$};\n`;
  }

  const slopeSign = a > 0 ? 'crescătoare' : a < 0 ? 'descrescătoare' : 'constantă';
  const xIntercept = a !== 0 ? -b / a : undefined;

  return {
    tikz: wrapTikz(body),
    points,
    computed: {
      slope: a,
      y_intercept: b,
      x_intercept: xIntercept ?? 0,
      type: slopeSign,
    },
    construction_steps: [
      { step: 1, title: 'Funcția liniară', explanation: `f(x) = ${fmtLabel(a)}x + ${fmtLabel(b)}. Pantă a = ${fmtLabel(a)} (${slopeSign}).`, cumulative_tikz: wrapTikz(body) },
    ],
  };
}

// ─── Quadratic Function: y = ax² + bx + c ────────────────────────────────────

export interface QuadraticFunctionInput {
  a: number;
  b: number;
  c: number;
  domain?: [number, number];
  show_grid?: boolean;
  show_vertex?: boolean;
  show_axis_of_symmetry?: boolean;
  show_discriminant?: boolean;
  show_x_intercepts?: boolean;
  show_y_intercept?: boolean;
  highlight_positive?: boolean;
  highlight_negative?: boolean;
}

export function generateQuadraticFunctionPlot(input: QuadraticFunctionInput): GraphOutput {
  const { a, b, c } = input;
  if (a === 0) throw new Error('Coeficientul a nu poate fi 0 pentru funcție pătratică');
  const domain: [number, number] = input.domain ?? [-5, 5];
  const [xmin, xmax] = domain;
  const fn = (x: number) => a * x * x + b * x + c;

  const [ymin, ymax] = autoRange(fn, domain, 100, 0.8);
  const yRange: [number, number] = [Math.min(ymin, -0.5), Math.max(ymax, 0.5)];

  const points: Record<string, [number, number]> = {};
  const discriminant = b * b - 4 * a * c;
  const vertexX = -b / (2 * a);
  const vertexY = fn(vertexX);
  points['V'] = [vertexX, vertexY];

  let body = generateAxesTikz(xmin, xmax, yRange[0], yRange[1], { show_grid: input.show_grid ?? true });

  // The parabola
  const samples = sampleFunction(fn, domain, 150, yRange[0], yRange[1]);
  body += pointsToTikzSegments(samples, 'thick, blue');

  // Vertex
  if (input.show_vertex !== false) {
    const vLabel = `V(${fmtLabel(vertexX)};\\,${fmtLabel(vertexY)})`;
    const anchor = a > 0 ? 'above' : 'below';
    body += `  \\fill[red!70!black] (${fmt(vertexX)},${fmt(vertexY)}) circle (0.07) node[${anchor}] {\\small $${vLabel}$};\n`;
  }

  // Axis of symmetry
  if (input.show_axis_of_symmetry) {
    body += `  \\draw[dashed, gray] (${fmt(vertexX)},${fmt(yRange[0])}) -- (${fmt(vertexX)},${fmt(yRange[1])}) node[above, gray, font=\\small] {$x=${fmtLabel(vertexX)}$};\n`;
  }

  // X intercepts
  if (input.show_x_intercepts !== false && discriminant >= 0) {
    const sqrtD = Math.sqrt(discriminant);
    const x1 = (-b - sqrtD) / (2 * a);
    const x2 = (-b + sqrtD) / (2 * a);
    if (discriminant === 0) {
      body += `  \\fill[green!50!black] (${fmt(x1)},0) circle (0.07) node[below] {\\small $${fmtLabel(x1)}$};\n`;
      points['X1'] = [x1, 0];
    } else {
      if (x1 >= xmin && x1 <= xmax) {
        body += `  \\fill[green!50!black] (${fmt(x1)},0) circle (0.07) node[below] {\\small $${fmtLabel(x1)}$};\n`;
        points['X1'] = [x1, 0];
      }
      if (x2 >= xmin && x2 <= xmax) {
        body += `  \\fill[green!50!black] (${fmt(x2)},0) circle (0.07) node[below] {\\small $${fmtLabel(x2)}$};\n`;
        points['X2'] = [x2, 0];
      }
    }
  }

  // Y intercept
  if (input.show_y_intercept !== false && c !== 0) {
    body += `  \\fill[orange!80!black] (0,${fmt(c)}) circle (0.07) node[right, font=\\small] {$(0;\\,${fmtLabel(c)})$};\n`;
    points['Y0'] = [0, c];
  }

  // Discriminant info
  if (input.show_discriminant) {
    const dStr = fmtLabel(discriminant);
    const roots = discriminant > 0 ? '2 rădăcini reale distincte' : discriminant === 0 ? 'o rădăcină dublă' : 'fără rădăcini reale';
    body += `  \\node[below right, font=\\small] at (${fmt(xmin + 0.2)},${fmt(yRange[1] - 0.3)}) {$\\Delta = ${dStr}$ (${roots})};\n`;
  }

  const parabola = a > 0 ? 'ramuri în sus' : 'ramuri în jos';

  return {
    tikz: wrapTikz(body),
    points,
    computed: {
      discriminant,
      vertex_x: vertexX,
      vertex_y: vertexY,
      x1: discriminant >= 0 ? (-b - Math.sqrt(Math.max(0, discriminant))) / (2 * a) : NaN,
      x2: discriminant >= 0 ? (-b + Math.sqrt(Math.max(0, discriminant))) / (2 * a) : NaN,
      type: parabola,
    },
    construction_steps: [
      { step: 1, title: `Parabola ${a > 0 ? 'cu ramuri în sus' : 'cu ramuri în jos'}`, explanation: `f(x) = ${fmtLabel(a)}x² + ${fmtLabel(b)}x + ${fmtLabel(c)}. Vârf V(${fmtLabel(vertexX)}; ${fmtLabel(vertexY)}). Δ = ${fmtLabel(discriminant)}.`, cumulative_tikz: wrapTikz(body) },
    ],
  };
}

// ─── Power Function: y = a·xⁿ ─────────────────────────────────────────────────

export interface PowerFunctionInput {
  exponent: number;      // n
  coefficient?: number;  // a (default 1)
  domain?: [number, number];
  show_grid?: boolean;
  show_equation?: boolean;
}

export function generatePowerFunctionPlot(input: PowerFunctionInput): GraphOutput {
  const n = input.exponent;
  const a = input.coefficient ?? 1;
  // For negative/fractional exponents, domain must exclude 0 or be restricted
  let domain: [number, number];
  if (n < 0 || (n !== Math.floor(n) && n > 0)) {
    domain = input.domain ?? [0.1, 5];
  } else if (n % 2 === 0) {
    domain = input.domain ?? [-4, 4];
  } else {
    domain = input.domain ?? [-4, 4];
  }
  const [xmin, xmax] = domain;
  const fn = (x: number) => {
    if (x === 0 && n < 0) return NaN;
    if (x < 0 && !Number.isInteger(n)) return NaN;
    return a * Math.pow(x, n);
  };
  const [ymin, ymax] = autoRange(fn, domain, 100, 0.5);

  let body = generateAxesTikz(xmin, xmax, ymin, ymax, { show_grid: input.show_grid ?? true });
  const samples = sampleFunction(fn, domain, 150, ymin, ymax);
  body += pointsToTikzSegments(samples, 'thick, blue');

  const eqStr = n === 1 ? `${fmtLabel(a)}x` : n === -1 ? `\\frac{${fmtLabel(a)}}{x}` : `${fmtLabel(a)}x^{${fmtLabel(n)}}`;
  if (input.show_equation !== false) {
    body += `  \\node[above, blue] at (${fmt(xmax * 0.7)},${fmt(Math.min(fn(xmax * 0.7), ymax - 0.5))}) {\\small $y=${eqStr}$};\n`;
  }

  return {
    tikz: wrapTikz(body),
    points: {},
    computed: { exponent: n, coefficient: a },
    construction_steps: [{ step: 1, title: `Funcția putere y = ${eqStr}`, explanation: `f(x) = ${eqStr}`, cumulative_tikz: wrapTikz(body) }],
  };
}

// ─── Radical Function: y = ⁿ√x ───────────────────────────────────────────────

export interface RadicalFunctionInput {
  index?: number;         // ordinul radicalului (2=√, 3=∛), default 2
  coefficient?: number;   // a (default 1)
  domain?: [number, number];
  show_grid?: boolean;
  show_domain_restriction?: boolean;
}

export function generateRadicalFunctionPlot(input: RadicalFunctionInput): GraphOutput {
  const idx = input.index ?? 2;
  const a = input.coefficient ?? 1;
  const isEven = idx % 2 === 0;
  const domain: [number, number] = input.domain ?? (isEven ? [0, 6] : [-4, 4]);
  const [xmin, xmax] = domain;

  const fn = (x: number) => {
    if (isEven && x < 0) return NaN;
    return a * Math.pow(Math.abs(x), 1 / idx) * Math.sign(x);
  };

  const [ymin, ymax] = autoRange(fn, domain, 80, 0.5);
  let body = generateAxesTikz(xmin, xmax, ymin, ymax, { show_grid: input.show_grid ?? true });
  const samples = sampleFunction(fn, domain, 150, ymin, ymax);
  body += pointsToTikzSegments(samples, 'thick, blue');

  if (input.show_domain_restriction && isEven) {
    body += `  \\draw[dashed, gray] (0,${fmt(ymin)}) -- (0,${fmt(ymax)});\n`;
    body += `  \\node[above, gray, font=\\small] at (0,${fmt(ymax)}) {$x\\geq 0$};\n`;
  }

  const idxStr = idx === 2 ? '' : `^${idx}`;
  const eqStr = a === 1 ? `\\sqrt${idxStr}{x}` : `${fmtLabel(a)}\\sqrt${idxStr}{x}`;

  return {
    tikz: wrapTikz(body),
    points: { O: [0, 0] },
    computed: { index: idx, coefficient: a, domain_start: isEven ? 0 : xmin },
    construction_steps: [{ step: 1, title: `Funcția radical y = ${eqStr}`, explanation: isEven ? `Domeniu: [0, +∞)` : `Domeniu: ℝ`, cumulative_tikz: wrapTikz(body) }],
  };
}

// ─── Exponential Function: y = aˣ ────────────────────────────────────────────

export interface ExponentialFunctionInput {
  base: number;         // a (a > 0, a ≠ 1)
  coefficient?: number; // factor multiplicativ (default 1)
  domain?: [number, number];
  show_grid?: boolean;
  show_asymptote?: boolean;
  show_y_intercept?: boolean;
  show_equation?: boolean;
}

export function generateExponentialFunctionPlot(input: ExponentialFunctionInput): GraphOutput {
  const a = input.base;
  const k = input.coefficient ?? 1;
  if (a <= 0 || a === 1) throw new Error('Baza trebuie să fie pozitivă și diferită de 1');
  const domain: [number, number] = input.domain ?? [-4, 4];
  const [xmin, xmax] = domain;
  const fn = (x: number) => k * Math.pow(a, x);

  const [ymin, ymax] = autoRange(fn, domain, 80, 0.5);
  const yRange: [number, number] = [Math.min(ymin, -0.3), Math.max(ymax, 0.5)];

  let body = generateAxesTikz(xmin, xmax, yRange[0], yRange[1], { show_grid: input.show_grid ?? true });
  const samples = sampleFunction(fn, domain, 150, yRange[0], yRange[1]);
  body += pointsToTikzSegments(samples, 'thick, blue');

  // Asymptote y = 0
  if (input.show_asymptote !== false) {
    body += `  \\draw[dashed, gray] (${fmt(xmin)},0) -- (${fmt(xmax)},0) node[right, gray, font=\\small] {$y=0$};\n`;
  }

  // Y intercept (0, k)
  if (input.show_y_intercept !== false) {
    body += `  \\fill[red!70!black] (0,${fmt(k)}) circle (0.07) node[right, font=\\small] {$(0;\\,${fmtLabel(k)})$};\n`;
  }

  const baseStr = a === Math.E ? 'e' : fmtLabel(a);
  const eqStr = k === 1 ? `${baseStr}^x` : `${fmtLabel(k)}\\cdot ${baseStr}^x`;
  if (input.show_equation !== false) {
    body += `  \\node[above, blue, font=\\small] at (${fmt(xmax - 1)},${fmt(Math.min(fn(xmax - 1), yRange[1] - 0.3))}) {$y=${eqStr}$};\n`;
  }

  const type = a > 1 ? 'crescătoare' : 'descrescătoare';
  return {
    tikz: wrapTikz(body),
    points: { Y0: [0, k] },
    computed: { base: a, type, y_intercept: k },
    construction_steps: [{ step: 1, title: `Funcția exponențială (${type})`, explanation: `f(x) = ${eqStr}. Baza a=${fmtLabel(a)}${a > 1 ? ' > 1 → funcție crescătoare' : ' ∈ (0,1) → funcție descrescătoare'}. Asimptotă orizontală y = 0.`, cumulative_tikz: wrapTikz(body) }],
  };
}

// ─── Logarithmic Function: y = log_a(x) ──────────────────────────────────────

export interface LogarithmicFunctionInput {
  base?: number;          // a (default e = natural log)
  coefficient?: number;   // multiplicativ (default 1)
  domain?: [number, number];
  show_grid?: boolean;
  show_asymptote?: boolean;
  show_x_intercept?: boolean;
  show_special_point?: boolean;  // (a, 1)
  show_equation?: boolean;
}

export function generateLogarithmicFunctionPlot(input: LogarithmicFunctionInput): GraphOutput {
  const a = input.base ?? Math.E;
  const k = input.coefficient ?? 1;
  if (a <= 0 || a === 1) throw new Error('Baza trebuie să fie pozitivă și diferită de 1');
  const domain: [number, number] = input.domain ?? [0.05, 6];
  const [xmin, xmax] = domain;
  const lna = Math.log(a);
  const fn = (x: number) => {
    if (x <= 0) return NaN;
    return k * Math.log(x) / lna;
  };

  const [ymin, ymax] = autoRange(fn, [Math.max(0.05, xmin), xmax], 80, 0.5);
  const yRange: [number, number] = [Math.min(ymin, -1), Math.max(ymax, 1)];

  let body = generateAxesTikz(Math.max(0, xmin), xmax, yRange[0], yRange[1], { show_grid: input.show_grid ?? true });
  const samples = sampleFunction(fn, [Math.max(0.01, xmin), xmax], 150, yRange[0], yRange[1]);
  body += pointsToTikzSegments(samples, 'thick, blue');

  // Vertical asymptote x = 0
  if (input.show_asymptote !== false) {
    body += `  \\draw[dashed, gray] (0,${fmt(yRange[0])}) -- (0,${fmt(yRange[1])}) node[above, gray, font=\\small] {$x=0$};\n`;
  }

  // X intercept: log_a(x) = 0 → x = 1
  if (input.show_x_intercept !== false) {
    body += `  \\fill[green!50!black] (1,0) circle (0.07) node[below right, font=\\small] {$(1;0)$};\n`;
  }

  // Special point (a, 1) → log_a(a) = 1
  if (input.show_special_point && a >= xmin && a <= xmax) {
    body += `  \\fill[orange!80!black] (${fmt(a)},${fmt(k)}) circle (0.07) node[above right, font=\\small] {$(${fmtLabel(a)};${fmtLabel(k)})$};\n`;
  }

  const baseStr = a === Math.E ? 'e' : a === 10 ? '10' : fmtLabel(a);
  const logStr = a === Math.E ? '\\ln x' : a === 10 ? '\\log x' : `\\log_{${baseStr}} x`;
  const eqStr = k === 1 ? logStr : `${fmtLabel(k)}${logStr}`;
  if (input.show_equation !== false) {
    const mid = (xmin + xmax) * 0.6;
    body += `  \\node[above, blue, font=\\small] at (${fmt(mid)},${fmt(Math.min(fn(mid), yRange[1] - 0.3))}) {$y=${eqStr}$};\n`;
  }

  const type = (a > 1 && k > 0) || (a < 1 && k < 0) ? 'crescătoare' : 'descrescătoare';
  return {
    tikz: wrapTikz(body),
    points: { X1: [1, 0] },
    computed: { base: a, type, x_intercept: 1 },
    construction_steps: [{ step: 1, title: `Funcția logaritmică (${type})`, explanation: `f(x) = ${eqStr}. Domeniu: (0, +∞). Asimptotă verticală x = 0. f(1) = 0.`, cumulative_tikz: wrapTikz(body) }],
  };
}

// ─── Modulus Function: y = |ax + b| ──────────────────────────────────────────

export interface ModulusFunctionInput {
  a?: number;          // coef x în interiorul modulului (default 1)
  b?: number;          // termen liber în interiorul modulului (default 0)
  // y = |ax + b|
  domain?: [number, number];
  show_grid?: boolean;
  show_breakpoint?: boolean;
  show_piecewise_labels?: boolean;
  show_equation?: boolean;
}

export function generateModulusFunctionPlot(input: ModulusFunctionInput): GraphOutput {
  const a = input.a ?? 1;
  const b = input.b ?? 0;
  const domain: [number, number] = input.domain ?? [-5, 5];
  const [xmin, xmax] = domain;
  const fn = (x: number) => Math.abs(a * x + b);
  const [ymin, ymax] = autoRange(fn, domain, 80, 0.5);
  const yRange: [number, number] = [0, Math.max(ymax, 1)];

  let body = generateAxesTikz(xmin, xmax, yRange[0], yRange[1], { show_grid: input.show_grid ?? true });

  // Vertex (breakpoint): ax + b = 0 → x = -b/a
  const breakX = a !== 0 ? -b / a : 0;
  const breakY = 0;

  // Left part: -(ax+b) for x < breakX, right part: ax+b for x >= breakX
  if (breakX > xmin && breakX < xmax) {
    body += `  \\draw[thick, blue] (${fmt(xmin)},${fmt(fn(xmin))}) -- (${fmt(breakX)},0) -- (${fmt(xmax)},${fmt(fn(xmax))});\n`;
  } else {
    body += `  \\draw[thick, blue] (${fmt(xmin)},${fmt(fn(xmin))}) -- (${fmt(xmax)},${fmt(fn(xmax))});\n`;
  }

  if (input.show_breakpoint !== false && breakX >= xmin && breakX <= xmax) {
    body += `  \\fill[red!70!black] (${fmt(breakX)},0) circle (0.07) node[below] {\\small $(${fmtLabel(breakX)};0)$};\n`;
  }

  if (input.show_piecewise_labels) {
    // Label left branch
    const xleft = (xmin + breakX) / 2;
    body += `  \\node[above, blue, font=\\small] at (${fmt(xleft)},${fmt(fn(xleft))}) {$-(${fmtLabel(a)}x+${fmtLabel(b)})$};\n`;
    // Label right branch
    const xright = (breakX + xmax) / 2;
    body += `  \\node[above, blue, font=\\small] at (${fmt(xright)},${fmt(fn(xright))}) {$${fmtLabel(a)}x+${fmtLabel(b)}$};\n`;
  }

  const eqStr = a === 1 && b === 0 ? '|x|' : b === 0 ? `|${fmtLabel(a)}x|` : `|${fmtLabel(a)}x + ${fmtLabel(b)}|`;
  if (input.show_equation !== false) {
    body += `  \\node[above right, blue, font=\\small] at (${fmt(xmax - 2)},${fmt(yRange[1] - 0.5)}) {$y=${eqStr}$};\n`;
  }

  return {
    tikz: wrapTikz(body),
    points: { V: [breakX, breakY] },
    computed: { breakpoint_x: breakX, a, b },
    construction_steps: [{ step: 1, title: `Funcția modul y = ${eqStr}`, explanation: `Vârful (punctul de înfrângere) la x = ${fmtLabel(breakX)}. Ramura stângă: -(${fmtLabel(a)}x+${fmtLabel(b)}). Ramura dreaptă: ${fmtLabel(a)}x+${fmtLabel(b)}.`, cumulative_tikz: wrapTikz(body) }],
  };
}

// ─── General Function Plot ────────────────────────────────────────────────────

export interface FunctionPlotInput {
  expression: string;
  domain: [number, number];
  range?: [number, number];
  show_grid?: boolean;
  show_x_intercepts?: boolean;
  show_y_intercept?: boolean;
  show_vertex?: boolean;
  marked_points?: Array<{ x: number; label?: string; show_coordinates?: boolean; color?: string }>;
  asymptotes?: Array<{ type: 'vertical' | 'horizontal' | 'oblique'; value?: number; slope?: number; intercept?: number }>;
  label?: string;
}

export function generateFunctionPlot(input: FunctionPlotInput): GraphOutput {
  const { evaluateExpression } = require('./_helpers') as typeof import('./_helpers');
  const fn = (x: number) => evaluateExpression(input.expression, x);

  const domain = input.domain;
  const [xmin, xmax] = domain;
  const [ymin, ymax] = input.range ?? autoRange(fn, domain, 100, 0.8);
  const yRange: [number, number] = [Math.min(ymin, -0.5), Math.max(ymax, 0.5)];

  const { sampleFunctionSmart } = require('./_helpers') as typeof import('./_helpers');
  let body = generateAxesTikz(xmin, xmax, yRange[0], yRange[1], { show_grid: input.show_grid ?? true });
  const samples = sampleFunctionSmart(fn, domain, 200, yRange[0], yRange[1]);
  body += pointsToTikzSegments(samples, 'thick, blue');

  // Asymptotes
  for (const asm of input.asymptotes ?? []) {
    if (asm.type === 'vertical' && asm.value !== undefined) {
      body += `  \\draw[dashed, orange!80!black] (${fmt(asm.value)},${fmt(yRange[0])}) -- (${fmt(asm.value)},${fmt(yRange[1])}) node[above, font=\\small] {$x=${fmtLabel(asm.value)}$};\n`;
    } else if (asm.type === 'horizontal' && asm.value !== undefined) {
      body += `  \\draw[dashed, orange!80!black] (${fmt(xmin)},${fmt(asm.value)}) -- (${fmt(xmax)},${fmt(asm.value)}) node[right, font=\\small] {$y=${fmtLabel(asm.value)}$};\n`;
    } else if (asm.type === 'oblique' && asm.slope !== undefined && asm.intercept !== undefined) {
      const y1 = asm.slope * xmin + asm.intercept;
      const y2 = asm.slope * xmax + asm.intercept;
      body += `  \\draw[dashed, orange!80!black] (${fmt(xmin)},${fmt(y1)}) -- (${fmt(xmax)},${fmt(y2)}) node[right, font=\\small] {$y=${fmtLabel(asm.slope)}x+${fmtLabel(asm.intercept)}$};\n`;
    }
  }

  // Marked points
  for (const mp of input.marked_points ?? []) {
    const y = fn(mp.x);
    if (!isFinite(y)) continue;
    const lbl = mp.label ?? `(${fmtLabel(mp.x)};${fmtLabel(y)})`;
    body += markedPointTikz(mp.x, y, lbl, { color: mp.color, show_coords: mp.show_coordinates });
  }

  if (input.label) {
    body += `  \\node[above right, blue, font=\\small] at (${fmt(xmax - 1)},${fmt(yRange[1] - 0.5)}) {$${input.label}$};\n`;
  }

  return {
    tikz: wrapTikz(body),
    points: {},
    computed: { expression: input.expression },
    construction_steps: [{ step: 1, title: `Graficul funcției f(x) = ${input.expression}`, explanation: `Graficul funcției pe intervalul [${fmtLabel(xmin)}, ${fmtLabel(xmax)}].`, cumulative_tikz: wrapTikz(body) }],
  };
}
