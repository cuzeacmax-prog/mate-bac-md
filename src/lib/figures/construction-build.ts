/**
 * ETAPA 51 — ASAMBLAREA CONSTRUCȚIEI pe corpul real, derivată din conceptele-metodă cu care exercițiul e
 * legat în GRAF (exercise_concept_link). Extractorul produce de obicei un corp GOL (body3d, doar coaja); aici
 * îl convertim într-o scenă CAS cu puncte numite și ADĂUGĂM elementele auxiliare cerute de tiparele conceptelor
 * (centrul bazei, înălțimea, apotema, triunghiul dreptunghic, poligonul de secțiune) — pe geometrie reală, ZERO
 * coordonate inventate. Categoriile cerute vin din requiredFor(concepts); construcția le acoperă efectiv, astfel
 * încât poarta STRUCTURALĂ trece pentru că figura CHIAR conține construcția, nu pentru că am coborât poarta.
 */
import type { GeoProblem3D, BuildStep3D } from "./cas";
import type { Body3D } from "./spec3d";
import type { PipelineInput } from "./authoring";
import { requiredFor, type AuxCategory } from "./construction-patterns";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const baseIds = (n: number) => LETTERS.slice(0, n);
const topIds = (n: number) => LETTERS.slice(0, n).map((l) => l + "1");

type Draw = NonNullable<GeoProblem3D["draw"]>;
type Seg = NonNullable<Draw["segments"]>[number];
type RA = NonNullable<Draw["rightAngles3d"]>[number];

/** Construcția unei PIRAMIDE: centru bază O, înălțime VO⊥bază, apotemă OM⊥latură; opțional secțiune ∥ bază. */
function pyramidProblem(n: number, baseEdge: number, height: number, need: Set<AuxCategory>): GeoProblem3D {
  const base = baseIds(n), apex = "V";
  const build: BuildStep3D[] = [
    { op: "regularPyramidPts", base, apex, sides: n, baseEdge, height },
    { op: "centroid3", id: "O", of: base },
    { op: "midpoint3", id: "M", of: [base[0], base[1]] },
  ];
  const segments: Seg[] = [
    { of: [apex, "O"], dashed: true, label: "h" }, // înălțimea (perpendiculara din vârf pe bază)
    { of: ["O", "M"], label: "a" },                // apotema bazei
    { of: [apex, "M"] },                           // apotema piramidei (triunghiul dreptunghic VOM)
  ];
  const rightAngles3d: RA[] = [
    { at: "O", from: ["M", apex] },     // VO ⊥ planul bazei (OM e în bază)
    { at: "M", from: ["O", base[0]] },  // apotema bazei ⊥ latură
  ];
  if (need.has("sectionCurve")) {
    // Secțiune cu plan ∥ bază: mijloacele muchiilor laterale (poligon asemenea, la jumătatea înălțimii).
    for (let i = 0; i < n; i++) build.push({ op: "midpoint3", id: `S${i}`, of: [base[i], apex] });
    for (let i = 0; i < n; i++) segments.push({ of: [`S${i}`, `S${(i + 1) % n}`], label: "secțiune" });
  }
  return { build, solid: { base, apex }, draw: { segments, rightAngles3d }, givens: [] };
}

/** Construcția unei PRISME: centru bază O, apotemă OM⊥latură, muchie laterală; opțional secțiune (plan prin muchie). */
function prismProblem(n: number, baseEdge: number, height: number, need: Set<AuxCategory>): GeoProblem3D {
  const bottom = baseIds(n), top = topIds(n);
  const build: BuildStep3D[] = [
    { op: "regularPrism", bottom, top, sides: n, baseEdge, height },
    { op: "centroid3", id: "O", of: bottom },
    { op: "midpoint3", id: "M", of: [bottom[0], bottom[1]] },
  ];
  const segments: Seg[] = [
    { of: ["O", "M"], label: "a" },                 // apotema bazei
    { of: [bottom[0], top[0]] },                    // muchia laterală (verticala)
    { of: [top[0], "M"] },                          // triunghi dreptunghic (cateta + ipotenuza)
  ];
  const rightAngles3d: RA[] = [
    { at: "M", from: ["O", bottom[0]] },            // apotema ⊥ latură
    { at: bottom[0], from: ["M", top[0]] },         // muchia laterală ⊥ bază
  ];
  if (need.has("sectionCurve")) {
    // Secțiune prin muchia BB₁ și mijlocul M' al laturii opuse (plan (BB₁M)).
    const opp = Math.min(2, n - 1);
    build.push({ op: "midpoint3", id: "P", of: [bottom[0], bottom[opp]] });
    build.push({ op: "midpoint3", id: "Q", of: [top[0], top[opp]] });
    segments.push({ of: [bottom[1], "P"], label: "secțiune" });
    segments.push({ of: ["P", "Q"], label: "secțiune" });
    segments.push({ of: ["Q", top[1]], label: "secțiune" });
    segments.push({ of: [top[1], bottom[1]], label: "secțiune" });
  }
  return { build, solid: { bottom, top }, draw: { segments, rightAngles3d }, givens: [] };
}

/** Construcția unui PARALELIPIPED/CUB: centru bază O + triunghi dreptunghic diagonală–muchie (Pitagora în spațiu). */
function boxProblem(L: number, W: number, H: number, need: Set<AuxCategory>): GeoProblem3D {
  const bottom: [string, string, string, string] = ["A", "B", "C", "D"];
  const top: [string, string, string, string] = ["A1", "B1", "C1", "D1"];
  const build: BuildStep3D[] = [
    { op: "box", bottom, top, length: L, width: W, height: H },
    { op: "centroid3", id: "O", of: bottom }, // centrul feței bazei
  ];
  const segments: Seg[] = [
    { of: ["A", "C"], label: "d" },   // diagonala feței
    { of: ["C", "C1"] },              // muchia verticală
    { of: ["A", "C1"], dashed: true },// diagonala spațială (ipotenuza)
  ];
  const rightAngles3d: RA[] = [
    { at: "C", from: ["A", "C1"] },   // AC ⊥ CC₁ (triunghi dreptunghic ACC₁)
  ];
  if (need.has("point")) segments.push({ of: ["O", "B1"], dashed: true }); // raza spre vârf prin centru
  return { build, solid: { bottom, top }, draw: { segments, rightAngles3d }, givens: [] };
}

const TET_H = Math.sqrt(2 / 3); // înălțimea tetraedrului regulat / muchie

/** Completează un GeoProblem3D existent cu un PUNCT auxiliar (centrul bazei) dacă e cerut și lipsește. */
function completeProblem(prob: GeoProblem3D, need: Set<AuxCategory>): GeoProblem3D {
  const solid = prob.solid;
  if (!need.has("point") || !solid) return prob;
  const base = "apex" in solid ? solid.base : solid.bottom;
  if (prob.build.some((s) => s.op === "centroid3" && s.id === "Oc")) return prob; // deja completat
  const top = "apex" in solid ? solid.apex : solid.top[0];
  const build: BuildStep3D[] = [...prob.build, { op: "centroid3", id: "Oc", of: base }];
  const segments: Seg[] = [...(prob.draw?.segments ?? []), { of: ["Oc", top], dashed: true, label: "O" }];
  return { ...prob, build, draw: { ...prob.draw, segments } };
}

/**
 * Dacă intrarea e un corp poliedral GOL și conceptele (din graf) cer construcție, o asamblăm pe geometrie reală
 * și întoarcem un geo3d (scenă cu puncte + auxiliare). Altfel întoarcem intrarea neschimbată (fallback onest).
 */
export function augmentConstruction(input: PipelineInput, concepts: string[]): PipelineInput {
  const need = requiredFor(concepts).categories;
  if (need.size === 0) return input;

  // geo3d deja construit (ex. matcher specific cuboid-diedru, ETAPA 49): completăm doar elementele auxiliare
  // care lipsesc față de cerințele conceptelor din graf, derivate din solidul lui (fără să rescriem construcția).
  if (input.kind === "geo3d") return { kind: "geo3d", problem: completeProblem(input.problem, need) };
  if (input.kind !== "body3d") return input;
  const b: Body3D = input.body;
  let problem: GeoProblem3D | null = null;
  switch (b.kind) {
    case "regularPyramid": problem = pyramidProblem(Math.max(3, Math.floor(b.baseSides)), b.baseEdge, b.height, need); break;
    case "tetrahedron":    problem = pyramidProblem(3, b.edge, b.edge * TET_H, need); break;
    case "prism":          problem = prismProblem(Math.max(3, Math.floor(b.baseSides)), b.baseEdge, b.height, need); break;
    case "box":            problem = boxProblem(b.length, b.width, b.height, need); break;
    case "cube":           problem = boxProblem(b.edge, b.edge, b.edge, need); break;
    default:               return input; // frustum / round bodies: augmentare dedicată încă neimplementată
  }
  return { kind: "geo3d", problem };
}
