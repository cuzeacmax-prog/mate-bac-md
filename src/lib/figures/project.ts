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
  segments: Array<{ a: V3; b: V3 }>; // segmente libere (mereu pline)
  rounds: Round[];
}

function pyramidGeom(): Pick<Geom3D, never> { return {}; }
void pyramidGeom;

export function bodyToGeom(body: Body3D): Geom3D {
  const empty: Geom3D = { pts: [], faces: [], segments: [], rounds: [] };
  if (body.kind === "regularPyramid") {
    const s = solvePyramid(body);
    return { pts: s.verts.map((v) => ({ id: v.id, p: v.xyz, label: v.id })), faces: s.faces.map((f) => f.map((i) => s.verts[i].id)), segments: [], rounds: [] };
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
    } else if (e.kind === "segment3d") segments.push({ a: base(e.of[0]), b: base(e.of[1]) });
  }
  return { pts, faces, segments, rounds };
}

export function specToGeom(spec: FigureSpec3D): Geom3D {
  return spec.scene ? sceneToGeom(spec.scene) : bodyToGeom(spec.body!);
}

// ── Proiecție ──
export interface Polyline { pts: Array<[number, number]>; dashed: boolean }
export interface Drawing2D { polylines: Polyline[]; labels: Array<{ x: number; y: number; text: string }>; bbox: { minX: number; minY: number; maxX: number; maxY: number } }

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
  // segmente libere (mereu pline)
  for (const s of g.segments) line(proj(s.a), proj(s.b), false);

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

  // etichete: deplasate „în afară" față de centrul figurii 2D
  const cx2 = (minX + maxX) / 2, cy2 = (minY + maxY) / 2;
  for (const q of g.pts) {
    if (!q.label) continue;
    const [x, y] = proj(q.p);
    const dx = x - cx2, dy = y - cy2; const L = Math.hypot(dx, dy) || 1;
    labels.push({ x: x + (dx / L) * 12, y: y + (dy / L) * 12, text: q.label });
  }
  if (!Number.isFinite(minX)) { minX = -1; minY = -1; maxX = 1; maxY = 1; }
  return { polylines, labels, bbox: { minX, minY, maxX, maxY } };
}
