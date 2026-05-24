/**
 * complexPlane.ts — Complex number plane visualization.
 * Re/Im axes, modulus, argument, conjugate, arithmetic operations.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface ComplexNumber {
  re: number;
  im: number;
  label?: string;
  color?: string;
}

export interface ComplexPlaneInput {
  numbers: ComplexNumber[];
  show_modulus?: boolean;     // |z| arc + value
  show_argument?: boolean;    // arg arc + value
  show_conjugate?: boolean;   // z* for each number
  show_sum?: boolean;         // z1 + z2 parallelogram
  show_product?: boolean;     // z1 * z2
  range?: number;             // ±range for both axes, default auto
  show_grid?: boolean;
  title?: string;
}

function polarLabel(modulus: number, argRad: number): string {
  const argDeg = (argRad * 180 / Math.PI);
  return `|z|=${fmtLabel(modulus)},\\,\\arg=${fmtLabel(argDeg)}°`;
}

export function generateComplexPlane(input: ComplexPlaneInput): GraphOutput {
  const { numbers } = input;

  // Compute auto-range
  const allValues = numbers.flatMap(z => [Math.abs(z.re), Math.abs(z.im)]);
  const autoMax = Math.max(2, ...allValues) * 1.3;
  const range = input.range ?? Math.ceil(autoMax);

  const defaultColors = ['blue!70', 'red!70', 'green!60!black', 'orange!80!black', 'violet'];

  let tikz = `\\begin{tikzpicture}[scale=0.8]\n`;

  // Grid
  if (input.show_grid) {
    tikz += `  \\draw[gray!20, very thin] (${fmt(-range)},${fmt(-range)}) grid (${fmt(range)},${fmt(range)});\n`;
  }

  // Axes
  tikz += `  \\draw[->, thick] (${fmt(-range - 0.3)},0) -- (${fmt(range + 0.5)},0) node[right] {$\\text{Re}$};\n`;
  tikz += `  \\draw[->, thick] (0,${fmt(-range - 0.3)}) -- (0,${fmt(range + 0.5)}) node[above] {$\\text{Im}$};\n`;
  tikz += `  \\node[below left, small] at (0,0) {$O$};\n`;

  // Integer ticks
  for (let v = -range; v <= range; v++) {
    if (v === 0) continue;
    tikz += `  \\draw (${fmt(v)},0.05) -- (${fmt(v)},-0.05) node[below] {\\tiny $${v}$};\n`;
    tikz += `  \\draw (0.05,${fmt(v)}) -- (-0.05,${fmt(v)}) node[left] {\\tiny $${v}$};\n`;
  }

  // Draw each complex number
  const computedInfo: Record<string, string> = {};

  for (let i = 0; i < numbers.length; i++) {
    const z = numbers[i];
    const color = z.color ?? defaultColors[i % defaultColors.length];
    const lbl = z.label ?? `z_{${i + 1}}`;

    // Vector from origin
    tikz += `  \\draw[->, ${color}, thick] (0,0) -- (${fmt(z.re)},${fmt(z.im)});\n`;

    // Point
    tikz += `  \\filldraw[${color}] (${fmt(z.re)},${fmt(z.im)}) circle (0.08);\n`;

    // Label
    const anchor = z.im >= 0 ? 'above right' : 'below right';
    tikz += `  \\node[${anchor}, ${color}, font=\\small] at (${fmt(z.re)},${fmt(z.im)}) {$${lbl}=(${fmtLabel(z.re)},${fmtLabel(z.im)})$};\n`;

    // Dashed projection lines
    tikz += `  \\draw[${color}, dashed, very thin] (${fmt(z.re)},0) -- (${fmt(z.re)},${fmt(z.im)});\n`;
    tikz += `  \\draw[${color}, dashed, very thin] (0,${fmt(z.im)}) -- (${fmt(z.re)},${fmt(z.im)});\n`;

    // Modulus
    const mod = Math.sqrt(z.re * z.re + z.im * z.im);
    const arg = Math.atan2(z.im, z.re);

    if (input.show_modulus) {
      // Arc from x-axis to z (if mod > 0.1)
      if (mod > 0.1) {
        tikz += `  \\node[${color}, font=\\tiny] at (${fmt(z.re * 0.5 + 0.2)},${fmt(z.im * 0.3)}) {$|${lbl}|=${fmtLabel(mod)}$};\n`;
      }
    }

    if (input.show_argument && mod > 0.1) {
      const argDeg = parseFloat(((arg * 180) / Math.PI).toFixed(1));
      const arcR = 0.5 * Math.min(1, mod * 0.4);
      // Draw arc from 0 to arg at radius arcR
      tikz += `  \\draw[${color}, thin] (${fmt(arcR)},0) arc (0:${fmt(arg * 180 / Math.PI)}:${fmt(arcR)});\n`;
      const midArgX = arcR * 1.3 * Math.cos(arg / 2);
      const midArgY = arcR * 1.3 * Math.sin(arg / 2);
      tikz += `  \\node[${color}, font=\\tiny] at (${fmt(midArgX)},${fmt(midArgY)}) {$${fmtLabel(argDeg)}°$};\n`;
    }

    // Conjugate
    if (input.show_conjugate) {
      tikz += `  \\filldraw[${color}, opacity=0.5] (${fmt(z.re)},${fmt(-z.im)}) circle (0.07);\n`;
      tikz += `  \\node[below right, ${color}, opacity=0.7, font=\\tiny] at (${fmt(z.re)},${fmt(-z.im)}) {$\\bar{${lbl}}$};\n`;
      tikz += `  \\draw[${color}, dashed, thin, opacity=0.5] (${fmt(z.re)},${fmt(z.im)}) -- (${fmt(z.re)},${fmt(-z.im)});\n`;
    }

    computedInfo[lbl] = polarLabel(mod, arg);
  }

  // Sum of first two numbers
  if (input.show_sum && numbers.length >= 2) {
    const z1 = numbers[0], z2 = numbers[1];
    const sum = { re: z1.re + z2.re, im: z1.im + z2.im };
    tikz += `  \\draw[gray, dashed, thin] (${fmt(z1.re)},${fmt(z1.im)}) -- (${fmt(sum.re)},${fmt(sum.im)});\n`;
    tikz += `  \\draw[gray, dashed, thin] (${fmt(z2.re)},${fmt(z2.im)}) -- (${fmt(sum.re)},${fmt(sum.im)});\n`;
    tikz += `  \\draw[->, black!70, thick] (0,0) -- (${fmt(sum.re)},${fmt(sum.im)});\n`;
    tikz += `  \\filldraw[black!70] (${fmt(sum.re)},${fmt(sum.im)}) circle (0.08) node[above right, font=\\small] {$z_1+z_2$};\n`;
  }

  // Product of first two numbers
  if (input.show_product && numbers.length >= 2) {
    const z1 = numbers[0], z2 = numbers[1];
    const pr = { re: z1.re * z2.re - z1.im * z2.im, im: z1.re * z2.im + z1.im * z2.re };
    tikz += `  \\draw[->, purple, thick] (0,0) -- (${fmt(pr.re)},${fmt(pr.im)});\n`;
    tikz += `  \\filldraw[purple] (${fmt(pr.re)},${fmt(pr.im)}) circle (0.08) node[above right, font=\\small] {$z_1\\cdot z_2$};\n`;
  }

  if (input.title) {
    tikz += `  \\node[above, font=\\bfseries] at (0,${fmt(range + 0.3)}) {${input.title}};\n`;
  }

  tikz += `\\end{tikzpicture}`;

  const firstZ = numbers[0];
  const mod0 = firstZ ? Math.sqrt(firstZ.re ** 2 + firstZ.im ** 2) : 0;
  const arg0 = firstZ ? Math.atan2(firstZ.im, firstZ.re) : 0;

  return {
    tikz,
    computed: {
      numbers: numbers.map(z => ({
        re: z.re, im: z.im,
        modulus: parseFloat(Math.sqrt(z.re ** 2 + z.im ** 2).toFixed(6)),
        argument_deg: parseFloat(((Math.atan2(z.im, z.re) * 180) / Math.PI).toFixed(3)),
      })),
      ...(numbers[0] ? { first_modulus: parseFloat(mod0.toFixed(6)), first_argument_deg: parseFloat(((arg0 * 180) / Math.PI).toFixed(3)) } : {}),
    },
  };
}
