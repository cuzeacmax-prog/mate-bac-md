/**
 * mastery-color.ts — ETAPA 83 FAZA C: culoarea nodului CODIFICĂ progresia.
 *
 * Determinist (zero random): mastery [0,1] → gradient ALBASTRU de la profund
 * (#001D51, neînceput) prin royal spre ELECTRIC luminos (#3B82F6, stăpânit).
 * Aceeași logică oriunde apar selectoare de temă. Culoarea = starea, nu decor.
 */

export type NodeStatusLite = 'blocat' | 'disponibil' | 'in-lucru' | 'stapanit';

type RGB = [number, number, number];

// rampa de progresie (sRGB): profund → royal → electric
const STOPS: Array<[number, RGB]> = [
  [0.0, [0, 29, 81]],     // #001D51 albastru profund (neînceput)
  [0.5, [30, 64, 175]],   // #1E40AF royal (în lucru)
  [1.0, [59, 130, 246]],  // #3B82F6 electric (stăpânit)
];

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const toHex = ([r, g, b]: RGB) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

function rampColor(t: number): RGB {
  const x = clamp01(t);
  for (let i = 1; i < STOPS.length; i++) {
    const [t0, c0] = STOPS[i - 1];
    const [t1, c1] = STOPS[i];
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/** luminanță relativă WCAG dintr-un hex (pentru teste + decizii de contrast) */
export function relLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

export interface MasteryColor {
  fill: string;
  /** intensitatea glow-ului 0..1 (crește cu mastery; stăpânit = maxim) */
  glow: number;
}

/**
 * Culoarea + glow-ul unui nod după mastery și stare.
 *  - blocat: stins (rampă jos × întunecare), citit ca „încuiat";
 *  - altele: pe rampa de progresie după mastery; stăpânit primește glow maxim.
 */
export function masteryColor(mastery: number, status: NodeStatusLite): MasteryColor {
  const m = clamp01(mastery);
  if (status === 'blocat') {
    const dim = rampColor(0).map((c) => c * 0.55) as RGB; // mai stins decât disponibil
    return { fill: toHex(dim), glow: 0 };
  }
  const fill = toHex(rampColor(m));
  const glow = status === 'stapanit' ? 1 : status === 'in-lucru' ? 0.35 + m * 0.4 : 0.25;
  return { fill, glow };
}
