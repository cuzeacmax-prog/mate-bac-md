import type { Point } from './types';

function fmt(n: number, d = 3) {
  return n.toFixed(d);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CylinderInput {
  radius: number;
  height: number;

  show_axis?: boolean;
  show_radius?: boolean;
  show_diagonal?: boolean;
  label_top_center?: string;
  label_bottom_center?: string;
}

export interface ConeInput {
  base_radius: number;
  height: number;

  show_axis?: boolean;
  show_slant_height?: boolean;
  show_radius?: boolean;
  label_apex?: string;
  label_base_center?: string;
}

export interface SphereInput {
  radius: number;

  show_equator?: boolean;
  show_meridian?: boolean;
  show_radius?: boolean;
  label_center?: string;

  // Nou: cerc mare + cerc mic
  show_great_circle?: boolean;                                  // cerc mare (în plan XZ)
  show_small_circle?: { distance_from_center: number };        // cerc mic la distanță dată
}

export interface RotationalOutput {
  tikz: string;
  points: Record<string, Point>;
  computed: {
    volume: number;
    lateral_area?: number;
    total_area?: number;
    slant_height?: number;
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;
  }>;
}

// Ellipse perspective factor (how "flat" the top/bottom look)
const EY = 0.3;

// ─── Cylinder ────────────────────────────────────────────────────────────────

export function generateCylinderAdvanced(input: CylinderInput): RotationalOutput {
  const r = input.radius;
  const h = input.height;
  const cx = 0;
  const cy = 0;

  const points: Record<string, Point> = {
    O1: [cx, cy],
    O2: [cx, cy + h],
  };
  if (input.label_bottom_center) points[input.label_bottom_center] = [cx, cy];
  if (input.label_top_center) points[input.label_top_center] = [cx, cy + h];

  const volume = Math.PI * r * r * h;
  const lateralArea = 2 * Math.PI * r * h;
  const totalArea = lateralArea + 2 * Math.PI * r * r;

  const steps: RotationalOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Bottom ellipse (full)
  cum += `  \\draw[thick] (${fmt(cx)},${fmt(cy)}) ellipse (${fmt(r)} and ${fmt(r * EY)});\n`;
  // Top ellipse (full)
  cum += `  \\draw[thick] (${fmt(cx)},${fmt(cy + h)}) ellipse (${fmt(r)} and ${fmt(r * EY)});\n`;
  // Two lateral lines
  cum += `  \\draw[thick] (${fmt(cx - r)},${fmt(cy)}) -- (${fmt(cx - r)},${fmt(cy + h)});\n`;
  cum += `  \\draw[thick] (${fmt(cx + r)},${fmt(cy)}) -- (${fmt(cx + r)},${fmt(cy + h)});\n`;

  // Labels
  if (input.label_bottom_center) {
    cum += `  \\fill (${fmt(cx)},${fmt(cy)}) circle (0.04) node[below] {$${input.label_bottom_center}$};\n`;
  }
  if (input.label_top_center) {
    cum += `  \\fill (${fmt(cx)},${fmt(cy + h)}) circle (0.04) node[above] {$${input.label_top_center}$};\n`;
  }

  steps.push({
    step: 1,
    title: `Cilindrul r=${r}, h=${h}`,
    explanation: `Cilindru circular drept cu raza r = ${r} și înălțimea h = ${h}. V = ${volume.toFixed(2)}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  if (input.show_axis) {
    cum += `  \\draw[dashed, gray] (${fmt(cx)},${fmt(cy)}) -- (${fmt(cx)},${fmt(cy + h)});\n`;
    steps.push({
      step: 2,
      title: 'Axa cilindrului',
      explanation: `Axa de rotație (OO') de lungime h = ${h}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  if (input.show_radius) {
    cum += `  \\draw[blue] (${fmt(cx)},${fmt(cy)}) -- (${fmt(cx + r)},${fmt(cy)}) node[midway, below] {$r=${fmt(r, 2)}$};\n`;
  }

  if (input.show_diagonal) {
    const diag = Math.sqrt((2 * r) ** 2 + h ** 2);
    cum += `  \\draw[orange] (${fmt(cx - r)},${fmt(cy)}) -- (${fmt(cx + r)},${fmt(cy + h)}) node[midway, right] {$d=${fmt(diag, 2)}$};\n`;
  }

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { volume, lateral_area: lateralArea, total_area: totalArea },
    construction_steps: steps,
  };
}

// ─── Cone ────────────────────────────────────────────────────────────────────

export function generateConeAdvanced(input: ConeInput): RotationalOutput {
  const r = input.base_radius;
  const h = input.height;
  const cx = 0;
  const cy = 0;
  const apexLabel = input.label_apex ?? 'V';
  const baseLabel = input.label_base_center ?? 'O';

  const slant = Math.sqrt(r * r + h * h);
  const volume = (Math.PI * r * r * h) / 3;
  const lateralArea = Math.PI * r * slant;
  const totalArea = lateralArea + Math.PI * r * r;

  const points: Record<string, Point> = {
    [apexLabel]: [cx, cy + h],
    [baseLabel]: [cx, cy],
  };

  const steps: RotationalOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Base ellipse
  cum += `  \\draw[thick] (${fmt(cx)},${fmt(cy)}) ellipse (${fmt(r)} and ${fmt(r * EY)});\n`;

  // Lateral sides (two lines from apex to rim)
  cum += `  \\draw[thick] (${fmt(cx - r)},${fmt(cy)}) -- (${fmt(cx)},${fmt(cy + h)});\n`;
  cum += `  \\draw[thick] (${fmt(cx + r)},${fmt(cy)}) -- (${fmt(cx)},${fmt(cy + h)});\n`;

  // Apex
  cum += `  \\fill (${fmt(cx)},${fmt(cy + h)}) circle (0.04) node[above] {$${apexLabel}$};\n`;
  cum += `  \\fill (${fmt(cx)},${fmt(cy)}) circle (0.04) node[below] {$${baseLabel}$};\n`;

  steps.push({
    step: 1,
    title: `Conul r=${r}, h=${h}`,
    explanation: `Con circular drept cu raza r = ${r} și înălțimea h = ${h}. V = ${volume.toFixed(2)}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  if (input.show_axis) {
    cum += `  \\draw[dashed, gray] (${fmt(cx)},${fmt(cy)}) -- (${fmt(cx)},${fmt(cy + h)});\n`;
    steps.push({
      step: 2,
      title: 'Axa',
      explanation: `Înălțimea (axa) h = ${h}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  if (input.show_radius) {
    cum += `  \\draw[blue] (${fmt(cx)},${fmt(cy)}) -- (${fmt(cx + r)},${fmt(cy)}) node[midway, below] {$r=${fmt(r, 2)}$};\n`;
  }

  if (input.show_slant_height) {
    cum += `  \\draw[orange, thick] (${fmt(cx)},${fmt(cy + h)}) -- (${fmt(cx + r)},${fmt(cy)}) node[midway, right] {$l=${fmt(slant, 2)}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Generatoarea',
      explanation: `Generatoarea (apotema) l = √(r²+h²) = ${slant.toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { volume, lateral_area: lateralArea, total_area: totalArea, slant_height: slant },
    construction_steps: steps,
  };
}

// ─── Sphere ──────────────────────────────────────────────────────────────────

export function generateSphereAdvanced(input: SphereInput): RotationalOutput {
  const r = input.radius;
  const lbl = input.label_center ?? 'O';

  const volume = (4 / 3) * Math.PI * r ** 3;
  const totalArea = 4 * Math.PI * r ** 2;

  const points: Record<string, Point> = { [lbl]: [0, 0] };

  const steps: RotationalOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Main circle
  cum += `  \\draw[thick] (0,0) circle (${fmt(r)});\n`;

  // Center
  cum += `  \\fill (0,0) circle (0.04) node[below left] {$${lbl}$};\n`;

  steps.push({
    step: 1,
    title: `Sfera r=${r}`,
    explanation: `Sferă cu raza r = ${r}. V = ${volume.toFixed(2)}, S = ${totalArea.toFixed(2)}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  if (input.show_equator) {
    cum += `  \\draw[dashed, gray] (0,0) ellipse (${fmt(r)} and ${fmt(r * 0.3)});\n`;
    steps.push({
      step: 2,
      title: 'Ecuatorul',
      explanation: 'Ecuatorul sferei (plan ecuatorial).',
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  if (input.show_meridian) {
    cum += `  \\draw[dashed, gray] (0,0) ellipse (${fmt(r * 0.3)} and ${fmt(r)});\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Meridianul',
      explanation: 'Meridianul sferei (cerc mare vertical).',
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  if (input.show_radius) {
    cum += `  \\draw[blue] (0,0) -- (${fmt(r)},0) node[midway, above] {$r=${fmt(r, 2)}$};\n`;
  }

  // Cerc mare (plan vertical XZ — apare ca cerc în 2D)
  if (input.show_great_circle) {
    cum += `  \\draw[blue, thick] (0,0) circle (${fmt(r)});\n`; // coincide cu sfera
    cum += `  \\node[blue, right] at (${fmt(r * 0.7)},${fmt(r * 0.7)}) {cerc mare};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Cercul mare',
      explanation: `Cercul mare are același plan cu sfera. Raza = R = ${r}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Cerc mic la o distanță față de centru
  if (input.show_small_circle) {
    const d = Math.min(Math.abs(input.show_small_circle.distance_from_center), r * 0.99);
    const sr = Math.sqrt(Math.max(0, r * r - d * d));
    cum += `  \\draw[red, thick] (0,${fmt(d)}) ellipse (${fmt(sr)} and ${fmt(sr * 0.3)});\n`;
    cum += `  \\fill[red] (0,${fmt(d)}) circle (0.04) node[right, red] {$O'$};\n`;
    cum += `  \\draw[red, dashed] (0,0) -- (0,${fmt(d)}) node[midway, right, red] {$d=${fmt(d, 2)}$};\n`;
    cum += `  \\draw[red, dashed] (0,${fmt(d)}) -- (${fmt(sr)},${fmt(d)}) node[midway, above, red] {$r'=${fmt(sr, 2)}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Cercul mic',
      explanation: `Cercul mic la distanța d=${d.toFixed(2)} față de centru are raza r'=${sr.toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { volume, total_area: totalArea },
    construction_steps: steps,
  };
}
