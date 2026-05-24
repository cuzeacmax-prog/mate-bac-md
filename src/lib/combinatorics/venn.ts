/**
 * venn.ts — Venn diagram calculator for 2 or 3 sets.
 * Uses TikZ \clip for proper intersection shading.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface VennSet {
  label: string;
  count?: number;        // |A|
  color?: string;
}

export interface VennInput2 {
  sets: [VennSet, VennSet];
  intersection?: number;  // |A∩B|
  union?: number;         // |A∪B|
  universe?: number;      // |U|
  universe_label?: string;
  show_counts?: boolean;
  title?: string;
}

export interface VennInput3 {
  sets: [VennSet, VennSet, VennSet];
  intersections?: {
    ab?: number;   // |A∩B| \ C
    ac?: number;   // |A∩C| \ B
    bc?: number;   // |B∩C| \ A
    abc?: number;  // |A∩B∩C|
  };
  universe?: number;
  universe_label?: string;
  show_counts?: boolean;
  title?: string;
}

// ─── 2-Set Venn ──────────────────────────────────────────────────────────────

export function generateVenn2(input: VennInput2): GraphOutput {
  const [setA, setB] = input.sets;
  const colorA = setA.color ?? 'blue!30';
  const colorB = setB.color ?? 'red!30';

  // Circle centers and radius
  const r = 1.5;
  const cx = 1.0; // overlap factor
  const xA = -cx;
  const xB = cx;

  // Counts
  const inter = input.intersection ?? 0;
  const onlyA = (setA.count ?? 0) - inter;
  const onlyB = (setB.count ?? 0) - inter;
  const unionCount = (setA.count ?? 0) + (setB.count ?? 0) - inter;
  const outsideU = (input.universe ?? 0) - unionCount;

  let tikz = `\\begin{tikzpicture}[scale=1.0]\n`;

  // Universe rectangle
  tikz += `  \\draw[thick] (-4.2,-2.4) rectangle (4.2,2.8);\n`;
  tikz += `  \\node[above left] at (4.2,2.8) {$${input.universe_label ?? 'U'}$};\n`;

  // Fill A only
  tikz += `  \\begin{scope}\n    \\clip (${fmt(xA)},0) circle (${fmt(r)});\n    \\fill[${colorA}, opacity=0.5] (${fmt(xA)},0) circle (${fmt(r)});\n  \\end{scope}\n`;

  // Fill B only
  tikz += `  \\begin{scope}\n    \\clip (${fmt(xB)},0) circle (${fmt(r)});\n    \\fill[${colorB}, opacity=0.5] (${fmt(xB)},0) circle (${fmt(r)});\n  \\end{scope}\n`;

  // Intersection (A∩B) slightly darker
  tikz += `  \\begin{scope}\n    \\clip (${fmt(xA)},0) circle (${fmt(r)});\n    \\clip (${fmt(xB)},0) circle (${fmt(r)});\n    \\fill[violet!30, opacity=0.5] (-4,0) rectangle (4,4);\n  \\end{scope}\n`;

  // Outlines
  tikz += `  \\draw[thick, blue!70] (${fmt(xA)},0) circle (${fmt(r)});\n`;
  tikz += `  \\draw[thick, red!70] (${fmt(xB)},0) circle (${fmt(r)});\n`;

  // Labels
  tikz += `  \\node[above] at (${fmt(xA)},${fmt(r)}) {$${setA.label}$};\n`;
  tikz += `  \\node[above] at (${fmt(xB)},${fmt(r)}) {$${setB.label}$};\n`;

  // Counts
  if (input.show_counts !== false) {
    if (onlyA !== 0) tikz += `  \\node at (${fmt(xA - 0.8)},0) {$${onlyA}$};\n`;
    if (inter !== 0) tikz += `  \\node at (0,0) {$${inter}$};\n`;
    if (onlyB !== 0) tikz += `  \\node at (${fmt(xB + 0.8)},0) {$${onlyB}$};\n`;
    if (outsideU > 0) tikz += `  \\node at (3.4,-2.0) {$${outsideU}$};\n`;
  }

  if (input.title) {
    tikz += `  \\node[above, font=\\bfseries] at (0,2.5) {${input.title}};\n`;
  }

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      set_A: setA.count ?? 0,
      set_B: setB.count ?? 0,
      intersection: inter,
      union: unionCount,
      only_A: onlyA,
      only_B: onlyB,
      outside: outsideU > 0 ? outsideU : 0,
    },
  };
}

// ─── 3-Set Venn ──────────────────────────────────────────────────────────────

export function generateVenn3(input: VennInput3): GraphOutput {
  const [setA, setB, setC] = input.sets;
  const colorA = setA.color ?? 'blue!25';
  const colorB = setB.color ?? 'red!25';
  const colorC = setC.color ?? 'green!30';

  const r = 1.7;
  // Triangle arrangement
  const xA = -1.0, yA = 0.55;
  const xB =  1.0, yB = 0.55;
  const xC =  0.0, yC = -1.0;

  const inter = input.intersections ?? {};
  const abc = inter.abc ?? 0;
  const ab = (inter.ab ?? 0) - abc;
  const ac = (inter.ac ?? 0) - abc;
  const bc = (inter.bc ?? 0) - abc;
  const onlyA = (setA.count ?? 0) - ab - ac - abc;
  const onlyB = (setB.count ?? 0) - ab - bc - abc;
  const onlyC = (setC.count ?? 0) - ac - bc - abc;
  const unionCount = (setA.count ?? 0) + (setB.count ?? 0) + (setC.count ?? 0) - (inter.ab ?? 0) - (inter.ac ?? 0) - (inter.bc ?? 0) + abc;
  const outsideU = (input.universe ?? 0) - unionCount;

  let tikz = `\\begin{tikzpicture}[scale=1.0]\n`;
  tikz += `  \\draw[thick] (-4.0,-3.2) rectangle (4.0,3.0);\n`;
  tikz += `  \\node[above left] at (4.0,3.0) {$${input.universe_label ?? 'U'}$};\n`;

  const circA = `(${fmt(xA)},${fmt(yA)}) circle (${fmt(r)})`;
  const circB = `(${fmt(xB)},${fmt(yB)}) circle (${fmt(r)})`;
  const circC = `(${fmt(xC)},${fmt(yC)}) circle (${fmt(r)})`;

  // Fill each set
  tikz += `  \\fill[${colorA}, opacity=0.4] ${circA};\n`;
  tikz += `  \\fill[${colorB}, opacity=0.4] ${circB};\n`;
  tikz += `  \\fill[${colorC}, opacity=0.4] ${circC};\n`;

  // Intersection shading uses clip
  // A∩B
  tikz += `  \\begin{scope}\n    \\clip ${circA};\n    \\clip ${circB};\n    \\fill[violet!20, opacity=0.4] (-5,-5) rectangle (5,5);\n  \\end{scope}\n`;
  // A∩C
  tikz += `  \\begin{scope}\n    \\clip ${circA};\n    \\clip ${circC};\n    \\fill[cyan!20, opacity=0.4] (-5,-5) rectangle (5,5);\n  \\end{scope}\n`;
  // B∩C
  tikz += `  \\begin{scope}\n    \\clip ${circB};\n    \\clip ${circC};\n    \\fill[orange!20, opacity=0.4] (-5,-5) rectangle (5,5);\n  \\end{scope}\n`;
  // A∩B∩C
  tikz += `  \\begin{scope}\n    \\clip ${circA};\n    \\clip ${circB};\n    \\clip ${circC};\n    \\fill[gray!30, opacity=0.6] (-5,-5) rectangle (5,5);\n  \\end{scope}\n`;

  // Outlines
  tikz += `  \\draw[thick, blue!70] ${circA};\n`;
  tikz += `  \\draw[thick, red!70] ${circB};\n`;
  tikz += `  \\draw[thick, green!60!black] ${circC};\n`;

  // Labels
  tikz += `  \\node[above left] at (${fmt(xA - 0.7)},${fmt(yA + r)}) {$${setA.label}$};\n`;
  tikz += `  \\node[above right] at (${fmt(xB + 0.7)},${fmt(yB + r)}) {$${setB.label}$};\n`;
  tikz += `  \\node[below] at (${fmt(xC)},${fmt(yC - r)}) {$${setC.label}$};\n`;

  // Counts
  if (input.show_counts !== false) {
    if (onlyA !== 0) tikz += `  \\node at (${fmt(xA - 1.0)},${fmt(yA + 0.3)}) {$${onlyA}$};\n`;
    if (onlyB !== 0) tikz += `  \\node at (${fmt(xB + 1.0)},${fmt(yB + 0.3)}) {$${onlyB}$};\n`;
    if (onlyC !== 0) tikz += `  \\node at (${fmt(xC)},${fmt(yC - 0.6)}) {$${onlyC}$};\n`;
    if (ab !== 0) tikz += `  \\node at (0,${fmt(yA + 0.4)}) {$${ab}$};\n`;
    if (ac !== 0) tikz += `  \\node at (${fmt((xA + xC) / 2 - 0.1)},${fmt((yA + yC) / 2 - 0.1)}) {$${ac}$};\n`;
    if (bc !== 0) tikz += `  \\node at (${fmt((xB + xC) / 2 + 0.1)},${fmt((yB + yC) / 2 - 0.1)}) {$${bc}$};\n`;
    if (abc !== 0) tikz += `  \\node at (0,${fmt((yA + yC) / 2)}) {$${abc}$};\n`;
    if (outsideU > 0) tikz += `  \\node at (3.2,-2.8) {$${outsideU}$};\n`;
  }

  if (input.title) {
    tikz += `  \\node[above, font=\\bfseries] at (0,2.7) {${input.title}};\n`;
  }

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      only_A: onlyA, only_B: onlyB, only_C: onlyC,
      A_and_B_only: ab, A_and_C_only: ac, B_and_C_only: bc,
      A_and_B_and_C: abc,
      union: unionCount,
      outside: outsideU > 0 ? outsideU : 0,
    },
  };
}

// ─── Generic entry point ──────────────────────────────────────────────────────

export function generateVennDiagram(input: VennInput2 | VennInput3): GraphOutput {
  if (input.sets.length === 2) return generateVenn2(input as VennInput2);
  return generateVenn3(input as VennInput3);
}
