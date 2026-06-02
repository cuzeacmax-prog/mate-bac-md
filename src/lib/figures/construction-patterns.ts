/**
 * ETAPA 50 — CONSTRUCȚIA SOLUȚIEI DERIVĂ DIN TEORIE. Liniile auxiliare NU se inventează per exercițiu
 * (fragil); ele vin din TIPARELE conceptelor-metodă (din graf). Validăm la nivel de CONCEPT (zeci,
 * generale), nu de exercițiu (mii).
 *
 * Un TIPAR DE CONSTRUCȚIE = descriere MAȘINĂ-CITIBILĂ a elementelor auxiliare pe care le introduce o metodă.
 * Construcția unui exercițiu = REUNIUNEA tiparelor conceptelor folosite (prin exercise_concept_link),
 * instanțiate pe entitățile exercițiului de CAS. Poarta STRUCTURALĂ cere ca elementele tiparelor să fie PREZENTE.
 */
import type { FigureSpec2D } from "./spec";
import type { FigureSpec3D, Scene3D } from "./spec3d";

/** Categorie de element auxiliar (mașină-citibilă), verificabilă în figura produsă. */
export type AuxCategory = "rightAngle" | "dihedralMark" | "sectionCurve" | "segment" | "point";
export interface AuxElement { el: AuxCategory; role?: string } // role: documentare (height/apothem/foot/center…)

export interface ConstructionPattern {
  concept: string;   // slug-ul conceptului-metodă din graf
  title: string;
  derivedFrom: string; // teoria din care e draftat (body-ul conceptului)
  requires: AuxElement[];
}

/** Setul MĂRGINIT de tipare per concept-metodă relevant figurilor (AI draftează din teorie; om validează). */
export const PATTERNS: ConstructionPattern[] = [
  {
    concept: "unghi-diedru-intre-plane", title: "Unghi diedru între plane",
    derivedFrom: "Diedrul = unghiul dintre perpendicularele pe muchia comună, câte una în fiecare plan.",
    requires: [{ el: "dihedralMark", role: "diedru" }, { el: "rightAngle", role: "perpendiculara pe muchie" }, { el: "segment", role: "perpendiculara" }],
  },
  {
    concept: "inaltimea-corpului", title: "Înălțimea piramidei/prismei",
    derivedFrom: "Înălțimea = perpendiculara din vârf pe planul bazei; piciorul în bază.",
    requires: [{ el: "segment", role: "height" }, { el: "point", role: "foot" }, { el: "rightAngle", role: "la picior" }],
  },
  {
    concept: "apotema-bazei", title: "Apotema bazei regulate",
    derivedFrom: "Apotema = perpendiculara din centrul bazei pe o latură.",
    requires: [{ el: "point", role: "center" }, { el: "segment", role: "apothem" }, { el: "rightAngle", role: "pe latură" }],
  },
  {
    concept: "distanta-punct-plan", title: "Distanța punct–plan",
    derivedFrom: "Distanța = lungimea perpendicularei din punct pe plan; piciorul perpendicularei.",
    requires: [{ el: "segment", role: "perpendicular" }, { el: "point", role: "foot" }, { el: "rightAngle" }],
  },
  {
    concept: "sectiune-axiala", title: "Secțiune axială / plan paralel",
    derivedFrom: "Secțiunea = intersecția planului cu corpul (triunghi axial / cerc-secțiune).",
    requires: [{ el: "sectionCurve", role: "secțiune" }],
  },
  {
    concept: "teorema-pitagora-spatiu", title: "Triunghi dreptunghic auxiliar (Pitagora în spațiu)",
    derivedFrom: "O muchie/înălțime + un segment din bază formează un triunghi dreptunghic în care se rezolvă.",
    requires: [{ el: "segment", role: "catetă/ipotenuză" }, { el: "rightAngle" }],
  },
];

const bySlug = new Map(PATTERNS.map((p) => [p.concept, p]));

/** Construcția cerută de un exercițiu = REUNIUNEA tiparelor conceptelor lui (categorii distincte). */
export function requiredFor(concepts: string[]): { categories: Set<AuxCategory>; patterns: ConstructionPattern[]; unknown: string[] } {
  const categories = new Set<AuxCategory>(); const patterns: ConstructionPattern[] = []; const unknown: string[] = [];
  for (const c of concepts) {
    const p = bySlug.get(c);
    if (!p) { unknown.push(c); continue; }
    patterns.push(p);
    for (const r of p.requires) categories.add(r.el);
  }
  return { categories, patterns, unknown };
}

const is3D = (s: FigureSpec2D | FigureSpec3D): s is FigureSpec3D => "scene" in s || "body" in s;

/** Categoriile de elemente auxiliare PREZENTE în figura produsă (scanare structurală a spec-ului). */
export function presentCategories(spec: FigureSpec2D | FigureSpec3D): Set<AuxCategory> {
  const present = new Set<AuxCategory>();
  if (is3D(spec)) {
    const scene = spec.scene as Scene3D | undefined;
    if (scene) {
      const polyVerts = new Set<string>();
      for (const e of scene.elements) if (e.kind === "polyhedron") e.vertices.forEach((v) => polyVerts.add(v));
      for (const e of scene.elements) {
        if (e.kind === "rightAngle3d") present.add("rightAngle");
        else if (e.kind === "angle3d") present.add("dihedralMark");
        else if (e.kind === "circle3d") present.add("sectionCurve");
        else if (e.kind === "segment3d") present.add("segment");
      }
      // punct auxiliar = punct nominal care NU e vârf al solidului (picior/centru/mijloc)
      for (const p of scene.points) { const id = (p as { id?: string }).id; if (id && !polyVerts.has(id)) present.add("point"); }
    }
  } else {
    const els = spec.elements ?? [];
    for (const e of els) {
      if (e.kind === "rightAngle") present.add("rightAngle");
      else if (e.kind === "angle" && (e.label || e.value)) present.add("dihedralMark");
      else if (e.kind === "incircle" || e.kind === "circumcircle" || e.kind === "circle") present.add("sectionCurve");
      else if (e.kind === "segment") present.add("segment");
      else if (e.kind === "midpoint" || (e.kind === "point")) present.add("point");
    }
  }
  return present;
}

export interface ConstructionCheck { ok: boolean; required: AuxCategory[]; present: AuxCategory[]; missing: AuxCategory[]; unknownConcepts: string[] }

/** Poarta STRUCTURALĂ: figura conține elementele de construcție cerute de conceptele exercițiului? */
export function checkConstruction(spec: FigureSpec2D | FigureSpec3D, concepts: string[]): ConstructionCheck {
  const { categories, unknown } = requiredFor(concepts);
  const present = presentCategories(spec);
  const required = [...categories];
  const missing = required.filter((c) => !present.has(c));
  return { ok: missing.length === 0, required, present: [...present], missing, unknownConcepts: unknown };
}
