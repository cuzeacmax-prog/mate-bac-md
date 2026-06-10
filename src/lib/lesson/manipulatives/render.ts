/**
 * render.ts — ETAPA 71 FAZA C: cele 8 MANIPULATIVE (vocabularul vizual).
 *
 * Componente SVG parametrice DETERMINISTE — AI-ul le invocă cu parametri
 * VALIDAȚI (schema în index.ts), nu desenează nimic (R5). Stil: monocrom
 * matematic (currentColor); accentul domeniului apare DOAR pe evidențieri,
 * prin var(--manip-accent, var(--primary)) — setat de rama care randează.
 */
import { el, label, svgDoc } from '@/lib/lesson/theory-figures/render';

const ACCENT = 'var(--manip-accent, var(--primary))';

type Pt = [number, number];

const rect = (x: number, y: number, w: number, h: number, extra: Record<string, string | number> = {}) =>
  el('rect', { x, y, width: w, height: h, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, ...extra });
const circle = (c: Pt, r: number, extra: Record<string, string | number> = {}) =>
  el('circle', { cx: c[0], cy: c[1], r, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, ...extra });
const lineEl = (p: Pt, q: Pt, extra: Record<string, string | number> = {}) =>
  el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: 'currentColor', 'stroke-width': 1.6, ...extra });

// ── 1) zaruri{n≤4, fete[1..6]} ───────────────────────────────────────────────
const PIP_POS: Record<number, Pt[]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export function zaruri(params: { n: number; fete: number[] }): string {
  const size = 76;
  const gap = 24;
  const total = params.n * size + (params.n - 1) * gap;
  const x0 = (420 - total) / 2;
  const y0 = 110;
  const parts: string[] = [];
  for (let i = 0; i < params.n; i++) {
    const x = x0 + i * (size + gap);
    parts.push(rect(x, y0, size, size, { rx: 12 }));
    const face = params.fete[i];
    for (const [px, py] of PIP_POS[face] ?? []) {
      parts.push(el('circle', { cx: x + size / 2 + px * 20, cy: y0 + size / 2 + py * 20, r: 6, fill: 'currentColor', stroke: 'none' }));
    }
    parts.push(label([x + size / 2 - 4, y0 + size + 22], String(face), { 'font-size': 13 }));
  }
  return svgDoc(parts);
}

// ── 2) monede{n≤8, rezultate?} (B = banul/cifra, S = stema) ─────────────────
export function monede(params: { n: number; rezultate?: Array<'B' | 'S'> }): string {
  const r = 30;
  const gap = 18;
  const perRow = Math.min(params.n, 4);
  const rows = Math.ceil(params.n / perRow);
  const parts: string[] = [];
  for (let i = 0; i < params.n; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(params.n - row * perRow, perRow);
    const x0 = (420 - (inRow * (2 * r) + (inRow - 1) * gap)) / 2 + r;
    const cx = x0 + (i % perRow) * (2 * r + gap);
    const cy = 150 - ((rows - 1) * (r + 14)) / 2 + row * (2 * r + 14);
    const res = params.rezultate?.[i];
    parts.push(circle([cx, cy], r, res ? { stroke: ACCENT, 'stroke-width': 3 } : {}));
    parts.push(circle([cx, cy], r - 6, { 'stroke-width': 1, opacity: 0.5 }));
    parts.push(label([cx - 6, cy + 7], res ?? '?', { 'font-size': 20, 'font-weight': 700, ...(res ? { fill: ACCENT } : {}) }));
  }
  return svgDoc(parts);
}

// ── 3) urna{bile:[{culoare,n}] total≤20, extrase?} ───────────────────────────
export function urna(params: { bile: Array<{ culoare: string; n: number }>; extrase?: string[] }): string {
  const parts: string[] = [
    // conturul urnei
    el('path', { d: 'M120 90 L120 230 Q120 258 150 258 L270 258 Q300 258 300 230 L300 90', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2 }),
    lineEl([108, 90], [312, 90], { 'stroke-width': 2.2 }),
  ];
  const balls: Array<{ letter: string; culoare: string }> = [];
  for (const { culoare, n } of params.bile) {
    for (let i = 0; i < n; i++) balls.push({ letter: culoare[0].toUpperCase(), culoare });
  }
  const r = 14;
  balls.forEach((b, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const cx = 152 + col * 30 + (row % 2 === 1 ? 14 : 0);
    const cy = 238 - row * 27;
    parts.push(circle([cx, cy], r, { 'stroke-width': 1.6 }));
    parts.push(label([cx - 5, cy + 5], b.letter, { 'font-size': 13, 'font-weight': 600 }));
  });
  // extrasele: lângă urnă, cu accent
  (params.extrase ?? []).forEach((culoare, i) => {
    const cx = 352;
    const cy = 120 + i * 36;
    parts.push(circle([cx, cy], r, { stroke: ACCENT, 'stroke-width': 3 }));
    parts.push(label([cx - 5, cy + 5], culoare[0].toUpperCase(), { 'font-size': 13, 'font-weight': 700, fill: ACCENT }));
  });
  if (params.extrase?.length) parts.push(label([330, 86], 'extrase:', { 'font-size': 12 }));
  // legenda culorilor
  const legend = params.bile.map((b) => `${b.culoare[0].toUpperCase()} = ${b.culoare} (${b.n})`).join('  ·  ');
  parts.push(label([60, 290], legend, { 'font-size': 12 }));
  return svgDoc(parts);
}

// ── 4) persoane{n≤10, evidentiati?, ordonat?} ────────────────────────────────
export function persoane(params: { n: number; evidentiati?: number[]; ordonat?: boolean }): string {
  const gap = Math.min(72, 360 / params.n);
  const x0 = (420 - (params.n - 1) * gap) / 2;
  const cy = 130;
  const parts: string[] = [];
  const hi = new Set(params.evidentiati ?? []);
  for (let i = 0; i < params.n; i++) {
    const x = x0 + i * gap;
    const isHi = hi.has(i + 1); // 1-based — pozițiile din enunț
    const stroke = isHi ? ACCENT : 'currentColor';
    const sw = isHi ? 2.6 : 1.8;
    parts.push(
      circle([x, cy - 26], 13, { stroke, 'stroke-width': sw }),
      el('path', { d: `M${x} ${cy - 13} L${x} ${cy + 22} M${x - 16} ${cy} L${x + 16} ${cy} M${x} ${cy + 22} L${x - 13} ${cy + 48} M${x} ${cy + 22} L${x + 13} ${cy + 48}`, fill: 'none', stroke, 'stroke-width': sw, 'stroke-linecap': 'round' })
    );
    if (params.ordonat) parts.push(label([x - 4, cy + 72], String(i + 1), { 'font-size': 14, 'font-weight': 600, ...(isHi ? { fill: ACCENT } : {}) }));
  }
  if (params.ordonat) parts.push(label([150, 250], 'ordinea contează', { 'font-size': 12, opacity: 0.7 }));
  return svgDoc(parts);
}

// ── 5) carti{n≤8, valori?} ───────────────────────────────────────────────────
export function carti(params: { n: number; valori?: string[] }): string {
  const w = 58, h = 84;
  const gap = Math.min(20, (380 - params.n * w) / Math.max(params.n - 1, 1));
  const total = params.n * w + (params.n - 1) * gap;
  const x0 = (420 - total) / 2;
  const y0 = 108;
  const parts: string[] = [];
  for (let i = 0; i < params.n; i++) {
    const x = x0 + i * (w + gap);
    parts.push(rect(x, y0, w, h, { rx: 8 }));
    const v = params.valori?.[i];
    if (v) parts.push(label([x + w / 2 - v.length * 4.5, y0 + h / 2 + 6], v, { 'font-size': 17, 'font-weight': 700 }));
    else {
      parts.push(el('path', { d: `M${x + 10} ${y0 + 10} L${x + w - 10} ${y0 + h - 10} M${x + w - 10} ${y0 + 10} L${x + 10} ${y0 + h - 10}`, stroke: 'currentColor', 'stroke-width': 0.8, opacity: 0.35, fill: 'none' }));
    }
  }
  return svgDoc(parts);
}

// ── 6) dreapta-numerica{min,max,puncte≤10,intervale?} ────────────────────────
export function dreaptaNumerica(params: {
  min: number; max: number; puncte?: number[];
  intervale?: Array<{ de_la: number; pana_la: number }>;
}): string {
  const x0 = 40, x1 = 380, y = 160;
  const sx = (v: number) => x0 + ((v - params.min) / (params.max - params.min)) * (x1 - x0);
  const parts: string[] = [];
  // intervalele evidențiate (sub axă, accent)
  for (const iv of params.intervale ?? []) {
    parts.push(el('rect', { x: sx(iv.de_la), y: y - 7, width: sx(iv.pana_la) - sx(iv.de_la), height: 14, fill: ACCENT, opacity: 0.25, stroke: 'none' }));
  }
  parts.push(
    lineEl([x0 - 12, y], [x1 + 14, y], { 'stroke-width': 2 }),
    el('polyline', { points: `${x1 + 6},${y - 5} ${x1 + 14},${y} ${x1 + 6},${y + 5}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 })
  );
  // gradațiile întregi (max 21 ca să rămână lizibil)
  const span = params.max - params.min;
  const step = span <= 20 ? 1 : Math.ceil(span / 20);
  for (let v = params.min; v <= params.max; v += step) {
    parts.push(lineEl([sx(v), y - 6], [sx(v), y + 6], { 'stroke-width': 1.2 }));
    parts.push(label([sx(v) - 5, y + 26], String(v), { 'font-size': 12 }));
  }
  for (const p of params.puncte ?? []) {
    parts.push(el('circle', { cx: sx(p), cy: y, r: 6, fill: ACCENT, stroke: 'none' }));
    parts.push(label([sx(p) - 8, y - 14], String(p), { 'font-size': 13, 'font-weight': 700, fill: ACCENT }));
  }
  return svgDoc(parts);
}

// ── 7) bare-fractii{numitor≤12, evidentiate} ─────────────────────────────────
export function bareFractii(params: { numitor: number; evidentiate: number }): string {
  const x0 = 40, w = 340, h = 56, y = 130;
  const cell = w / params.numitor;
  const parts: string[] = [];
  for (let i = 0; i < params.numitor; i++) {
    const filled = i < params.evidentiate;
    parts.push(
      el('rect', {
        x: x0 + i * cell, y, width: cell, height: h,
        fill: filled ? ACCENT : 'none', opacity: filled ? 0.55 : 1,
        stroke: 'currentColor', 'stroke-width': 1.6,
      })
    );
  }
  parts.push(label([186, 226], `${params.evidentiate}/${params.numitor}`, { 'font-size': 22, 'font-weight': 700 }));
  return svgDoc(parts);
}

// ── 8) venn{etichete, zone evidentiate} ──────────────────────────────────────
export function venn(params: { eticheta_a: string; eticheta_b: string; zone?: Array<'A' | 'B' | 'AB'> }): string {
  const ca: Pt = [165, 150], cb: Pt = [255, 150];
  const r = 86;
  const zones = new Set(params.zone ?? []);
  const parts: string[] = [];
  // evidențierile prin clip-path-uri deterministe
  if (zones.has('A')) parts.push(el('path', { d: lensOutsidePath(ca, cb, r, true), fill: ACCENT, opacity: 0.25, stroke: 'none' }));
  if (zones.has('B')) parts.push(el('path', { d: lensOutsidePath(cb, ca, r, false), fill: ACCENT, opacity: 0.25, stroke: 'none' }));
  if (zones.has('AB')) parts.push(el('path', { d: lensPath(ca, cb, r), fill: ACCENT, opacity: 0.35, stroke: 'none' }));
  parts.push(
    circle(ca, r, { 'stroke-width': 2 }),
    circle(cb, r, { 'stroke-width': 2 }),
    rect(48, 42, 324, 216, { 'stroke-width': 1.2, opacity: 0.5 }),
    label([ca[0] - 60, 60], params.eticheta_a, { 'font-size': 15, 'font-weight': 700 }),
    label([cb[0] + 40, 60], params.eticheta_b, { 'font-size': 15, 'font-weight': 700 })
  );
  return svgDoc(parts);
}

/** lentila A∩B (intersecția a două cercuri egale) */
function lensPath([ax, ay]: Pt, [bx]: Pt, r: number): string {
  const d = bx - ax;
  const x = ax + d / 2;
  const h = Math.sqrt(r * r - (d / 2) * (d / 2));
  return `M${x} ${ay - h} A${r} ${r} 0 0 1 ${x} ${ay + h} A${r} ${r} 0 0 1 ${x} ${ay - h}Z`;
}

/** zona DOAR-A (cercul A minus lentila) — aproximare cu arce */
function lensOutsidePath([ax, ay]: Pt, [bx]: Pt, r: number, left: boolean): string {
  const d = Math.abs(bx - ax);
  const x = (ax + bx) / 2;
  const h = Math.sqrt(r * r - (d / 2) * (d / 2));
  const sweep = left ? 1 : 0;
  return `M${x} ${ay - h} A${r} ${r} 0 1 ${sweep ? 0 : 1} ${x} ${ay + h} A${r} ${r} 0 0 ${sweep} ${x} ${ay - h}Z`;
}
