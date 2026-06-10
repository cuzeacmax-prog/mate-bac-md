/**
 * ETAPA 70 FAZA A — poartă de contrast WCAG pe tokens-ii design system-ului.
 *
 * Citește perechile critice DIN globals.css (nu valori duplicate aici),
 * convertește OKLCH → sRGB → luminanță relativă → raport de contrast.
 * Praguri: text normal ≥ 4.5 (AA), text mare/UI ≥ 3, matematică ≥ 7 (înalt-contrast).
 * Orice pereche sub prag → exit 1.
 *
 *   npx tsx scripts/verify/etapa70-contrast.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── OKLCH → sRGB (pipeline standard OKLab, fără dependențe) ─────────────────
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

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ── citește tokens din globals.css (:root, prima apariție) ──────────────────
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
function token(name: string): [number, number, number] {
  const re = new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`);
  const m = css.match(re);
  if (!m) throw new Error(`token --${name} negăsit ca oklch(L C H) în globals.css`);
  return oklchToSrgb(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** ETAPA 71 A2: cele 7 domenii — text pe fundalul de domeniu (AA) + nuanța ca UI */
const DOMAIN_KEYS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'viii'] as const;
const DOMAIN_PAIRS = DOMAIN_KEYS.flatMap((k) => [
  { fg: `domain-${k}-fg`, bg: `domain-${k}-bg`, min: 4.5, rol: `text pe fundal domeniul ${k.toUpperCase()} (AA)` },
  { fg: `domain-${k}`, bg: 'background', min: 3, rol: `nuanța domeniului ${k.toUpperCase()} ca UI (AA non-text)` },
]);

const PAIRS: Array<{ fg: string; bg: string; min: number; rol: string }> = [
  ...DOMAIN_PAIRS,
  { fg: 'foreground', bg: 'background', min: 7, rol: 'text principal (AAA)' },
  { fg: 'primary-foreground', bg: 'primary', min: 4.5, rol: 'text pe butonul primar (AA)' },
  { fg: 'accent-foreground', bg: 'accent', min: 4.5, rol: 'text pe accent energic (AA)' },
  { fg: 'muted-foreground', bg: 'background', min: 4.5, rol: 'text secundar (AA)' },
  { fg: 'muted-foreground', bg: 'card', min: 4.5, rol: 'text secundar pe card (AA)' },
  { fg: 'primary', bg: 'background', min: 3, rol: 'componente UI primare (AA non-text)' },
  { fg: 'math-fg', bg: 'background', min: 7, rol: 'EXCEPȚIA SACRĂ: matematica monocrom înalt-contrast' },
  { fg: 'math-fg', bg: 'card', min: 7, rol: 'matematica pe card' },
  { fg: 'success', bg: 'background', min: 3, rol: 'feedback corect (UI)' },
  { fg: 'success-foreground', bg: 'success-bg', min: 4.5, rol: 'text pe fundal succes (AA)' },
  { fg: 'danger-foreground', bg: 'danger-bg', min: 4.5, rol: 'text pe fundal greșit (AA)' },
];

let failed = 0;
console.log('Contrast WCAG pe tokens (din globals.css):');
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
  console.error(`\n✗ EȘEC: ${failed} perechi sub prag sau lipsă.`);
  process.exit(1);
}
console.log('\n✅ toate perechile trec pragurile WCAG.');
