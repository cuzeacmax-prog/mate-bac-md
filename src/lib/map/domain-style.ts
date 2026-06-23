/**
 * domain-style.ts — ETAPA 84 FAZA D: butoanele de domeniu pe gama ALBASTRU-NIGHT,
 * luminozitatea codificând PROGRESUL real la domeniu (determinist din mastery):
 * neatins = albastru profund stins → în lucru = night → stăpânit = electric.
 * Distincția între domenii = o TENTĂ subtilă (hue în banda albastră 210-280), nu
 * culori complet diferite. Nu mai există curcubeu.
 *
 * AA SACRU: luminozitatea bg e PLAFONATĂ (≤ ~0.45 oklch L) ca textul deschis să
 * rămână ≥ 4.5:1; senzația „electric luminos" la stăpânit vine din GLOW (ring), nu
 * dintr-un fill prea deschis care ar strica contrastul.
 */

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** hue determinist într-o bandă albastră (azur→indigo→violet ușor), per cheie de grup. */
export function groupHue(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 210 + (Math.abs(h) % 71); // 210..280
}

/** progres 0..1 → culoarea butonului (oklch) + intensitatea glow-ului. */
export function domainButton(key: string, progress: number): { bg: string; glow: number } {
  const t = clamp01(progress);
  const L = 0.18 + t * 0.27; // 0.18 (profund) → 0.45 (royal, plafon AA)
  const C = 0.06 + t * 0.11;
  const H = groupHue(key);
  return { bg: `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H})`, glow: t };
}

/** extrage L dintr-un string oklch(L C H) — pentru teste/contrast. */
export function oklchL(oklch: string): number {
  const m = oklch.match(/oklch\(\s*([\d.]+)/);
  return m ? Number(m[1]) : NaN;
}
