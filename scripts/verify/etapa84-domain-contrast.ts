/**
 * etapa84-domain-contrast.ts — POARTĂ D: contrast AA pe butoanele de domeniu.
 * Gradientul (domain-style.domainButton) e plafonat ca textul deschis să fie ≥4.5:1
 * pe ORICE progres (0..1) și orice tentă din banda albastră (210..280). Determinist.
 *   npx tsx scripts/verify/etapa84-domain-contrast.ts
 */
import { domainButton, oklchL } from '../../src/lib/map/domain-style';

function oklchToSrgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gam = (c: number) => { const cl = Math.min(1, Math.max(0, c)); return cl <= 0.0031308 ? 12.92 * cl : 1.055 * cl ** (1 / 2.4) - 0.055; };
  return [gam(r), gam(g), gam(bb)];
}
function lum([r, g, b]: [number, number, number]): number {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function parseOklch(s: string): [number, number, number] {
  const m = s.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!m) throw new Error(`oklch invalid: ${s}`);
  return oklchToSrgb(Number(m[1]), Number(m[2]), Number(m[3]));
}
// text deschis: --text-on-deep ≈ oklch(0.97 0.005 260)
const TEXT = oklchToSrgb(0.97, 0.005, 260);
function contrast(bg: [number, number, number]): number {
  const la = lum(TEXT), lb = lum(bg); const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

let worst = Infinity, worstAt = '';
// eșantion: chei cu hue-uri variate × progres complet
const keys = ['g9:a', 'g10:functii', 'g11:functia-radical', 'g12:integrale', 'g11:zzz-tint', 'g10:geometrie-plana'];
for (const key of keys) {
  for (const p of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    const bg = domainButton(key, p).bg;
    if (oklchL(bg) > 0.46) { console.error(`✗ bg prea luminos (${oklchL(bg)}) la ${key}@${p}`); process.exit(1); }
    const c = contrast(parseOklch(bg));
    if (c < worst) { worst = c; worstAt = `${key}@progres=${p} (${bg})`; }
  }
}
console.log(`── ETAPA 84 D: contrast text-deschis pe butoanele de domeniu ──`);
console.log(`Cel mai prost caz: ${worst.toFixed(2)}:1 la ${worstAt}`);
if (worst < 4.5) { console.error(`\n✗ EȘEC: sub AA (4.5:1).`); process.exit(1); }
console.log(`\n✅ POARTĂ D: text deschis ≥ 4.5:1 (AA) pe TOATE butoanele de domeniu (worst ${worst.toFixed(2)}:1).`);
