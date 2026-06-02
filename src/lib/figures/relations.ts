/**
 * ETAPA 42 — STRAT DE DEFINIȚII GEOMETRICE TIPIZATE.
 *
 * Esența: un termen metric NU e o instrucțiune liberă, ci o mărime DEFINITĂ de obiectele pe care le leagă.
 * „Distanța" e o FAMILIE determinată de tipuri — obiectele impun metrica, AI-ul NU o alege:
 *   distanță(punct, punct) = segment;
 *   distanță(punct, dreaptă) = perpendiculara (piciorul);
 *   distanță(punct, plan)   = perpendiculara (piciorul pe plan).
 * „la lungimea d pe o dreaptă/muchie/generatoare" = lungimePeDreaptă — RELAȚIE DISTINCTĂ, NU distanță.
 *
 * Cauza bug-ului (con): AI-ul a tratat „distanța de la vârf la plan" ca parametru liber și a ales o
 * construcție comodă greșită (punct pe generatoare). Fix conceptual: relația se rezolvă la definiția
 * CANONICĂ după semnătura de tipuri; operatorii (secțiune) PĂSTREAZĂ definiția la transformare. Pur (fără DOM).
 */
import type { Vec3, Scene3D, Point3DSpec, SceneElement } from "./spec3d";
import type { FigureSpec2D, FigureElement, FigurePoint } from "./spec";

// ───────────────────────── obiecte tipizate ─────────────────────────
export type GeoType = "point" | "line" | "segment" | "circle" | "plane" | "body";
export interface OPoint { type: "point"; id?: string; at: Vec3 }
export interface OLine { type: "line"; id?: string; through: [Vec3, Vec3] }
export interface OSegment { type: "segment"; id?: string; ends: [Vec3, Vec3] }
export interface OPlane { type: "plane"; id?: string; point: Vec3; normal: Vec3 }
export interface OCircle { type: "circle"; id?: string; center: Vec3; normal: Vec3; radius: number }
export interface OBody { type: "body"; id?: string; kind: string }
export type GeoObject = OPoint | OLine | OSegment | OPlane | OCircle | OBody;

// ───────────────────────── vectori ─────────────────────────
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]) || 1;
const unit = (a: Vec3): Vec3 => mul(a, 1 / nrm(a));
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ───────────────────────── metrica canonică (DISTANȚA = familie după tipuri) ─────────────────────────
export interface ResolvedMetric { ok: boolean; canonical: string; value?: number; foot?: Vec3; error?: string }

const footOnLine = (P: Vec3, a: Vec3, b: Vec3): Vec3 => { const d = sub(b, a); const t = dot(sub(P, a), d) / (dot(d, d) || 1); return add(a, mul(d, t)); };
const footOnPlane = (P: Vec3, plane: OPlane): Vec3 => { const n = unit(plane.normal); const s = dot(sub(P, plane.point), n); return sub(P, mul(n, s)); };

/**
 * DISTANȚA tipizată: rezolvată EXCLUSIV de semnătura de tipuri (punct–punct/dreaptă/segment/plan).
 * Obiectele determină metrica; nu există parametru liber. Semnătură nesuportată → ok:false (NU ghici).
 */
export function distance(a: GeoObject, b: GeoObject): ResolvedMetric {
  const pair = (ta: GeoType, tb: GeoType) => (a.type === ta && b.type === tb) || (a.type === tb && b.type === ta);
  const P = (a.type === "point" ? a : b) as OPoint;
  if (pair("point", "point")) {
    const q = (a.type === "point" && b.type === "point") ? (b as OPoint) : (a as OPoint);
    const p = a as OPoint;
    return { ok: true, canonical: "segment (punct–punct)", value: dist(p.at, q.at) };
  }
  if (pair("point", "line")) {
    const L = (a.type === "line" ? a : b) as OLine; const f = footOnLine(P.at, L.through[0], L.through[1]);
    return { ok: true, canonical: "perpendiculara (punct–dreaptă)", value: dist(P.at, f), foot: f };
  }
  if (pair("point", "segment")) {
    const S = (a.type === "segment" ? a : b) as OSegment; const f = footOnLine(P.at, S.ends[0], S.ends[1]);
    return { ok: true, canonical: "perpendiculara pe dreapta-suport (punct–segment)", value: dist(P.at, f), foot: f };
  }
  if (pair("point", "plane")) {
    const PL = (a.type === "plane" ? a : b) as OPlane; const f = footOnPlane(P.at, PL);
    return { ok: true, canonical: "perpendiculara (punct–plan)", value: dist(P.at, f), foot: f };
  }
  return { ok: false, canonical: "—", error: `distanță nedefinită pentru tipurile (${a.type}, ${b.type})` };
}

/** lungimePeDreaptă: RELAȚIE DISTINCTĂ — punct la lungimea `d` de la `from`, PE direcția dreptei/muchiei. */
export function pointAlong(line: OLine | OSegment, from: Vec3, d: number): { at: Vec3; canonical: string } {
  const ends = line.type === "line" ? line.through : line.ends;
  const dir = unit(sub(ends[1], ends[0]));
  return { at: add(from, mul(dir, d)), canonical: "lungimePeDreaptă (punct la lungimea d pe dreaptă/muchie)" };
}

/** Unghi dreaptă–plan = complementul unghiului dintre direcția dreptei și normala planului (definiție canonică). */
export function angleLinePlane(line: OLine, plane: OPlane): { value: number; canonical: string } {
  const d = unit(sub(line.through[1], line.through[0])); const n = unit(plane.normal);
  const sinAng = Math.abs(dot(d, n)); // = cos(unghi(d, plan-normală)) = sin(unghi dreaptă–plan)
  return { value: (Math.asin(Math.max(-1, Math.min(1, sinAng))) * 180) / Math.PI, canonical: "unghi dreaptă–plan = 90°−∠(dreaptă, normală)" };
}

/** Proiecția (canonică) a unui punct pe dreaptă/plan = piciorul perpendicularei. */
export function projection(P: OPoint, onto: OLine | OPlane): { at: Vec3; canonical: string } {
  if (onto.type === "line") return { at: footOnLine(P.at, onto.through[0], onto.through[1]), canonical: "proiecție pe dreaptă = piciorul perpendicularei" };
  return { at: footOnPlane(P.at, onto), canonical: "proiecție pe plan = piciorul perpendicularei" };
}

// ───────────────────────── operatori care PĂSTREAZĂ definiția (secțiune con) ─────────────────────────
/** Cum e tăiat conul — TIPIZAT după relația enunțată (NU o alegere comodă). */
export type ConeCut =
  | { rel: "distanceApexToParallelPlane"; value: number }      // distanță(vârf, plan ∥ bază) = perpendiculara
  | { rel: "lengthAlongGeneratrixFromApex"; value: number };   // lungimePeDreaptă pe generatoare, de la vârf

export interface ConeSection { ok: boolean; canonical: string; axialFromApex: number; radius: number; area: number; error?: string }

/**
 * Secțiunea conului (R, H) printr-un plan ∥ bază, poziționat după o relație TIPIZATĂ. Operatorul
 * realizează poziția pe axă DERIVÂND-O din metrica canonică pe coordonate reale (nu o formulă liberă):
 *   - distanță(vârf, plan) = perpendiculara → poziția axială = chiar distanța;
 *   - lungimePeDreaptă pe generatoare → poziția axială = proiecția pe axă a punctului (≠ lungimea pe muchie).
 */
export function coneSection(R: number, H: number, cut: ConeCut): ConeSection {
  if (!(R > 0) || !(H > 0)) return { ok: false, canonical: "—", axialFromApex: NaN, radius: NaN, area: NaN, error: `con invalid (R=${R}, H=${H})` };
  const apex: Vec3 = [0, 0, H], rim: Vec3 = [R, 0, 0];           // vârf sus, generatoare apex→rim
  const generatrix: OLine = { type: "line", through: [apex, rim] };
  let axialFromApex: number; let canonical: string;
  if (cut.rel === "distanceApexToParallelPlane") {
    // planul ∥ bază la distanța (perpendiculara) `value` de vârf
    const plane: OPlane = { type: "plane", point: [0, 0, H - cut.value], normal: [0, 0, 1] };
    const m = distance({ type: "point", at: apex }, plane);   // perpendiculara, prin metrica tipizată
    axialFromApex = m.value!; canonical = `secțiune: ${m.canonical}`;
  } else {
    // punct pe generatoare la lungimea `value` de vârf → poziția axială = proiecția pe axă (perpendiculara la plan ∥ bază)
    const P = pointAlong(generatrix, apex, cut.value).at;
    const planeThroughP: OPlane = { type: "plane", point: P, normal: [0, 0, 1] };
    const m = distance({ type: "point", at: apex }, planeThroughP);
    axialFromApex = m.value!; canonical = `secțiune: lungimePeDreaptă → ${m.canonical} pe axă`;
  }
  const radius = (R * axialFromApex) / H;   // raze similare
  return { ok: true, canonical, axialFromApex, radius, area: Math.PI * radius * radius };
}

/** Figura 2D (secțiune axială) a conului + coarda secțiunii la poziția canonică — puncte EXPLICITE. */
export function coneSectionFigure(R: number, H: number, cut: ConeCut): FigureSpec2D | null {
  const sec = coneSection(R, H, cut);
  if (!sec.ok) return null;
  const a = sec.axialFromApex, r = sec.radius, yChord = H - a;
  const points: FigurePoint[] = [
    { id: "V", x: 0, y: H, label: "V" }, { id: "B", x: -R, y: 0, label: "B" }, { id: "C", x: R, y: 0, label: "C" },
    { id: "M", x: -r, y: yChord, label: "M" }, { id: "N", x: r, y: yChord, label: "N" }, { id: "F", x: 0, y: yChord, label: "" },
  ];
  const elements: FigureElement[] = [
    { kind: "polygon", points: ["V", "B", "C"] },
    { kind: "segment", between: ["M", "N"], label: "MN" },
    { kind: "segment", between: ["V", "F"], label: `${Math.round(a * 1000) / 1000}` },
    { kind: "rightAngle", at: "F", from: ["V", "N"] },
  ];
  return { points, elements };
}

/**
 * PICTOGRAMA 3D (ETAPA 43): conul ca CORP 3D + planul ∥ bază (cercul-secțiune) la poziția canonică +
 * vârful + perpendiculara vârf→secțiune. NU un triunghi 2D gol — obiectul rămâne 3D.
 */
export function coneSectionScene(R: number, H: number, cut: ConeCut): Scene3D | null {
  const sec = coneSection(R, H, cut);
  if (!sec.ok) return null;
  const a = sec.axialFromApex, r = sec.radius;
  const points: Point3DSpec[] = [
    { id: "V", x: 0, y: 0, z: H }, // vârful
    { id: "O", x: 0, y: 0, z: 0 }, // centrul bazei
    { id: "S", x: 0, y: 0, z: H - a }, // centrul secțiunii
  ];
  const elements: SceneElement[] = [
    { kind: "cone3d", id: "con", radius: R, height: H },
    { kind: "circle3d", center: "S", radius: r },                                  // cercul de secțiune (plan ∥ bază)
    // AXA completă (punctată) vârf→centru bază, prin centrul secțiunii — ca în desenul DORIT
    { kind: "segment3d", of: ["V", "S"], dash: true, label: `${Math.round(a * 1000) / 1000}` }, // porțiunea = distanța dată
    { kind: "segment3d", of: ["S", "O"], dash: true },                              // continuarea axei până la baza
  ];
  return { points, elements };
}

/**
 * PICTOGRAMĂ SCHEMATICĂ piramidă pe trapez isoscel (bază mare AB în față, bază mică DC în spate, vârf V sus).
 * NU e la scară (proporțiile bazelor se păstrează; adâncimea + înălțimea sunt de afișare) — convenția de manual
 * pentru un corp cu bază aproape plană. Numerele reale se verifică separat (CAS), figura doar ilustrează.
 */
export function pyramidTrapezoidScene(smallBase: number, bigBase: number): Scene3D {
  const halfBig = 4, halfSmall = 4 * (smallBase / bigBase); // lățime de afișare ∝ raport baze
  const depth = 3.4, height = 8; // valori de afișare (pictogramă)
  const points: Point3DSpec[] = [
    { id: "A", x: -halfBig, y: 0, z: 0 }, { id: "B", x: halfBig, y: 0, z: 0 },   // baza MARE, în față
    { id: "C", x: halfSmall, y: depth, z: 0 }, { id: "D", x: -halfSmall, y: depth, z: 0 }, // baza mică, în spate
    { id: "O", x: 0, y: depth / 2, z: 0 }, { id: "V", x: 0, y: depth / 2, z: height },
  ];
  const elements: SceneElement[] = [
    { kind: "polyhedron", vertices: ["A", "B", "C", "D", "V"], faces: [["A", "B", "C", "D"], ["V", "A", "B"], ["V", "B", "C"], ["V", "C", "D"], ["V", "D", "A"]] },
    { kind: "segment3d", of: ["V", "O"], dash: true, label: "H" },
  ];
  return { points, elements };
}

/** Plasă de siguranță (ETAPA 41): recompune secțiunea din coordonate și verifică numerele DATE. */
export function verifyConeSection(R: number, H: number, cut: ConeCut, expect: { axial?: number; radius?: number; area?: number }, tol = 1e-9): { ok: boolean; checks: Array<{ name: string; pass: boolean; detail: string }> } {
  const sec = coneSection(R, H, cut);
  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
  const eq = (x: number, y: number) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));
  if (expect.axial != null) checks.push({ name: `poziție axială = ${expect.axial}`, pass: eq(sec.axialFromApex, expect.axial), detail: `calculat ${sec.axialFromApex.toFixed(6)}` });
  if (expect.radius != null) checks.push({ name: `rază secțiune = ${expect.radius}`, pass: eq(sec.radius, expect.radius), detail: `calculat ${sec.radius.toFixed(6)}` });
  if (expect.area != null) checks.push({ name: `arie secțiune = ${expect.area}`, pass: eq(sec.area, expect.area), detail: `calculat ${sec.area.toFixed(6)}` });
  return { ok: checks.every((c) => c.pass), checks };
}
