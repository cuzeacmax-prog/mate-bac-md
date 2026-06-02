/**
 * ETAPA 52 — EXTRAGEREA TIPURILOR DE RELAȚIE/OBIECT din ce a extras CAS-ul (NU din exercise_concept_link).
 *
 * Construcția se declanșează din STRUCTURA extrasă: tipul de obiect (body.kind / solid / elemente de scenă) și
 * tipul de relație (givens: diedru/unghi; build: mijloc/picior; secțiuni; con+plan paralel). Aceste tipuri sunt
 * cheile tiparelor din construction-patterns.ts. Returnăm setul de triggere (deduplicat).
 */
import type { PipelineInput } from "./authoring";
import type { GeoProblem3D, Given3D, BuildStep3D } from "./cas";
import type { Body3D, Scene3D } from "./spec3d";
import type { FigureSpec2D } from "./spec";

function objectOf(body: Body3D): string | null {
  switch (body.kind) {
    case "regularPyramid": case "tetrahedron": return "obj:pyramid-regular";
    case "prism": return "obj:prism-regular";
    case "box": case "cube": return "obj:cuboid";
    case "cone": return "obj:cone";
    case "cylinder": return "obj:cylinder";
    case "sphere": return "obj:sphere";
    case "frustum": return "obj:frustum";
    default: return null;
  }
}

function fromBuild(steps: BuildStep3D[]): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (s.op === "box") out.push("obj:cuboid");
    else if (s.op === "regularPrism") out.push("obj:prism-regular");
    else if (s.op === "regularPyramidPts" || s.op === "apexOverPoint" || s.op === "apexOverCircumcenter" || s.op === "footOnEdge") out.push("obj:pyramid-regular");
    else if (s.op === "isoTrapezoidTangential" || s.op === "isoTrapezoidFromAngle") out.push("obj:pyramid-regular");
    else if (s.op === "midpoint3") out.push("rel:midpoint");
  }
  return out;
}

function fromGivens(givens: Given3D[]): string[] {
  const out: string[] = [];
  for (const g of givens) {
    if (g.kind === "dihedral") out.push("rel:angle(plane,plane)");
    else if (g.kind === "angle3") out.push("rel:angle(line,plane)");
  }
  return out;
}

function fromGeo3d(p: GeoProblem3D): string[] {
  const out = [...fromBuild(p.build), ...fromGivens(p.givens)];
  if (p.draw?.dihedral) out.push("rel:angle(plane,plane)");
  return out;
}

function fromScene(scene: Scene3D): string[] {
  const out: string[] = [];
  let hasCone = false, hasPoly = false;
  for (const e of scene.elements) {
    const k = (e as { kind: string }).kind;
    if (k === "cone3d") hasCone = true;
    else if (k === "polyhedron") hasPoly = true;
    else if (k === "angle3d") out.push("rel:angle(plane,plane)");
    else if (k === "circle3d") out.push(hasCone ? "rel:parallel-section(cone)" : "rel:plane-section(polyhedron)");
    else if (k === "inscribedSphere") out.push("rel:inscribed-sphere(cone)");
  }
  if (hasCone) out.push("obj:cone");
  if (hasPoly) out.push("obj:pyramid-regular"); // scenele compuse folosite sunt piramidale (trapez/diedru)
  return out;
}

function fromSpec2d(spec: FigureSpec2D): string[] {
  const out: string[] = [];
  for (const e of spec.elements ?? []) {
    if (e.kind === "angle" && (e.label || e.value)) out.push("rel:angle(plane,plane)");
    else if (e.kind === "incircle") out.push("rel:inscribed-sphere(cone)");
  }
  return out;
}

/** Tipurile de relație/obiect EXTRASE de CAS din intrare (deduplicat). Acestea declanșează construcția. */
export function extractTriggers(input: PipelineInput): string[] {
  let raw: string[] = [];
  switch (input.kind) {
    case "body3d": { const o = objectOf(input.body); if (o) raw = [o]; break; }
    case "geo3d": raw = fromGeo3d(input.problem); break;
    case "coneCut": raw = ["obj:cone", "rel:parallel-section(cone)", "rel:distance(point,plane)"]; break;
    case "scene": raw = fromScene(input.scene); break;
    case "spec2d": raw = fromSpec2d(input.spec); break;
    default: raw = [];
  }
  return [...new Set(raw)];
}
