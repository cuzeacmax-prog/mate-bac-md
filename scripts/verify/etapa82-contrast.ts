/**
 * etapa82-contrast.ts — ETAPA 82 POARTĂ D: contrast AA pe perechile NOI de paletă.
 *
 * Rulează: npx tsx scripts/verify/etapa82-contrast.ts
 *
 * Tokenii de paletă (--bg-deep/#001D51, --bg-night/#131936, --bg-black) sunt în
 * HEX (valorile exacte cerute de owner), pe care poarta etapa70 (oklch-only) nu
 * le poate citi. Aici parsăm ȘI hex ȘI oklch și raportăm contrastul WCAG pentru
 * fiecare pereche text-deschis / fundal-închis nouă. Prag text normal AA ≥ 4.5.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function oklchToSrgb(L: number, C: number, Hdeg: number): [number, number, number] {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const toGamma = (c: number) => {
    const cl = Math.min(1, Math.max(0, c));
    return cl <= 0.0031308 ? 12.92 * cl : 1.055 * cl ** (1 / 2.4) - 0.055;
  };
  return [toGamma(r), toGamma(g), toGamma(bb)];
}

function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
function token(name: string): [number, number, number] {
  const oklch = css.match(new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`));
  if (oklch) return oklchToSrgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  const hex = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  if (hex) return hexToSrgb(hex[1]);
  throw new Error(`token --${name} negăsit (oklch sau hex) în globals.css`);
}

// Perechile NOI introduse de ETAPA 82 D (text deschis pe fundal închis).
const PAIRS: Array<{ fg: string; bg: string; min: number; rol: string }> = [
  { fg: 'text-on-deep', bg: 'bg-deep', min: 4.5, rol: 'text deschis pe #001D51 (AA)' },
  { fg: 'text-on-deep', bg: 'bg-night', min: 4.5, rol: 'text deschis pe #131936 (AA)' },
  { fg: 'text-on-deep', bg: 'bg-black', min: 4.5, rol: 'text deschis pe negru de bază (AA)' },
  { fg: 'foreground', bg: 'bg-deep', min: 4.5, rol: 'text principal pe #001D51 (AA)' },
  { fg: 'foreground', bg: 'bg-night', min: 4.5, rol: 'text principal pe #131936 (AA, onboarding)' },
  { fg: 'foreground', bg: 'bg-black', min: 4.5, rol: 'text principal pe negru de bază (AA)' },
  { fg: 'muted-foreground', bg: 'bg-deep', min: 4.5, rol: 'text secundar (legendă) pe #001D51 (AA)' },
  { fg: 'muted-foreground', bg: 'bg-night', min: 4.5, rol: 'text secundar pe #131936 (AA)' },
  { fg: 'math-fg', bg: 'bg-deep', min: 7, rol: 'matematica pe #001D51 (AAA)' },
];

let failed = 0;
console.log('── ETAPA 82 D: contrast WCAG pe perechile NOI de paletă (globals.css) ──');
for (const p of PAIRS) {
  try {
    const ratio = contrast(token(p.fg), token(p.bg));
    const ok = ratio >= p.min;
    if (!ok) failed++;
    console.log(`  ${ok ? '✓' : '✗'} ${p.fg} / ${p.bg}: ${ratio.toFixed(2)}:1 (min ${p.min}) — ${p.rol}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${p.fg} / ${p.bg}: ${e instanceof Error ? e.message : e}`);
  }
}
if (failed > 0) {
  console.error(`\n✗ EȘEC: ${failed} perechi noi sub prag sau lipsă.`);
  process.exit(1);
}
console.log('\n✅ ETAPA 82 POARTĂ D acceptată: toate perechile noi trec AA (text deschis pe fund închis).');
