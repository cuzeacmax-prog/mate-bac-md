/**
 * ETAPA 45 — BUCLA DE AUTORAT (supervizat). (condiție + desen DORIT) → CAS + porți → spec generat + verdict.
 *
 * Buclă de întărire: adevăr-de-referință pe set REPREZENTATIV → motorul generează + porți. Potrivirile se
 * bancă; nepotrivirile arată un gol GENERAL → reparăm MOTORUL, nu cazul. Porțile fac ca la scară să fie
 * corect-sau-respins (niciodată greșit); omul revizuiește doar bootstrap-ul + sondaj. Pur (fără DOM/DB/rețea).
 *
 * Pipeline (tot ce-am construit): CAS → porți numerice (invariante ETAPA 34 + reproduce numerele ETAPA 41)
 * → randare → poarta vizuală (ETAPA 44) comparată cu DESENUL DORIT (structurat). Nepotrivire → marchează pt. om.
 */
import type { FigureSpec2D } from "./spec";
import type { FigureSpec3D, Scene3D } from "./spec3d";
import { solveAndVerify, solveAndVerify3D, type GeoProblem, type GeoProblem3D } from "./cas";
import { coneSectionScene, verifyConeSection, type ConeCut } from "./relations";
import { verifyConstruction } from "./verify";
import { renderToDrawing, renderSVG } from "./render-svg";
import { structuredVisualChecks, type VisualCheck } from "./visual-gate";

/** Intrarea de pipeline = ce produce extractorul (ZERO coordonate). În bootstrap = adevăr-de-referință. */
export type PipelineInput =
  | { kind: "coneCut"; cone: { radius: number; height: number }; by: ConeCut }
  | { kind: "geo"; problem: GeoProblem }
  | { kind: "geo3d"; problem: GeoProblem3D }
  | { kind: "spec2d"; spec: FigureSpec2D }
  | { kind: "scene"; scene: Scene3D };

/** Descrierea structurată a DESENULUI DORIT (ținta concretă de comparat cu randarea). */
export interface DesiredDescriptor {
  dim?: "2D" | "3D";
  orientation?: "apex-sus";
  mustLabels?: string[];   // etichete care TREBUIE să apară (ex. V, O, „2")
  minPolylines?: number;   // complexitate minimă (ex. con + cerc-secțiune ⇒ multe linii)
}

export interface Remark { x: number; y: number; text: string }
export interface Remarks { text?: string; pins?: Remark[] }

export interface AuthorCase {
  slug: string;
  condition: string;
  desired: { kind: "image"; ref: string } | { kind: "description"; ref: string };
  desiredDescriptor?: DesiredDescriptor;
  input: PipelineInput;
  /** Remarci umane de la o rundă anterioară (text + pini localizați) — alimentează corecția. */
  remarks?: Remarks;
}

export interface GateBlock { ok: boolean; checks: Array<{ id?: string; name?: string; pass: boolean; detail: string }> }
export interface AuthorResult {
  slug: string;
  spec: FigureSpec2D | FigureSpec3D | null;
  svg: string | null;
  gates: { numeric: GateBlock; visual: GateBlock; desiredMatch: GateBlock };
  status: "auto-acceptat" | "marcat-uman";
  iteratii: number;
  reason?: string;
  /** Remarcile considerate în această rundă (din runda anterioară). Recurente = gol GENERAL → reparăm motorul. */
  remarksConsidered?: string[];
}

const is3D = (s: FigureSpec2D | FigureSpec3D): s is FigureSpec3D => "scene" in s || "body" in s;

/** Construiește specul din intrare + rulează porțile NUMERICE (CAS + invariante). */
function buildAndVerifyNumeric(input: PipelineInput): { spec: FigureSpec2D | FigureSpec3D | null; numeric: GateBlock; reason?: string } {
  const numeric: GateBlock = { ok: false, checks: [] };
  try {
    if (input.kind === "coneCut") {
      const scene = coneSectionScene(input.cone.radius, input.cone.height, input.by);
      if (!scene) return { spec: null, numeric: { ok: false, checks: [{ name: "coneSection", pass: false, detail: "con/secțiune invalidă" }] }, reason: "con invalid" };
      // poziția axială canonică pe care secțiunea TREBUIE s-o reproducă (numărul din enunț):
      const R = input.cone.radius, H = input.cone.height;
      const expectAxial = input.by.rel === "distanceApexToParallelPlane" ? input.by.value : (input.by.value * H) / Math.hypot(R, H);
      const v = verifyConeSection(R, H, input.by, { axial: expectAxial, radius: (R * expectAxial) / H });
      const inv = verifyConstruction({ scene } as FigureSpec3D);
      numeric.checks = [...v.checks, ...inv.checks];
      numeric.ok = v.ok && inv.ok;
      return { spec: { scene }, numeric };
    }
    if (input.kind === "geo") {
      const res = solveAndVerify(input.problem);
      numeric.checks = res.checks; numeric.ok = res.accepted;
      return { spec: res.spec ?? null, numeric, reason: res.accepted ? undefined : res.reason };
    }
    if (input.kind === "geo3d") {
      const res = solveAndVerify3D(input.problem);
      numeric.checks = res.checks; numeric.ok = res.accepted;
      return { spec: res.spec ?? null, numeric, reason: res.accepted ? undefined : res.reason };
    }
    const spec = input.kind === "spec2d" ? input.spec : ({ scene: input.scene } as FigureSpec3D);
    const inv = verifyConstruction(spec);
    numeric.checks = inv.checks; numeric.ok = inv.ok;
    return { spec, numeric, reason: inv.ok ? undefined : "invariante picate" };
  } catch (e) {
    return { spec: null, numeric: { ok: false, checks: [{ name: "build", pass: false, detail: (e as Error).message }] }, reason: (e as Error).message };
  }
}

/** Poarta vizuală + COMPARAȚIA cu desenul DORIT (orientare, etichete, complexitate se potrivesc cu referința). */
function visualAndDesired(spec: FigureSpec2D | FigureSpec3D, want?: DesiredDescriptor): { visual: GateBlock; desiredMatch: GateBlock } {
  const drawing = renderToDrawing(spec);
  const vc = structuredVisualChecks(spec, drawing);
  const visual: GateBlock = { ok: vc.ok, checks: vc.checks.map((c: VisualCheck) => ({ id: c.id, pass: c.pass, detail: c.detail })) };

  const dm: GateBlock = { ok: true, checks: [] };
  if (want) {
    if (want.dim) { const got = is3D(spec) ? "3D" : "2D"; dm.checks.push({ name: `dimensiune = ${want.dim}`, pass: got === want.dim, detail: `randat ${got}` }); }
    if (want.orientation === "apex-sus") {
      const orient = vc.checks.find((c) => c.id === "orientation");
      dm.checks.push({ name: "orientare apex-sus (ca doritul)", pass: orient ? orient.pass : true, detail: orient?.detail ?? "n/a" });
    }
    if (want.mustLabels?.length) {
      const labs = new Set(drawing.labels.map((l) => l.text));
      const missing = want.mustLabels.filter((t) => !labs.has(t));
      dm.checks.push({ name: `etichete dorite prezente: ${want.mustLabels.join(",")}`, pass: missing.length === 0, detail: missing.length ? `lipsesc: ${missing.join(",")}` : "toate" });
    }
    if (want.minPolylines != null) dm.checks.push({ name: `complexitate ≥ ${want.minPolylines} linii`, pass: drawing.polylines.length >= want.minPolylines, detail: `${drawing.polylines.length} linii` });
    dm.ok = dm.checks.every((c) => c.pass);
  }
  return { visual, desiredMatch: dm };
}

/**
 * Rulează pipeline-ul de autorat pe un caz. Bucla (max `maxIter`) e hook-ul de auto-corecție: în bootstrap
 * intrarea e adevăr-de-referință (trece din prima); când extractorul live greșește, aici se reîncearcă.
 */
export function runAuthoring(c: AuthorCase, maxIter = 3): AuthorResult {
  const considered = remarksToList(c.remarks);
  let iteratii = 0;
  let last: AuthorResult | null = null;
  while (iteratii < maxIter) {
    iteratii++;
    const { spec, numeric, reason } = buildAndVerifyNumeric(c.input);
    if (!spec || !numeric.ok) {
      last = { slug: c.slug, spec, svg: spec ? safeSvg(spec) : null, gates: { numeric, visual: { ok: false, checks: [] }, desiredMatch: { ok: false, checks: [] } }, status: "marcat-uman", iteratii, reason: reason ?? "porți numerice picate", remarksConsidered: considered };
      break; // intrare fixă în bootstrap → nu are sens reîncercarea fără re-extracție
    }
    const { visual, desiredMatch } = visualAndDesired(spec, c.desiredDescriptor);
    const ok = numeric.ok && visual.ok && desiredMatch.ok;
    last = { slug: c.slug, spec, svg: safeSvg(spec), gates: { numeric, visual, desiredMatch }, status: ok ? "auto-acceptat" : "marcat-uman", iteratii, reason: ok ? undefined : "nepotrivire vizuală / cu doritul", remarksConsidered: considered };
    if (ok) break;
    break; // fără re-extracție live, o iterație e definitivă pentru bootstrap
  }
  return last!;
}

/** Remarcile (text + pini) ca listă lizibilă — intră în raport și sunt luate în considerare la corecție. */
function remarksToList(r?: Remarks): string[] {
  if (!r) return [];
  const out: string[] = [];
  if (r.text) out.push(r.text);
  for (const p of r.pins ?? []) out.push(`@(${Math.round(p.x)},${Math.round(p.y)}) ${p.text}`);
  return out;
}

function safeSvg(spec: FigureSpec2D | FigureSpec3D): string | null { try { return renderSVG(spec); } catch { return null; } }
