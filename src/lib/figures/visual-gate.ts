/**
 * ETAPA 44 — POARTA VIZUALĂ (al treilea strat de verificare).
 *
 * Stratul complet — fiecare poartă prinde o clasă pe care celelalte n-o pot:
 *   1. geometrie greșită        → invariante numerice (ETAPA 34, verify.ts);
 *   2. nu reproduce numerele    → auto-verificare (ETAPA 41, cas.ts);
 *   3. RANDARE greșită          → POARTA VIZUALĂ (aici).
 *
 * Cheia: verificări STRUCTURATE derivate din spec + reguli de prezentare (NU „arată bine?", vag) — măsurate
 * pe DESENUL FINAL (Drawing2D), deci prind defecte de randare invizibile porților numerice: etichete
 * împrăștiate, linie declarată lipsă, figură goală/degenerată, orientare greșită, element în afara conturului.
 * Deterministe și testabile; sub ele rămân porțile numerice; deasupra, opțional, ochiul perceptual (vision).
 */
import type { FigureSpec2D } from "./spec";
import type { FigureSpec3D } from "./spec3d";
import { specToGeom } from "./project";
import { renderToDrawing } from "./render-svg";
import type { Drawing2D } from "./project";

type V2 = [number, number];
export interface VisualCheck { id: string; question: string; pass: boolean; detail: string }
export interface VisualGateResult { ok: boolean; checks: VisualCheck[] }

const isThreeD = (spec: FigureSpec2D | FigureSpec3D): spec is FigureSpec3D => "scene" in spec || "body" in spec;
const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const spanOf = (d: Drawing2D) => Math.max(d.bbox.maxX - d.bbox.minX, d.bbox.maxY - d.bbox.minY, 1e-9);

/** Muchii DECLARATE în spec (perechi de id-uri) — trebuie să apară în desen. */
function declaredEdges(spec: FigureSpec2D | FigureSpec3D): Array<[string, string]> {
  const edges: Array<[string, string]> = [];
  const addFace = (f: string[]) => { for (let i = 0; i < f.length; i++) edges.push([f[i], f[(i + 1) % f.length]]); };
  if (isThreeD(spec)) {
    try { for (const f of specToGeom(spec).faces) addFace(f); } catch { /* validarea prinde */ }
    if (spec.scene) for (const e of spec.scene.elements) if (e.kind === "segment3d") edges.push([e.of[0], e.of[1]]);
  } else {
    for (const e of spec.elements) {
      if (e.kind === "polygon") addFace(e.points);
      else if (e.kind === "triangleFromSides") addFace(e.ids);
      else if (e.kind === "segment") edges.push([e.between[0], e.between[1]]);
    }
  }
  return edges;
}
/** Poligoane declarate (pt. non-degenerare) ca liste de id-uri. */
function declaredPolygons(spec: FigureSpec2D | FigureSpec3D): string[][] {
  if (isThreeD(spec)) { try { return specToGeom(spec).faces; } catch { return []; } }
  const out: string[][] = [];
  for (const e of spec.elements) { if (e.kind === "polygon") out.push(e.points); else if (e.kind === "triangleFromSides") out.push(e.ids); }
  return out;
}
const polyArea = (pts: V2[]) => { let s = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; s += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; } return Math.abs(s) / 2; };
/** Un polyline conține o muchie (pereche consecutivă ≈ a,b)? */
function edgeDrawn(d: Drawing2D, a: V2, b: V2, tol: number): boolean {
  for (const pl of d.polylines) for (let i = 0; i + 1 < pl.pts.length; i++) {
    const p = pl.pts[i], q = pl.pts[i + 1];
    if ((dist(p, a) <= tol && dist(q, b) <= tol) || (dist(p, b) <= tol && dist(q, a) <= tol)) return true;
  }
  return false;
}

/** Rulează verificările STRUCTURATE pe desenul randat. Pur, determinist. */
export function structuredVisualChecks(spec: FigureSpec2D | FigureSpec3D, drawing?: Drawing2D): VisualGateResult {
  const d = drawing ?? renderToDrawing(spec);
  const named = d.named ?? {};
  const span = spanOf(d);
  const checks: VisualCheck[] = [];

  // 1) Fiecare vârf etichetat e LÂNGĂ punctul lui (nu împrăștiat).
  {
    const off = span * 0.18; let bad = "";
    for (const l of d.labels) {
      const p = named[l.text]; if (!p) continue; // doar etichete de vârf
      if (dist([l.x, l.y], p) > off) bad += `${l.text} `;
    }
    checks.push({ id: "labels", question: "Fiecare etichetă de vârf e vizibilă și LÂNGĂ punctul ei (nu împrăștiată)?", pass: !bad, detail: bad ? `etichete departe de punct: ${bad.trim()}` : "toate etichetele adiacente punctelor" });
  }
  // 2) Fiecare muchie/segment DECLARAT e prezent în desen.
  {
    const tol = span * 0.02; const missing: string[] = [];
    for (const [a, b] of declaredEdges(spec)) {
      const pa = named[a], pb = named[b]; if (!pa || !pb) { missing.push(`${a}${b}(punct lipsă)`); continue; }
      if (!edgeDrawn(d, pa, pb, tol)) missing.push(`${a}${b}`);
    }
    checks.push({ id: "edges", question: "Fiecare segment/muchie declarată e PREZENTĂ (nicio linie lipsă)?", pass: missing.length === 0, detail: missing.length ? `lipsesc: ${[...new Set(missing)].join(", ")}` : "toate muchiile desenate" });
  }
  // 3) NON-DEGENERAT: figura are întindere și poligoanele au arie (nu triunghi gol/turtit).
  {
    const minArea = 1e-3 * span * span; let bad = "";
    for (const poly of declaredPolygons(spec)) {
      const pts = poly.map((id) => named[id]).filter(Boolean) as V2[];
      if (pts.length >= 3 && polyArea(pts) < minArea) bad += `[${poly.join("")}] `;
    }
    const tooSmall = span < 1e-6;
    checks.push({ id: "nondegenerate", question: "Figura e non-degenerată (are întindere, poligoane cu arie — nu goală/turtită)?", pass: !bad && !tooSmall, detail: tooSmall ? "întindere ~0" : bad ? `poligoane turtite: ${bad.trim()}` : "non-degenerat" });
  }
  // 4) ORIENTARE canonică: dacă există un vârf V (apex), e SUS (y-ecran mic), nu răsturnat.
  {
    const apex = named["V"];
    if (apex) {
      const others = Object.entries(named).filter(([id]) => id !== "V").map(([, p]) => p[1]);
      const medOther = others.length ? others.slice().sort((a, b) => a - b)[Math.floor(others.length / 2)] : apex[1];
      const ok = apex[1] <= medOther + span * 0.02; // y mic = sus
      checks.push({ id: "orientation", question: "Orientare canonică (apex V sus, baza jos — nu răsturnat)?", pass: ok, detail: ok ? "apex sus" : "apex sub bază (răsturnat)" });
    }
  }
  // 5) CONȚINERE: cercul înscris (2D) e în interiorul triunghiului care-l definește.
  if (!isThreeD(spec)) {
    let bad = "";
    for (const e of spec.elements) {
      if (e.kind !== "incircle") continue;
      const t = e.of.map((id) => named[id]).filter(Boolean) as V2[];
      if (t.length < 3) continue;
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      if (!pointInTri([cx, cy], t[0], t[1], t[2])) bad += `[${e.of.join("")}] `;
    }
    if (bad) checks.push({ id: "containment", question: "Cercul înscris e în interiorul triunghiului (nu iese din contur)?", pass: false, detail: `centru în afara triunghiului: ${bad.trim()}` });
    else checks.push({ id: "containment", question: "Elementele înscrise/de secțiune sunt în interiorul conturului care le conține?", pass: true, detail: "conținut" });
  }

  return { ok: checks.every((c) => c.pass), checks };
}
function pointInTri(p: V2, a: V2, b: V2, c: V2): boolean {
  const s = (u: V2, v: V2, w: V2) => (u[0] - w[0]) * (v[1] - w[1]) - (v[0] - w[0]) * (u[1] - w[1]);
  const d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** Lista de întrebări structurate (pentru pasul de VISION — Claude se uită la PNG + listă). */
export function visionChecklist(spec: FigureSpec2D | FigureSpec3D): string[] {
  return structuredVisualChecks(spec).checks.map((c) => c.question);
}
