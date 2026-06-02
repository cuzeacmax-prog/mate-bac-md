/**
 * ETAPA 44 — Randare HEADLESS în SVG (fără DOM/JSXGraph), pentru POARTA VIZUALĂ.
 *
 * `renderToDrawing(spec)` unifică 2D și 3D la un Drawing2D (polilinii + etichete + bbox + puncte numite).
 * `toSVG(drawing)` îl serializează ca SVG curat (fundal alb → rasterizabil cu sharp pentru a fi „privit").
 * Pur. NU înlocuiește randorul de UI (JSXGraph/proiecție) — îl OGLINDEȘTE suficient cât să fie verificat vizual.
 */
import { solveBasePoints, frameSolved, type FigureSpec2D, type FigureElement } from "./spec";
import { projectFigure, placeVertexLabels, type Drawing2D } from "./project";
import type { FigureSpec3D } from "./spec3d";

type V2 = [number, number];
const isThreeD = (spec: FigureSpec2D | FigureSpec3D): spec is FigureSpec3D => "scene" in spec || "body" in spec;

// ───────────────────────── 2D pur → Drawing2D (coordonate ecran, y în jos) ─────────────────────────
const incenter = (A: V2, B: V2, C: V2): { c: V2; r: number } => {
  const a = Math.hypot(B[0] - C[0], B[1] - C[1]), b = Math.hypot(C[0] - A[0], C[1] - A[1]), c = Math.hypot(A[0] - B[0], A[1] - B[1]);
  const s = a + b + c, cx = (a * A[0] + b * B[0] + c * C[0]) / s, cy = (a * A[1] + b * B[1] + c * C[1]) / s;
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  return { c: [cx, cy], r: area / (s / 2) };
};
const circumcenter = (A: V2, B: V2, C: V2): { c: V2; r: number } => {
  const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])) || 1e-9;
  const A2 = A[0] ** 2 + A[1] ** 2, B2 = B[0] ** 2 + B[1] ** 2, C2 = C[0] ** 2 + C[1] ** 2;
  const ux = (A2 * (B[1] - C[1]) + B2 * (C[1] - A[1]) + C2 * (A[1] - B[1])) / d;
  const uy = (A2 * (C[0] - B[0]) + B2 * (A[0] - C[0]) + C2 * (B[0] - A[0])) / d;
  return { c: [ux, uy], r: Math.hypot(A[0] - ux, A[1] - uy) };
};
const circlePts = (c: V2, r: number, n = 64): V2[] => Array.from({ length: n + 1 }, (_, i) => { const t = (2 * Math.PI * i) / n; return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)] as V2; });

export function drawSpec2D(spec: FigureSpec2D): Drawing2D {
  const base = solveBasePoints(spec);
  const hasGenerator = spec.elements.some((e) => e.kind === "triangleFromSides" || e.kind === "quadFromConstraints");
  const reframe = !!spec.framing || hasGenerator;
  const solved = reframe ? frameSolved(base, spec.framing) : base;
  const flip = (p: { x: number; y: number }): V2 => [p.x, -p.y]; // ecran: y în jos
  const named: Record<string, V2> = {};
  for (const [id, p] of Object.entries(solved)) named[id] = flip(p);

  const polylines: Drawing2D["polylines"] = [];
  const labels: Drawing2D["labels"] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x: number, y: number) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  const poly = (pts: V2[], dashed = false, closed = false) => { const ps = closed ? [...pts, pts[0]] : pts; polylines.push({ pts: ps, dashed }); ps.forEach((p) => acc(p[0], p[1])); };
  const P = (id: string): V2 | null => named[id] ?? null;

  const tri3 = (ids: string[]): [V2, V2, V2] | null => { const a = P(ids[0]), b = P(ids[1]), c = P(ids[2]); return a && b && c ? [a, b, c] : null; };
  for (const e of spec.elements as FigureElement[]) {
    if (e.kind === "polygon") { const ps = e.points.map(P).filter(Boolean) as V2[]; if (ps.length >= 2) poly(ps, false, true); }
    else if (e.kind === "triangleFromSides") { const t = tri3(e.ids); if (t) poly(t, false, true); }
    else if (e.kind === "segment") { const a = P(e.between[0]), b = P(e.between[1]); if (a && b) { poly([a, b]); if (e.label) { labels.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, text: e.label }); } } }
    else if (e.kind === "incircle") { const t = tri3(e.of); if (t) { const { c, r } = incenter(...t); poly(circlePts(c, r)); } }
    else if (e.kind === "circumcircle") { const t = tri3(e.of); if (t) { const { c, r } = circumcenter(...t); poly(circlePts(c, r)); } }
    else if (e.kind === "circle") { const c = P(e.center); if (c) { const r = e.radius ?? (e.through && P(e.through) ? Math.hypot(c[0] - P(e.through)![0], c[1] - P(e.through)![1]) : 1); poly(circlePts(c, r)); } }
    else if (e.kind === "rightAngle") { const at = P(e.at), p = P(e.from[0]), q = P(e.from[1]); if (at && p && q) { const u = unit(at, p), v = unit(at, q); const s = 0.12 * span2(named); const k1: V2 = [at[0] + u[0] * s, at[1] + u[1] * s], k2: V2 = [at[0] + v[0] * s, at[1] + v[1] * s], k3: V2 = [at[0] + (u[0] + v[0]) * s, at[1] + (u[1] + v[1]) * s]; poly([k1, k3, k2]); } }
    else if (e.kind === "angle") { const at = e.at ? P(e.at) : null; const p = e.from ? P(e.from[0]) : null, q = e.from ? P(e.from[1]) : null; if (at && p && q) { const u = unit(at, p), v = unit(at, q); const s = 0.16 * span2(named); const arc: V2[] = Array.from({ length: 13 }, (_, i) => { const t = i / 12; const m = unit2([u[0] * (1 - t) + v[0] * t, u[1] * (1 - t) + v[1] * t]); return [at[0] + m[0] * s, at[1] + m[1] * s] as V2; }); poly(arc); if (e.label) { const m = unit2([u[0] + v[0], u[1] + v[1]]); labels.push({ x: at[0] + m[0] * s * 1.6, y: at[1] + m[1] * s * 1.6, text: e.label }); } } }
    else if (e.kind === "equalAngle") { const at = P(e.at), p = P(e.from[0]), q = P(e.from[1]); if (at && p && q) { const u = unit(at, p), v = unit(at, q); const n = e.count ?? 1; for (let k = 0; k < n; k++) { const s = (0.12 + k * 0.035) * span2(named); const arc: V2[] = Array.from({ length: 11 }, (_, i) => { const t = i / 10; const m = unit2([u[0] * (1 - t) + v[0] * t, u[1] * (1 - t) + v[1] * t]); return [at[0] + m[0] * s, at[1] + m[1] * s] as V2; }); poly(arc); } } }
    else if (e.kind === "midpoint") { const a = P(e.of[0]), b = P(e.of[1]); if (a && b && e.id) named[e.id] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  }

  // etichete de vârf (offset mic spre afară, fără coliziuni — ca proiecția 3D)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const off = Math.max(maxX - minX, maxY - minY, 1) * 0.06;
  const anchors = Object.entries(named).filter(([, p]) => p).map(([id, p]) => ({ x: p[0], y: p[1], text: pointLabel(spec, id) })).filter((a) => a.text);
  for (const l of placeVertexLabels(anchors, cx, cy, off)) { labels.push(l); acc(l.x, l.y); }
  for (const l of labels) acc(l.x, l.y);
  if (!Number.isFinite(minX)) { minX = -1; minY = -1; maxX = 1; maxY = 1; }
  return { polylines, labels, bbox: { minX, minY, maxX, maxY }, named };
}

const unit = (a: V2, b: V2): V2 => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
const unit2 = (v: V2): V2 => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };
const span2 = (named: Record<string, V2>): number => { const xs = Object.values(named).map((p) => p[0]), ys = Object.values(named).map((p) => p[1]); return Math.max((Math.max(...xs) - Math.min(...xs)) || 1, (Math.max(...ys) - Math.min(...ys)) || 1); };
function pointLabel(spec: FigureSpec2D, id: string): string {
  const p = spec.points.find((q) => q.id === id);
  if (p && p.label !== undefined) return p.label; // etichetă explicită (poate fi "" intenționat)
  return id;
}

/** Unifică: figură 3D → proiecție; figură 2D → randare pură. */
export function renderToDrawing(spec: FigureSpec2D | FigureSpec3D, az = -35, el = 20): Drawing2D {
  return isThreeD(spec) ? projectFigure(spec, az, el) : drawSpec2D(spec);
}

// ───────────────────────── Drawing2D → SVG ─────────────────────────
const INK = "#1a1a1a";
export function toSVG(drawing: Drawing2D, size = 460): string {
  const { minX, minY, maxX, maxY } = drawing.bbox;
  const w = maxX - minX || 1, h = maxY - minY || 1, span = Math.max(w, h), pad = span * 0.14;
  const vb = `${minX - pad} ${minY - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const fs = span * 0.052;
  const lines = drawing.polylines.map((pl) =>
    `<polyline points="${pl.pts.map((p) => `${r(p[0])},${r(p[1])}`).join(" ")}" fill="none" stroke="${INK}" stroke-width="1.4" vector-effect="non-scaling-stroke" ${pl.dashed ? 'stroke-dasharray="5 4" ' : ""}stroke-linejoin="round" stroke-linecap="round"/>`,
  ).join("");
  const texts = drawing.labels.filter((l) => l.text).map((l) =>
    `<text x="${r(l.x)}" y="${r(l.y)}" font-size="${r(fs)}" fill="${INK}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic">${esc(l.text)}</text>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><rect x="${minX - pad}" y="${minY - pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" fill="white"/>${lines}${texts}</svg>`;
}
const r = (n: number) => Math.round(n * 1000) / 1000;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

export function renderSVG(spec: FigureSpec2D | FigureSpec3D, az?: number, el?: number, size?: number): string {
  return toSVG(renderToDrawing(spec, az, el), size);
}
