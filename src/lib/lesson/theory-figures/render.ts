/**
 * render.ts — ETAPA 70 FAZA B1: motorul determinist al figurilor de teorie.
 *
 * Toate coordonatele sunt CALCULATE în cod (funcții, proiecții, intersecții) —
 * zero conținut matematic generat de AI (R5). Monocrom: stroke/fill =
 * currentColor (excepția sacră — culoarea vine din --math-fg prin .figura-bac).
 */

export const FIG_W = 420;
export const FIG_H = 300;

type Pt = [number, number];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function el(tag: string, attrs: Record<string, string | number>, children = ''): string {
  const a = Object.entries(attrs)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? +v.toFixed(2) : esc(String(v))}"`)
    .join(' ');
  return children ? `<${tag} ${a}>${children}</${tag}>` : `<${tag} ${a}/>`;
}

export function svgDoc(children: string[]): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIG_W} ${FIG_H}" role="img" ` +
    `font-family="system-ui, sans-serif" font-size="14" stroke-linecap="round" stroke-linejoin="round">` +
    children.join('') +
    `</svg>`
  );
}

export const line = (p: Pt, q: Pt, extra: Record<string, string | number> = {}) =>
  el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: 'currentColor', 'stroke-width': 1.6, ...extra });
export const dashed = (p: Pt, q: Pt, extra: Record<string, string | number> = {}) =>
  line(p, q, { 'stroke-dasharray': '5 4', 'stroke-width': 1.2, opacity: 0.75, ...extra });
export const label = (p: Pt, text: string, extra: Record<string, string | number> = {}) =>
  el('text', { x: p[0], y: p[1], fill: 'currentColor', stroke: 'none', ...extra }, esc(text));
export const dot = (p: Pt, r = 2.6) => el('circle', { cx: p[0], cy: p[1], r, fill: 'currentColor', stroke: 'none' });
export const poly = (pts: Pt[], extra: Record<string, string | number> = {}) =>
  el('polygon', { points: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, ...extra });
export const polyline = (pts: Pt[], extra: Record<string, string | number> = {}) =>
  el('polyline', { points: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, ...extra });
const shade = (pts: Pt[]) =>
  el('polygon', { points: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), fill: 'currentColor', opacity: 0.1, stroke: 'none' });

// ── maparea lume→ecran pentru grafice 2D ─────────────────────────────────────
export interface Mapper { sx: (x: number) => number; sy: (y: number) => number }
export function makeMapper(xMin: number, xMax: number, yMin: number, yMax: number, pad = 34): Mapper {
  return {
    sx: (x) => pad + ((x - xMin) / (xMax - xMin)) * (FIG_W - 2 * pad),
    sy: (y) => FIG_H - pad - ((y - yMin) / (yMax - yMin)) * (FIG_H - 2 * pad),
  };
}

/** axele Ox/Oy cu săgeți + O */
export function axes(m: Mapper, xMin: number, xMax: number, yMin: number, yMax: number): string {
  const x0 = m.sx(0), y0 = m.sy(0);
  const parts = [
    line([m.sx(xMin), y0], [m.sx(xMax), y0], { 'stroke-width': 1.2 }),
    line([x0, m.sy(yMin)], [x0, m.sy(yMax)], { 'stroke-width': 1.2 }),
    // săgeți
    polyline([[m.sx(xMax) - 8, y0 - 4], [m.sx(xMax), y0], [m.sx(xMax) - 8, y0 + 4]], { 'stroke-width': 1.2 }),
    polyline([[x0 - 4, m.sy(yMax) + 8], [x0, m.sy(yMax)], [x0 + 4, m.sy(yMax) + 8]], { 'stroke-width': 1.2 }),
    label([m.sx(xMax) - 4, y0 + 18], 'x'),
    label([x0 + 8, m.sy(yMax) + 6], 'y'),
    label([x0 - 14, y0 + 16], 'O'),
  ];
  return parts.join('');
}

/** eșantionarea unei funcții → segmente de path (goluri la valori nefinite) */
export function curvePath(fn: (x: number) => number, xMin: number, xMax: number, m: Mapper, n = 160): string {
  let d = '';
  let pen = false;
  for (let i = 0; i <= n; i++) {
    const x = xMin + ((xMax - xMin) * i) / n;
    const y = fn(x);
    if (!Number.isFinite(y)) { pen = false; continue; }
    const px = m.sx(x), py = m.sy(y);
    if (py < -50 || py > FIG_H + 50) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
    pen = true;
  }
  return el('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 });
}

/** poligonul de sub o curbă între a și b (pentru hașurarea ariei) */
function underCurve(fn: (x: number) => number, a: number, b: number, m: Mapper, n = 80): Pt[] {
  const pts: Pt[] = [[m.sx(a), m.sy(0)]];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    pts.push([m.sx(x), m.sy(fn(x))]);
  }
  pts.push([m.sx(b), m.sy(0)]);
  return pts;
}

// ── proiecția cavalieră pentru corpuri 3D ────────────────────────────────────
/** (x adâncime-dreapta, y adâncime, z înălțime) → ecran; calibrat pe FIG_W×FIG_H */
function proj(cx: number, cy: number) {
  return (x: number, y: number, z: number): Pt => [cx + x + 0.45 * y, cy - z - 0.28 * y];
}

/** elipsă (baza corpurilor rotunde) */
const ellipse = (c: Pt, rx: number, ry: number, extra: Record<string, string | number> = {}) =>
  el('ellipse', { cx: c[0], cy: c[1], rx, ry, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, ...extra });
/** semielipsa din spate, punctată */
const backEllipse = (c: Pt, rx: number, ry: number) =>
  el('path', { d: `M${c[0] - rx} ${c[1]}A${rx} ${ry} 0 0 1 ${c[0] + rx} ${c[1]}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: 0.75 });
const frontEllipse = (c: Pt, rx: number, ry: number) =>
  el('path', { d: `M${c[0] - rx} ${c[1]}A${rx} ${ry} 0 0 0 ${c[0] + rx} ${c[1]}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6 });

// ═══════════════ GENERATOARELE (fiecare = figură canonică de teorie) ═════════

/** aria de sub graficul lui f pe [a,b]; variante: simplă / dreptunghiuri Riemann / dreptunghiul de medie */
export function areaUnderCurve(variant: 'simpla' | 'riemann' | 'medie' = 'simpla'): string {
  const f = (x: number) => 1 + 0.55 * (x - 0.4) * (x - 0.4) + 0.2 * x;
  const [xMin, xMax, yMin, yMax] = [-1, 4.2, -0.8, 4.5];
  const m = makeMapper(xMin, xMax, yMin, yMax);
  const a = 0.8, b = 3.4;
  const parts = [shade(underCurve(f, a, b, m)), axes(m, xMin, xMax, yMin, yMax), curvePath(f, xMin, xMax, m)];
  if (variant === 'riemann') {
    for (let i = 0; i < 6; i++) {
      const x0 = a + ((b - a) * i) / 6, x1 = a + ((b - a) * (i + 1)) / 6;
      const h = f((x0 + x1) / 2);
      parts.push(poly([[m.sx(x0), m.sy(0)], [m.sx(x0), m.sy(h)], [m.sx(x1), m.sy(h)], [m.sx(x1), m.sy(0)]], { 'stroke-width': 1.1, opacity: 0.8 }));
    }
  }
  if (variant === 'medie') {
    // înălțimea medie reală a lui f pe [a,b] (integrala lui f e calculabilă analitic, aici eșantionată des)
    let s = 0; const N = 400;
    for (let i = 0; i < N; i++) s += f(a + ((b - a) * (i + 0.5)) / N);
    const mean = s / N;
    const c = a + (b - a) * 0.55;
    parts.push(
      poly([[m.sx(a), m.sy(0)], [m.sx(a), m.sy(mean)], [m.sx(b), m.sy(mean)], [m.sx(b), m.sy(0)]], { 'stroke-dasharray': '5 4', 'stroke-width': 1.2 }),
      dot([m.sx(c), m.sy(f(c))]),
      label([m.sx(c) + 6, m.sy(f(c)) - 8], 'f(c)')
    );
  }
  parts.push(
    dashed([m.sx(a), m.sy(0)], [m.sx(a), m.sy(f(a))]),
    dashed([m.sx(b), m.sy(0)], [m.sx(b), m.sy(f(b))]),
    label([m.sx(a) - 4, m.sy(0) + 18], 'a'),
    label([m.sx(b) - 4, m.sy(0) + 18], 'b'),
    label([m.sx(2.6), m.sy(f(2.6)) - 12], 'y = f(x)'),
    label([m.sx((a + b) / 2) - 10, m.sy(f((a + b) / 2) / 2.6)], 'A')
  );
  return svgDoc(parts);
}

/** aria dintre graficele a două funcții */
export function areaBetweenCurves(): string {
  const f = (x: number) => 0.5 + 0.5 * (x - 1.6) * (x - 1.6);
  const g = (x: number) => 2.6 + 0.45 * Math.sin(1.2 * x);
  const [xMin, xMax, yMin, yMax] = [-0.8, 4.2, -0.8, 4.5];
  const m = makeMapper(xMin, xMax, yMin, yMax);
  // intersecțiile f=g găsite numeric (bisecție) — determinist
  const solve = (lo: number, hi: number) => {
    let a2 = lo, b2 = hi;
    for (let i = 0; i < 60; i++) {
      const mid = (a2 + b2) / 2;
      if ((f(a2) - g(a2)) * (f(mid) - g(mid)) <= 0) b2 = mid; else a2 = mid;
    }
    return (a2 + b2) / 2;
  };
  const a = solve(-0.5, 1.5), b = solve(1.5, 4);
  const band: Pt[] = [];
  const n = 80;
  for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; band.push([m.sx(x), m.sy(g(x))]); }
  for (let i = n; i >= 0; i--) { const x = a + ((b - a) * i) / n; band.push([m.sx(x), m.sy(f(x))]); }
  return svgDoc([
    el('polygon', { points: band.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), fill: 'currentColor', opacity: 0.1, stroke: 'none' }),
    axes(m, xMin, xMax, yMin, yMax),
    curvePath(f, xMin, xMax, m),
    curvePath(g, xMin, xMax, m),
    dashed([m.sx(a), m.sy(0)], [m.sx(a), m.sy(f(a))]),
    dashed([m.sx(b), m.sy(0)], [m.sx(b), m.sy(f(b))]),
    label([m.sx(a) - 4, m.sy(0) + 18], 'a'),
    label([m.sx(b) - 4, m.sy(0) + 18], 'b'),
    label([m.sx(3.4), m.sy(f(3.4)) + 20], 'y = f(x)'),
    label([m.sx(0.2), m.sy(g(0.2)) - 10], 'y = g(x)'),
  ]);
}

/** familia primitivelor F(x)+C — trei curbe paralele */
export function primitiveFamily(): string {
  const F = (x: number) => 0.35 * x * x - 0.1 * x * x * x / 3 + 0.8;
  const [xMin, xMax, yMin, yMax] = [-1.6, 4, -1.2, 4.5];
  const m = makeMapper(xMin, xMax, yMin, yMax);
  const offs: Array<[number, string]> = [[1.1, 'F(x)+C₁'], [0, 'F(x)'], [-1.3, 'F(x)+C₂']];
  return svgDoc([
    axes(m, xMin, xMax, yMin, yMax),
    ...offs.map(([c]) => curvePath((x) => F(x) + c, xMin, xMax, m)),
    ...offs.map(([c, t]) => label([m.sx(2.9) + 4, m.sy(F(2.9) + c) - 6], t, { 'font-size': 12 })),
  ]);
}

/** corp de rotație: graficul rotit în jurul lui Ox (elipse de secțiune) */
export function solidOfRevolution(): string {
  const f = (x: number) => 0.8 + 0.45 * Math.sqrt(Math.max(0, x));
  const [xMin, xMax, yMin, yMax] = [-0.8, 4.4, -2.6, 2.8];
  const m = makeMapper(xMin, xMax, yMin, yMax);
  const a = 0.6, b = 3.6;
  const parts = [
    axes(m, xMin, xMax, yMin, yMax),
    curvePath(f, 0, xMax - 0.2, m),
    curvePath((x) => -f(x), 0, xMax - 0.2, m, 160),
  ];
  for (const x of [a, (a + b) / 2, b]) {
    const ry = Math.abs(m.sy(f(x)) - m.sy(0));
    parts.push(
      el('ellipse', { cx: m.sx(x), cy: m.sy(0), rx: ry * 0.22, ry, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1, 'stroke-dasharray': x === b ? '0' : '5 4', opacity: x === b ? 1 : 0.7 })
    );
  }
  parts.push(
    label([m.sx(a) - 6, m.sy(0) + 18], 'a'),
    label([m.sx(b) + 8, m.sy(0) + 18], 'b'),
    label([m.sx(2.2), m.sy(f(2.2)) - 10], 'y = f(x)')
  );
  return svgDoc(parts);
}

/** piramidă patrulateră: înălțimea VO + apotema VM (dacă se cere) */
export function pyramid(withApothem: boolean): string {
  const p = proj(150, 240);
  const A = p(-70, -55, 0), B = p(70, -55, 0), C = p(70, 55, 0), D = p(-70, 55, 0);
  const O = p(0, 0, 0), V = p(0, 0, 170), M = p(0, -55, 0); // M = mijlocul lui AB
  const parts = [
    poly([A, B, C]), dashed(C, D), dashed(D, A),
    line(A, V), line(B, V), line(C, V), dashed(D, V),
    dashed(V, O), dot(O), dot(V),
    label([V[0] + 8, V[1] - 4], 'V'), label([A[0] - 16, A[1] + 14], 'A'),
    label([B[0] + 6, B[1] + 14], 'B'), label([C[0] + 8, C[1] - 2], 'C'),
    label([D[0] - 18, D[1] - 2], 'D'), label([O[0] + 6, O[1] + 2], 'O'),
    label([V[0] - 22, (V[1] + O[1]) / 2], 'h'),
  ];
  if (withApothem) {
    parts.push(dashed(V, M), dot(M), label([M[0] - 6, M[1] + 16], 'M'), label([(V[0] + M[0]) / 2 - 26, (V[1] + M[1]) / 2], 'ap'));
  }
  return svgDoc(parts);
}

/** trunchi de piramidă patrulateră */
export function frustumPyramid(): string {
  const p = proj(150, 250);
  const A = p(-80, -60, 0), B = p(80, -60, 0), C = p(80, 60, 0), D = p(-80, 60, 0);
  const A1 = p(-40, -30, 130), B1 = p(40, -30, 130), C1 = p(40, 30, 130), D1 = p(-40, 30, 130);
  const O = p(0, 0, 0), O1 = p(0, 0, 130);
  return svgDoc([
    poly([A, B, C]), dashed(C, D), dashed(D, A),
    poly([A1, B1, C1, D1]),
    line(A, A1), line(B, B1), line(C, C1), dashed(D, D1),
    dashed(O, O1), dot(O), dot(O1),
    label([A[0] - 16, A[1] + 14], 'A'), label([B[0] + 6, B[1] + 14], 'B'),
    label([A1[0] - 18, A1[1] - 4], 'A₁'), label([B1[0] + 6, B1[1] - 4], 'B₁'),
    label([O1[0] - 26, (O[1] + O1[1]) / 2], 'h'), label([O[0] + 6, O[1] + 2], 'O'),
  ]);
}

/** con circular drept: r, h, generatoarea G */
export function cone(): string {
  const c: Pt = [190, 250];
  const rx = 95, ry = 26, h = 175;
  const V: Pt = [c[0], c[1] - h];
  return svgDoc([
    backEllipse(c, rx, ry), frontEllipse(c, rx, ry),
    line([c[0] - rx, c[1]], V), line([c[0] + rx, c[1]], V),
    dashed(V, c), dashed(c, [c[0] + rx, c[1]]),
    dot(c), dot(V), dot([c[0] + rx, c[1]]),
    label([V[0] + 8, V[1] - 2], 'V'), label([c[0] - 16, c[1] + 18], 'O'),
    label([c[0] + rx / 2 - 6, c[1] + 18], 'r'),
    label([c[0] - 18, c[1] - h / 2], 'h'),
    label([(V[0] + c[0] + rx) / 2 + 8, (V[1] + c[1]) / 2], 'G'),
    label([c[0] + rx + 4, c[1] + 4], 'A'),
  ]);
}

/** trunchi de con circular drept: R, r, h, G */
export function frustumCone(): string {
  const c: Pt = [200, 252];
  const R = 105, ryB = 28, r = 58, ryT = 16, h = 150;
  const ct: Pt = [c[0], c[1] - h];
  return svgDoc([
    backEllipse(c, R, ryB), frontEllipse(c, R, ryB),
    ellipse(ct, r, ryT),
    line([c[0] - R, c[1]], [ct[0] - r, ct[1]]), line([c[0] + R, c[1]], [ct[0] + r, ct[1]]),
    dashed(ct, c), dashed(c, [c[0] + R, c[1]]), dashed(ct, [ct[0] + r, ct[1]]),
    dot(c), dot(ct),
    label([c[0] - 16, c[1] + 18], 'O'), label([ct[0] - 16, ct[1] - 8], 'O₁'),
    label([c[0] + R / 2 - 4, c[1] + 18], 'R'), label([ct[0] + r / 2 - 4, ct[1] - 6], 'r'),
    label([c[0] - 20, c[1] - h / 2], 'h'),
    label([(c[0] + R + ct[0] + r) / 2 + 6, (c[1] + ct[1]) / 2], 'G'),
  ]);
}

/** prismă triunghiulară dreaptă cu înălțimea marcată */
export function prism(): string {
  const p = proj(140, 252);
  const A = p(-75, -45, 0), B = p(85, -45, 0), C = p(0, 65, 0);
  const A1 = p(-75, -45, 150), B1 = p(85, -45, 150), C1 = p(0, 65, 150);
  return svgDoc([
    line(A, B), dashed(B, C), dashed(C, A),
    poly([A1, B1, C1]),
    line(A, A1), line(B, B1), dashed(C, C1),
    label([A[0] - 16, A[1] + 14], 'A'), label([B[0] + 6, B[1] + 14], 'B'), label([C[0] + 10, C[1] + 2], 'C'),
    label([A1[0] - 20, A1[1] - 4], 'A₁'), label([B1[0] + 6, B1[1] - 4], 'B₁'), label([C1[0] + 10, C1[1] - 4], 'C₁'),
    label([B[0] + 12, (B[1] + B1[1]) / 2], 'h'),
  ]);
}

/** paralelipiped dreptunghic cu dimensiunile a, b, c și diagonala */
export function parallelepiped(withDiagonal: boolean): string {
  const p = proj(130, 245);
  const A = p(-85, -55, 0), B = p(85, -55, 0), C = p(85, 55, 0), D = p(-85, 55, 0);
  const A1 = p(-85, -55, 120), B1 = p(85, -55, 120), C1 = p(85, 55, 120), D1 = p(-85, 55, 120);
  const parts = [
    line(A, B), line(B, C), dashed(C, D), dashed(D, A),
    poly([A1, B1, C1, D1]),
    line(A, A1), line(B, B1), line(C, C1), dashed(D, D1),
    label([A[0] - 16, A[1] + 14], 'A'), label([B[0] + 4, B[1] + 14], 'B'),
    label([C[0] + 8, C[1] + 2], 'C'), label([D[0] - 18, D[1] + 2], 'D'),
    label([A1[0] - 20, A1[1] - 4], 'A₁'), label([C1[0] + 8, C1[1] - 6], 'C₁'),
    label([(A[0] + B[0]) / 2 - 4, A[1] + 18], 'a'),
    label([(B[0] + C[0]) / 2 + 10, (B[1] + C[1]) / 2 + 12], 'b'),
    label([B[0] + 12, (B[1] + B1[1]) / 2], 'c'),
  ];
  if (withDiagonal) parts.push(dashed(A, C1, { 'stroke-width': 1.4 }), label([(A[0] + C1[0]) / 2 - 8, (A[1] + C1[1]) / 2 - 8], 'd'));
  return svgDoc(parts);
}

/** cilindru circular drept: r, h */
export function cylinder(): string {
  const c: Pt = [200, 250];
  const rx = 85, ry = 24, h = 160;
  const ct: Pt = [c[0], c[1] - h];
  return svgDoc([
    backEllipse(c, rx, ry), frontEllipse(c, rx, ry),
    ellipse(ct, rx, ry),
    line([c[0] - rx, c[1]], [ct[0] - rx, ct[1]]), line([c[0] + rx, c[1]], [ct[0] + rx, ct[1]]),
    dashed(c, [c[0] + rx, c[1]]), dashed(ct, c),
    dot(c), dot(ct),
    label([c[0] - 16, c[1] + 18], 'O'), label([ct[0] - 16, ct[1] - 8], 'O₁'),
    label([c[0] + rx / 2 - 4, c[1] + 18], 'r'),
    label([c[0] + rx + 8, c[1] - h / 2], 'h'),
  ]);
}

/** cerc cu centru și rază (+ hașura discului dacă se cere) */
export function circleFig(withDisc: boolean): string {
  const c: Pt = [210, 152];
  const r = 105;
  const P: Pt = [c[0] + r * Math.cos(-0.5), c[1] + r * Math.sin(-0.5)];
  const parts: string[] = [];
  if (withDisc) parts.push(el('circle', { cx: c[0], cy: c[1], r, fill: 'currentColor', opacity: 0.1, stroke: 'none' }));
  parts.push(
    el('circle', { cx: c[0], cy: c[1], r, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
    line(c, P, { 'stroke-width': 1.4 }), dot(c), dot(P),
    label([c[0] - 8, c[1] + 20], 'O'),
    label([(c[0] + P[0]) / 2 + 4, (c[1] + P[1]) / 2 - 6], 'r'),
    label([P[0] + 8, P[1]], 'M')
  );
  return svgDoc(parts);
}

/** dreptunghi (L, l) sau pătrat (a) cu aria hașurată */
export function rectangleFig(square: boolean): string {
  const w = square ? 180 : 250, h = 180;
  const x = (FIG_W - w) / 2, y = (FIG_H - h) / 2;
  const pts: Pt[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return svgDoc([
    shade(pts), poly(pts, { 'stroke-width': 2 }),
    label([x - 18, y + 14], square ? 'D' : 'D'), label([x + w + 6, y + 14], 'C'),
    label([x + w + 6, y + h + 4], 'B'), label([x - 18, y + h + 4], 'A'),
    label([x + w / 2 - 6, y + h + 20], square ? 'a' : 'L'),
    label([x - 20, y + h / 2 + 4], square ? 'a' : 'l'),
    label([x + w / 2 - 8, y + h / 2 + 5], 'A'),
  ]);
}

/** figuri plane compuse: dreptunghi + triunghi + semidisc pe un rând */
export function planeFigures(): string {
  const y = 200;
  const rect: Pt[] = [[30, y], [130, y], [130, y - 90], [30, y - 90]];
  const tri: Pt[] = [[160, y], [280, y], [205, y - 110]];
  const c: Pt = [345, y - 30];
  return svgDoc([
    shade(rect), poly(rect),
    shade(tri), poly(tri),
    el('path', { d: `M${c[0] - 55} ${c[1]}A55 55 0 0 1 ${c[0] + 55} ${c[1]}Z`, fill: 'currentColor', opacity: 0.1, stroke: 'none' }),
    el('path', { d: `M${c[0] - 55} ${c[1]}A55 55 0 0 1 ${c[0] + 55} ${c[1]}Z`, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 }),
    label([70, y + 22], 'A₁'), label([205, y + 22], 'A₂'), label([335, y + 22], 'A₃'),
    label([95, y - 110 - 8], 'A = A₁ + A₂ + A₃', { 'font-size': 15 }),
  ]);
}

// ── triunghiuri remarcabile (coordonate fixe, punctele derivate CALCULATE) ───
const TA: Pt = [60, 250], TB: Pt = [370, 250], TC: Pt = [150, 60];
const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const lerp = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/** bisectoarea din A: D pe BC cu BD/DC = AB/AC (teorema bisectoarei) */
export function triangleBisector(): string {
  const AB = dist(TA, TB), AC = dist(TA, TC);
  const t = AB / (AB + AC); // BD/BC
  const D = lerp(TB, TC, t);
  return svgDoc([
    poly([TA, TB, TC], { 'stroke-width': 2 }),
    line(TA, D, { 'stroke-width': 1.6 }), dot(D),
    label([TA[0] - 18, TA[1] + 6], 'A'), label([TB[0] + 8, TB[1] + 6], 'B'), label([TC[0] - 4, TC[1] - 8], 'C'),
    label([D[0] + 10, D[1]], 'D'),
    label([(TA[0] + D[0]) / 2 - 10, (TA[1] + D[1]) / 2 - 8], 'b'),
  ]);
}

/** centrul cercului circumscris: intersecția mediatoarelor (calculată exact) */
export function triangleCircumcircle(): string {
  // mediatoarele: rezolvarea exactă a sistemului |PA|=|PB|=|PC|
  const [ax, ay] = TA, [bx, by] = TB, [cx, cy] = TC;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const O: Pt = [ux, uy];
  const R = dist(O, TA);
  return svgDoc([
    el('circle', { cx: ux, cy: uy, r: R, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-dasharray': '6 5', opacity: 0.85 }),
    poly([TA, TB, TC], { 'stroke-width': 2 }),
    dot(O), line(O, TA, { 'stroke-width': 1.1, opacity: 0.8 }),
    label([ux + 8, uy + 4], 'O'),
    label([(ux + ax) / 2 - 14, (uy + ay) / 2], 'R'),
    label([TA[0] - 18, TA[1] + 6], 'A'), label([TB[0] + 8, TB[1] + 6], 'B'), label([TC[0] - 4, TC[1] - 8], 'C'),
  ]);
}

/** centrul de greutate: intersecția medianelor (G = media vârfurilor) */
export function triangleCentroid(): string {
  const MA = lerp(TB, TC, 0.5), MB = lerp(TA, TC, 0.5), MC = lerp(TA, TB, 0.5);
  const G: Pt = [(TA[0] + TB[0] + TC[0]) / 3, (TA[1] + TB[1] + TC[1]) / 3];
  return svgDoc([
    poly([TA, TB, TC], { 'stroke-width': 2 }),
    line(TA, MA, { 'stroke-width': 1.2, opacity: 0.85 }),
    line(TB, MB, { 'stroke-width': 1.2, opacity: 0.85 }),
    line(TC, MC, { 'stroke-width': 1.2, opacity: 0.85 }),
    dot(G), dot(MA, 2), dot(MB, 2), dot(MC, 2),
    label([G[0] + 8, G[1] - 6], 'G'),
    label([TA[0] - 18, TA[1] + 6], 'A'), label([TB[0] + 8, TB[1] + 6], 'B'), label([TC[0] - 4, TC[1] - 8], 'C'),
  ]);
}

/** două triunghiuri asemenea (raport 0.55, translatat) sau congruente (raport 1) */
export function twoTriangles(similar: boolean): string {
  const A: Pt = [40, 240], B: Pt = [195, 240], C: Pt = [105, 110];
  const scale = similar ? 0.55 : 1;
  const A1: Pt = [235, 240];
  const B1: Pt = [A1[0] + (B[0] - A[0]) * scale, 240];
  const C1: Pt = [A1[0] + (C[0] - A[0]) * scale, 240 - (240 - C[1]) * scale];
  return svgDoc([
    poly([A, B, C], { 'stroke-width': 2 }),
    poly([A1, B1, C1], { 'stroke-width': 2 }),
    label([A[0] - 6, A[1] + 18], 'A'), label([B[0] - 4, B[1] + 18], 'B'), label([C[0] - 6, C[1] - 8], 'C'),
    label([A1[0] - 6, A1[1] + 18], 'A₁'), label([B1[0] - 4, B1[1] + 18], 'B₁'), label([C1[0] - 6, C1[1] - 8], 'C₁'),
    label([130, 50], similar ? '△ABC ~ △A₁B₁C₁' : '△ABC ≡ △A₁B₁C₁', { 'font-size': 15 }),
  ]);
}

/** trei corpuri (prismă, cilindru, con) — volumul corpului geometric, generic */
export function solidsTrio(): string {
  // prismă mică
  const p1 = proj(70, 235);
  const a = p1(-38, -22, 0), b = p1(38, -22, 0), c2 = p1(0, 30, 0);
  const a1 = p1(-38, -22, 95), b1 = p1(38, -22, 95), c1 = p1(0, 30, 95);
  // cilindru mic
  const cc: Pt = [215, 235]; const crx = 38, cry = 11, ch = 100;
  // con mic
  const kc: Pt = [340, 235]; const krx = 42, kry = 12, kh = 110;
  return svgDoc([
    line(a, b), dashed(b, c2), dashed(c2, a), poly([a1, b1, c1]), line(a, a1), line(b, b1), dashed(c2, c1),
    backEllipse(cc, crx, cry), frontEllipse(cc, crx, cry), ellipse([cc[0], cc[1] - ch], crx, cry),
    line([cc[0] - crx, cc[1]], [cc[0] - crx, cc[1] - ch]), line([cc[0] + crx, cc[1]], [cc[0] + crx, cc[1] - ch]),
    backEllipse(kc, krx, kry), frontEllipse(kc, krx, kry),
    line([kc[0] - krx, kc[1]], [kc[0], kc[1] - kh]), line([kc[0] + krx, kc[1]], [kc[0], kc[1] - kh]),
    label([60, 275], 'V = A·h', { 'font-size': 13 }),
    label([185, 275], 'V = πr²h', { 'font-size': 13 }),
    label([305, 275], 'V = πr²h/3', { 'font-size': 13 }),
  ]);
}
