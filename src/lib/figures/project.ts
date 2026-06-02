/**
 * ETAPA 35 — Proiecție 3D → 2D pentru figuri de stereometrie (desen de manual, NU WebGL).
 *
 * Pipeline: coordonate 3D (solvers + verifyConstruction, neschimbate) → rotație (azimut, elevație) →
 * proiecție ORTOGRAFICĂ → linii 2D (vizibile pline / ascunse punctate), elipse pentru corpuri rotunde.
 * Pur (fără DOM). Randorul desenează rezultatul ca SVG curat (stil BAC).
 */
import {
  solvePyramid, solvePolyhedron, solvePerpFromVertex, solveScenePoints, inscribedSphereInCone,
  type FigureSpec3D, type Scene3D, type Vec3, type ElCone, type Body3D,
} from "./spec3d";

type V3 = Vec3;
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a: V3) => Math.hypot(a[0], a[1], a[2]) || 1;
const unit = (a: V3): V3 => { const n = nrm(a); return [a[0] / n, a[1] / n, a[2] / n]; };

// ── Geometrie 3D intermediară (independentă de spec) ──
export interface Round { type: "cone" | "cylinder" | "sphere"; center: V3; R: number; H: number }
export interface Geom3D {
  pts: Array<{ id: string; p: V3; label: string }>;
  faces: string[][];                 // pt. poliedre: fețe ca id-uri (→ muchii + back-face)
  segments: Array<{ a: V3; b: V3; dashed?: boolean; label?: string }>; // segmente libere (auxiliare)
  rounds: Round[];
  circles?: Array<{ center: V3; R: number }>; // cercuri ORIZONTALE (z=const) — ex. cerc-secțiune
  arcs?: Array<{ pts: V3[] }>;        // marcaje de unghi (arce mici, pline)
  freeLabels?: Array<{ at: V3; text: string }>; // etichete libere (lungimi, unghiuri)
}

function pyramidGeom(): Pick<Geom3D, never> { return {}; }
void pyramidGeom;

export function bodyToGeom(body: Body3D): Geom3D {
  const empty: Geom3D = { pts: [], faces: [], segments: [], rounds: [] };
  if (body.kind === "regularPyramid") {
    const s = solvePyramid(body);
    // PICTOGRAMĂ: vârful vizibil sus chiar dacă piramida e turtită (înălțimea reală rămâne în spec/verificare)
    const dispH = Math.max(body.height, 1.35 * s.circumR);
    const pts = s.verts.map((v) => (v.id === s.apexId ? { id: v.id, p: [v.xyz[0], v.xyz[1], dispH] as V3, label: v.id } : { id: v.id, p: v.xyz, label: v.id }));
    return { pts, faces: s.faces.map((f) => f.map((i) => s.verts[i].id)), segments: [], rounds: [] };
  }
  if (body.kind === "cube" || body.kind === "box" || body.kind === "prism" || body.kind === "tetrahedron" || body.kind === "frustum") {
    const s = solvePolyhedron(body);
    return { pts: s.verts.map((v) => ({ id: v.id, p: v.xyz, label: v.id })), faces: s.faces.map((f) => f.map((i) => s.verts[i].id)), segments: [], rounds: [] };
  }
  if (body.kind === "cone") return { pts: [{ id: "V", p: [0, 0, body.height], label: "V" }, { id: "O", p: [0, 0, 0], label: "O" }], faces: [], segments: [], rounds: [{ type: "cone", center: [0, 0, 0], R: body.radius, H: body.height }] };
  if (body.kind === "cylinder") return { pts: [{ id: "O", p: [0, 0, 0], label: "O" }], faces: [], segments: [], rounds: [{ type: "cylinder", center: [0, 0, 0], R: body.radius, H: body.height }] };
  if (body.kind === "sphere") return { pts: [{ id: "O", p: [0, 0, 0], label: "O" }], faces: [], segments: [], rounds: [{ type: "sphere", center: [0, 0, 0], R: body.radius, H: 0 }] };
  if (body.kind === "perpFromVertex") {
    const s = solvePerpFromVertex(body);
    const c = (id: string) => s.verts.find((v) => v.id === id)!.xyz;
    const [A, B, C] = s.baseIds;
    return {
      pts: s.verts.map((v) => ({ id: v.id, p: v.xyz, label: v.id })),
      faces: [],
      segments: [
        { a: c(A), b: c(B) }, { a: c(B), b: c(C) }, { a: c(C), b: c(A) },           // triunghi bază
        { a: c(s.apexBaseId), b: c(s.apexId) }, { a: c(s.apexBaseId), b: c(s.footId) }, { a: c(s.apexId), b: c(s.footId) }, // AM, AD, MD
      ],
      rounds: [],
    };
  }
  return empty;
}

export function sceneToGeom(scene: Scene3D): Geom3D {
  const pmap = solveScenePoints(scene);
  const pts = Object.entries(pmap).map(([id, p]) => ({ id, p, label: id }));
  const faces: string[][] = []; const segments: Geom3D["segments"] = []; const rounds: Round[] = [];
  const arcs: NonNullable<Geom3D["arcs"]> = []; const freeLabels: NonNullable<Geom3D["freeLabels"]> = [];
  const circles: NonNullable<Geom3D["circles"]> = [];
  const base = (ref?: string | V3): V3 => (Array.isArray(ref) ? ref : (typeof ref === "string" && pmap[ref]) ? pmap[ref] : [0, 0, 0]);
  for (const e of scene.elements) {
    if (e.kind === "polyhedron") faces.push(...e.faces);
    else if (e.kind === "cone3d") rounds.push({ type: "cone", center: base(e.baseCenter), R: e.radius, H: e.height });
    else if (e.kind === "cylinder3d") rounds.push({ type: "cylinder", center: base(e.baseCenter), R: e.radius, H: e.height });
    else if (e.kind === "sphere3d") rounds.push({ type: "sphere", center: base(e.center), R: e.radius, H: 0 });
    else if (e.kind === "inscribedSphere") {
      const cone = e.in ? (scene.elements.find((x) => x.kind === "cone3d" && (x as ElCone).id === e.in) as ElCone | undefined) : undefined;
      const R = cone?.radius ?? e.inCone?.radius ?? 0, H = cone?.height ?? e.inCone?.height ?? 0;
      const c = base(cone?.baseCenter ?? e.baseCenter);
      const { center, radius } = inscribedSphereInCone(R, H, c);
      rounds.push({ type: "sphere", center, R: radius, H: 0 });
    } else if (e.kind === "segment3d") {
      // eticheta segmentului o plasăm LATERAL (în proiecție), nu pe mijlocul liniei → vezi remarca „2 e pe linie"
      segments.push({ a: base(e.of[0]), b: base(e.of[1]), dashed: e.dash, label: e.label });
    } else if (e.kind === "circle3d") circles.push({ center: base(e.center), R: e.radius });
    else if (e.kind === "rightAngle3d") {
      const at = base(e.at), p = base(e.from[0]), q = base(e.from[1]);
      const u = unit(sub(p, at)), v = unit(sub(q, at));
      const s = 0.16 * Math.min(nrm(sub(p, at)), nrm(sub(q, at)));
      const k1: V3 = [at[0] + u[0] * s, at[1] + u[1] * s, at[2] + u[2] * s];
      const k3: V3 = [at[0] + (u[0] + v[0]) * s, at[1] + (u[1] + v[1]) * s, at[2] + (u[2] + v[2]) * s];
      const k2: V3 = [at[0] + v[0] * s, at[1] + v[1] * s, at[2] + v[2] * s];
      arcs.push({ pts: [k1, k3, k2] }); // pătrățel de unghi drept (poliлинie plină)
    } else if (e.kind === "label3d") freeLabels.push({ at: base(e.at), text: e.text });
    else if (e.kind === "angle3d") {
      const at = base(e.at), r0 = base(e.rays[0]), r1 = base(e.rays[1]);
      const u0 = sub(r0, at), u1 = sub(r1, at);
      const rad = 0.32 * Math.min(nrm(u0), nrm(u1));
      const d0 = unit(u0), d1 = unit(u1);
      const n = 16;
      const arc: V3[] = Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n; const m = unit([d0[0] * (1 - t) + d1[0] * t, d0[1] * (1 - t) + d1[1] * t, d0[2] * (1 - t) + d1[2] * t]);
        return [at[0] + rad * m[0], at[1] + rad * m[1], at[2] + rad * m[2]] as V3;
      });
      arcs.push({ pts: arc });
      if (e.label) { const m = unit([d0[0] + d1[0], d0[1] + d1[1], d0[2] + d1[2]]); freeLabels.push({ at: [at[0] + 1.7 * rad * m[0], at[1] + 1.7 * rad * m[1], at[2] + 1.7 * rad * m[2]], text: e.label }); }
    }
  }
  return { pts, faces, segments, rounds, circles, arcs, freeLabels };
}

export function specToGeom(spec: FigureSpec3D): Geom3D {
  return spec.scene ? sceneToGeom(spec.scene) : bodyToGeom(spec.body!);
}

// ── Proiecție ──
export interface Polyline { pts: Array<[number, number]>; dashed: boolean }
export interface LabelPos { x: number; y: number; text: string }
export interface Drawing2D { polylines: Polyline[]; labels: LabelPos[]; bbox: { minX: number; minY: number; maxX: number; maxY: number }; named?: Record<string, [number, number]>; dots?: Array<[number, number]> }

/**
 * Plasare GENERALĂ a etichetelor de vârf (folosită de randorul 3D-proiectat; 2D folosește autoPosition).
 * Eticheta = poziția 2D a vârfului + offset MIC spre AFARĂ (dinspre centroid), apoi rezolvă coliziunile.
 * `off` e proporțional cu mărimea figurii (nu px fix) → adiacent vârfului la orice scară.
 */
export function placeVertexLabels(anchors: LabelPos[], cx: number, cy: number, off: number): LabelPos[] {
  const labs = anchors.map((a) => {
    const dx = a.x - cx, dy = a.y - cy, L = Math.hypot(dx, dy) || 1;
    return { x: a.x + (dx / L) * off, y: a.y + (dy / L) * off, text: a.text };
  });
  const minD = off * 1.25;
  for (let it = 0; it < 24; it++) {
    let moved = false;
    for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) {
      const dx = labs[j].x - labs[i].x, dy = labs[j].y - labs[i].y, d = Math.hypot(dx, dy);
      if (d < minD) { const push = (minD - d) / 2 + 1e-6; const ux = d > 1e-9 ? dx / d : 1, uy = d > 1e-9 ? dy / d : 0; labs[i].x -= ux * push; labs[i].y -= uy * push; labs[j].x += ux * push; labs[j].y += uy * push; moved = true; }
    }
    if (!moved) break;
  }
  return labs;
}

function basis(azDeg: number, elDeg: number) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  const dir: V3 = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]; // spre cameră
  let right = cross([0, 0, 1], dir);
  right = nrm(right) < 1e-6 ? [1, 0, 0] : unit(right);
  const up = unit(cross(dir, right));
  return { right, up, dir };
}

export function projectFigure(spec: FigureSpec3D, azDeg: number, elDeg: number): Drawing2D {
  const g = specToGeom(spec);
  const b = basis(azDeg, elDeg);
  const proj = (p: V3): [number, number] => [dot(p, b.right), -dot(p, b.up)]; // y în jos (SVG)
  const depth = (p: V3) => dot(p, b.dir);
  const pmap = new Map(g.pts.map((q) => [q.id, q.p]));

  const polylines: Polyline[] = [];
  const labels: Drawing2D["labels"] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x: number, y: number) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  const line = (a2: [number, number], b2: [number, number], dashed: boolean) => { polylines.push({ pts: [a2, b2], dashed }); acc(...a2); acc(...b2); };

  // back-face: normala feței ≈ centroidFață − centroidCorp (poliedru convex); front dacă dot(normal, dir) > 0
  const allP = g.pts.map((q) => q.p);
  const bodyC: V3 = allP.length ? [allP.reduce((s, p) => s + p[0], 0) / allP.length, allP.reduce((s, p) => s + p[1], 0) / allP.length, allP.reduce((s, p) => s + p[2], 0) / allP.length] : [0, 0, 0];
  const faceFront = g.faces.map((f) => {
    const ps = f.map((id) => pmap.get(id)!).filter(Boolean);
    if (ps.length < 3) return true;
    const fc: V3 = [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length, ps.reduce((s, p) => s + p[2], 0) / ps.length];
    return dot(sub(fc, bodyC), b.dir) > 0;
  });
  // muchii unice → vizibilitate
  const edgeFronts = new Map<string, boolean[]>();
  g.faces.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], c = f[(i + 1) % f.length];
      const key = [a, c].sort().join("|");
      (edgeFronts.get(key) ?? edgeFronts.set(key, []).get(key)!).push(faceFront[fi]);
    }
  });
  for (const [key, fronts] of edgeFronts) {
    const [a, c] = key.split("|");
    const pa = pmap.get(a), pc = pmap.get(c);
    if (!pa || !pc) continue;
    const hidden = fronts.length > 0 && fronts.every((x) => !x);
    line(proj(pa), proj(pc), hidden);
  }
  // segmente libere (auxiliare): înălțime punctată, apotemă/înclinată pline
  const segLabels: Array<{ mid: [number, number]; perp: [number, number]; text: string }> = [];
  for (const s of g.segments) {
    const a2 = proj(s.a), b2 = proj(s.b);
    line(a2, b2, !!s.dashed);
    if (s.label) { const dx = b2[0] - a2[0], dy = b2[1] - a2[1], L = Math.hypot(dx, dy) || 1; segLabels.push({ mid: [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2], perp: [-dy / L, dx / L], text: s.label }); }
  }
  // arce de unghi (marcaje diedru) — mereu pline
  for (const ar of g.arcs ?? []) { const p2 = ar.pts.map(proj); p2.forEach((p) => acc(...p)); polylines.push({ pts: p2, dashed: false }); }

  // corpuri rotunde
  const sample = (center: V3, R: number, z: number, n = 72): V3[] => Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return [center[0] + R * Math.cos(t), center[1] + R * Math.sin(t), z] as V3; });
  const emitSplit = (samples: V3[], hiddenOf: (p: V3) => boolean, closed: boolean) => {
    // grupează în poliлинии consecutive după flag-ul ascuns
    const proj2 = samples.map(proj); proj2.forEach((p) => acc(...p));
    const flags = samples.map(hiddenOf);
    let cur: Array<[number, number]> = [proj2[0]]; let curFlag = flags[0];
    const push = () => { if (cur.length > 1) polylines.push({ pts: cur, dashed: curFlag }); };
    for (let i = 1; i < proj2.length; i++) { if (flags[i] === curFlag) cur.push(proj2[i]); else { cur.push(proj2[i]); push(); cur = [proj2[i]]; curFlag = flags[i]; } }
    if (closed) cur.push(proj2[0]);
    push();
  };
  for (const r of g.rounds) {
    if (r.type === "sphere") {
      // siluetă: cerc de rază R (proiecția ortografică a sferei e un cerc de rază R)
      const cc = proj(r.center);
      const circle: Array<[number, number]> = Array.from({ length: 73 }, (_, i) => { const t = (2 * Math.PI * i) / 72; return [cc[0] + r.R * Math.cos(t), cc[1] + r.R * Math.sin(t)] as [number, number]; });
      circle.forEach((p) => acc(...p));
      polylines.push({ pts: circle, dashed: false });
    } else {
      const baseZ = r.center[2];
      const topZ = baseZ + r.H;
      const baseS = sample(r.center, r.R, baseZ);
      const cBaseDepth = depth([r.center[0], r.center[1], baseZ]);
      emitSplit(baseS, (p) => depth(p) < cBaseDepth, true); // rim spate (mai departe) = punctat
      if (r.type === "cylinder") {
        const topS = sample(r.center, r.R, topZ);
        const cTopDepth = depth([r.center[0], r.center[1], topZ]);
        emitSplit(topS, (p) => depth(p) < cTopDepth, true);
        // generatoare de contur: punctele extreme pe x-ecran ale bazei → corespondente pe top
        const px = baseS.map(proj);
        const iMin = px.reduce((m, p, i) => (p[0] < px[m][0] ? i : m), 0);
        const iMax = px.reduce((m, p, i) => (p[0] > px[m][0] ? i : m), 0);
        line(proj(baseS[iMin]), proj(topS[iMin]), false);
        line(proj(baseS[iMax]), proj(topS[iMax]), false);
      } else { // con
        const apex: V3 = [r.center[0], r.center[1], topZ];
        const px = baseS.map(proj);
        const iMin = px.reduce((m, p, i) => (p[0] < px[m][0] ? i : m), 0);
        const iMax = px.reduce((m, p, i) => (p[0] > px[m][0] ? i : m), 0);
        line(proj(apex), proj(baseS[iMin]), false);
        line(proj(apex), proj(baseS[iMax]), false);
      }
    }
  }

  // cercuri orizontale (cerc-secțiune): rim front plin / spate punctat (ca baza conului)
  for (const c of g.circles ?? []) {
    const s = sample(c.center, c.R, c.center[2]);
    const cDepth = depth(c.center);
    emitSplit(s, (p) => depth(p) < cDepth, true);
  }

  // etichete: lângă vârful PROIECTAT, offset mic spre afară (proporțional cu figura), fără coliziuni
  if (!Number.isFinite(minX)) { minX = -1; minY = -1; maxX = 1; maxY = 1; }
  const cx2 = (minX + maxX) / 2, cy2 = (minY + maxY) / 2;
  const off = Math.max(maxX - minX, maxY - minY, 1) * 0.06;
  const anchors: LabelPos[] = g.pts.filter((q) => q.label).map((q) => { const [x, y] = proj(q.p); return { x, y, text: q.label }; });
  const placed = placeVertexLabels(anchors, cx2, cy2, off);
  labels.push(...placed);
  for (const l of placed) acc(l.x, l.y); // bbox include etichetele → nu se taie din cadru
  // etichete libere (lungimi/unghiuri auxiliare): poziție 3D proiectată, fără re-poziționare
  for (const fl of g.freeLabels ?? []) { const [x, y] = proj(fl.at); labels.push({ x, y, text: fl.text }); acc(x, y); }
  // etichete de segment: LATERAL față de linie (perpendicular), spre exterior (departe de centru) — nu pe linie
  for (const sl of segLabels) {
    const toC = [sl.mid[0] - cx2, sl.mid[1] - cy2];
    const sign = (sl.perp[0] * toC[0] + sl.perp[1] * toC[1]) >= 0 ? 1 : -1; // partea dinspre exterior
    const x = sl.mid[0] + sign * sl.perp[0] * off, y = sl.mid[1] + sign * sl.perp[1] * off;
    labels.push({ x, y, text: sl.text }); acc(x, y);
  }
  const named: Record<string, [number, number]> = {};
  for (const q of g.pts) named[q.id] = proj(q.p);
  // punctișor la fiecare vârf etichetat (centrul bazei/secțiunii nu mai „plutește" fără reper)
  const dots: Array<[number, number]> = g.pts.filter((q) => q.label).map((q) => proj(q.p));
  return { polylines, labels, bbox: { minX, minY, maxX, maxY }, named, dots };
}
