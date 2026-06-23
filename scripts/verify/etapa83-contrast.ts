/**
 * etapa83-contrast.ts — ETAPA 83 FAZA B: contrast WCAG pe ÎNTREAGA paletă nouă.
 * Parsează oklch + hex + rezolvă var(--x) → o singură sursă de adevăr (globals.css).
 * Raportează FIECARE pereche text-deschis / fundal-închis a sistemului de tokeni.
 *   npx tsx scripts/verify/etapa83-contrast.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function oklchToSrgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gam = (c: number) => { const cl = Math.min(1, Math.max(0, c)); return cl <= 0.0031308 ? 12.92 * cl : 1.055 * cl ** (1 / 2.4) - 0.055; };
  return [gam(r), gam(g), gam(bb)];
}
function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255];
}
function lum([r, g, b]: [number, number, number]): number {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = lum(a), lb = lum(b); const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
// hartă nume → valoare brută (prima definiție din :root)
function rawValue(name: string): string | null {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}
function resolve(name: string, depth = 0): [number, number, number] {
  if (depth > 5) throw new Error(`var prea adânc: --${name}`);
  const v = rawValue(name);
  if (!v) throw new Error(`token --${name} negăsit`);
  const varM = v.match(/^var\(\s*--([\w-]+)\s*\)$/);
  if (varM) return resolve(varM[1], depth + 1);
  const ok = v.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (ok) return oklchToSrgb(Number(ok[1]), Number(ok[2]), Number(ok[3]));
  const hx = v.match(/#[0-9a-fA-F]{3,6}/);
  if (hx) return hexToSrgb(hx[0]);
  throw new Error(`--${name}: format necunoscut „${v}"`);
}

const DOMAIN_KEYS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'viii'];
const PAIRS: Array<{ fg: string; bg: string; min: number; rol: string }> = [
  // chrome principal
  { fg: 'foreground', bg: 'background', min: 7, rol: 'text principal (AAA)' },
  { fg: 'card-foreground', bg: 'card', min: 7, rol: 'text pe card' },
  { fg: 'popover-foreground', bg: 'popover', min: 7, rol: 'text pe popover' },
  { fg: 'primary-foreground', bg: 'primary', min: 4.5, rol: 'text pe butonul primar electric (AA)' },
  { fg: 'accent-foreground', bg: 'accent', min: 4.5, rol: 'text pe accent (AA)' },
  { fg: 'secondary-foreground', bg: 'secondary', min: 4.5, rol: 'text pe secundar (AA)' },
  { fg: 'muted-foreground', bg: 'background', min: 4.5, rol: 'text secundar pe fundal (AA)' },
  { fg: 'muted-foreground', bg: 'card', min: 4.5, rol: 'text secundar pe card (AA)' },
  { fg: 'primary', bg: 'background', min: 3, rol: 'UI primar electric (AA non-text)' },
  { fg: 'accent', bg: 'background', min: 3, rol: 'UI accent (AA non-text)' },
  { fg: 'sidebar-foreground', bg: 'sidebar', min: 7, rol: 'text în sidebar' },
  // matematica (SACRU înalt-contrast)
  { fg: 'math-fg', bg: 'background', min: 7, rol: 'matematica pe fundal (AAA)' },
  { fg: 'math-fg', bg: 'card', min: 7, rol: 'matematica pe card (AAA)' },
  { fg: 'math-fg', bg: 'math-surface', min: 7, rol: 'matematica pe suprafața solidă (AAA)' },
  // paleta nouă albastru-negru
  { fg: 'text-on-deep', bg: 'bg-deep', min: 4.5, rol: 'text pe #001D51' },
  { fg: 'text-on-deep', bg: 'bg-night', min: 4.5, rol: 'text pe #131936' },
  { fg: 'text-on-deep', bg: 'bg-black', min: 4.5, rol: 'text pe negru de bază' },
  { fg: 'foreground', bg: 'bg-deep', min: 4.5, rol: 'text principal pe #001D51' },
  { fg: 'foreground', bg: 'bg-night', min: 4.5, rol: 'text principal pe #131936' },
  { fg: 'primary-foreground', bg: 'bg-electric', min: 4.5, rol: 'text pe albastru electric #3B82F6' },
  { fg: 'foreground', bg: 'bg-electric', min: 3, rol: 'electric ca accent UI (non-text)' },
  // feedback
  { fg: 'success-foreground', bg: 'success-bg', min: 4.5, rol: 'text pe fundal succes' },
  { fg: 'danger-foreground', bg: 'danger-bg', min: 4.5, rol: 'text pe fundal greșit' },
  // domenii (diferențiere module — păstrate)
  ...DOMAIN_KEYS.flatMap((k) => [
    { fg: `domain-${k}-fg`, bg: `domain-${k}-bg`, min: 4.5, rol: `text pe domeniul ${k.toUpperCase()}` },
    { fg: 'primary-foreground', bg: `domain-${k}`, min: 4.5, rol: `text deschis pe nuanța ${k.toUpperCase()}` },
  ]),
];

let failed = 0;
console.log('── ETAPA 83 FAZA B: contrast WCAG pe paleta albastru-negru (globals.css) ──');
for (const p of PAIRS) {
  try {
    const ratio = contrast(resolve(p.fg), resolve(p.bg));
    const ok = ratio >= p.min;
    if (!ok) failed++;
    console.log(`  ${ok ? '✓' : '✗'} ${p.fg} / ${p.bg}: ${ratio.toFixed(2)}:1 (min ${p.min}) — ${p.rol}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${p.fg} / ${p.bg}: ${e instanceof Error ? e.message : e}`);
  }
}
if (failed > 0) { console.error(`\n✗ EȘEC: ${failed} perechi sub prag.`); process.exit(1); }
console.log(`\n✅ ETAPA 83 FAZA B: toate cele ${PAIRS.length} perechi trec pragurile WCAG (text deschis pe fund închis).`);
