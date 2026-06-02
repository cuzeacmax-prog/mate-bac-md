/**
 * ETAPA 50→51 — CONSTRUCȚIA SOLUȚIEI DERIVĂ DIN TEORIE, ANCORATĂ LA GRAF.
 *
 * Liniile auxiliare NU se inventează per exercițiu (fragil) și NICI nu se atribuie prin shape→concept
 * hardcodat (simulat). Fiecare TIPAR e ancorat la un CONCEPT REAL din tabela `concepts` (prin slug/concept_id),
 * iar `derivedFrom` este extras din BODY-ul real al conceptului. Validăm la nivel de CONCEPT (zeci), nu de
 * exercițiu (mii).
 *
 * Construcția cerută de un EXERCIȚIU = REUNIUNEA tiparelor conceptelor cu care exercițiul e CHIAR LEGAT în graf
 * (exercise_concept_link REAL — vezi scripts/verify/construction-graph.ts). Concept legat dar fără tipar → MARCAT
 * (vezi MARKED), nu inventat. Poarta STRUCTURALĂ cere ca elementele tiparelor să fie PREZENTE în figură.
 */
import type { FigureSpec2D } from "./spec";
import type { FigureSpec3D, Scene3D } from "./spec3d";

/** Categorie de element auxiliar (mașină-citibilă), verificabilă în figura produsă. */
export type AuxCategory = "rightAngle" | "dihedralMark" | "sectionCurve" | "segment" | "point";
export interface AuxElement { el: AuxCategory; role?: string } // role: documentare (height/apothem/foot/center…)

export interface ConstructionPattern {
  /** slug-ul REAL al conceptului-metodă din tabela `concepts` (același cu coloana concept_construction_pattern.concept). */
  concept: string;
  title: string;
  /** teoria din care e draftat — extras din BODY-ul real al conceptului (nu propoziție de mână). */
  derivedFrom: string;
  requires: AuxElement[];
}

/**
 * Setul de tipare per concept-metodă, FIECARE ancorat la un concept real din graf (cu body).
 * `derivedFrom` citează esența body-ului din `concepts.body` al slug-ului indicat.
 */
export const PATTERNS: ConstructionPattern[] = [
  {
    concept: "g11-masura-unghiului-diedru", title: "Măsura unghiului diedru",
    derivedFrom: "concepts(g11-masura-unghiului-diedru).body: «măsura unui unghi liniar… intersecția unghiului diedru cu un plan perpendicular pe muchie» → câte o perpendiculară pe muchie în fiecare plan.",
    requires: [{ el: "dihedralMark", role: "unghi liniar" }, { el: "rightAngle", role: "perpendiculară pe muchie" }, { el: "segment", role: "perpendiculara" }],
  },
  {
    concept: "g11-distanta-de-la-un-punct-la-un-plan", title: "Distanța punct–plan",
    derivedFrom: "concepts(g11-distanta-de-la-un-punct-la-un-plan).body: «lungimea segmentului cu o extremitate punctul dat și cealaltă proiecția punctului pe plan» → perpendiculara + piciorul.",
    requires: [{ el: "segment", role: "perpendiculara" }, { el: "point", role: "proiecția (picior)" }, { el: "rightAngle", role: "la picior" }],
  },
  {
    concept: "g11-unghiul-format-de-o-dreapta-si-un-plan", title: "Unghiul dreaptă–plan",
    derivedFrom: "concepts(g11-unghiul-format-de-o-dreapta-si-un-plan).body: «unghiul ascuțit dintre dreaptă și proiecția ei ortogonală pe plan» → proiecția + piciorul + unghiul.",
    requires: [{ el: "segment", role: "proiecția" }, { el: "point", role: "picior" }, { el: "rightAngle", role: "proiecție ⊥" }, { el: "dihedralMark", role: "unghiul" }],
  },
  {
    concept: "g11-dreapta-perpendiculara-pe-un-plan", title: "Perpendiculara pe plan (înălțimea corpului)",
    derivedFrom: "concepts(g11-dreapta-perpendiculara-pe-un-plan).body: «dreapta perpendiculară pe orice dreaptă din plan». Înălțimea corpului = perpendiculara din vârf pe planul bazei; piciorul în bază.",
    requires: [{ el: "segment", role: "height" }, { el: "point", role: "foot" }, { el: "rightAngle", role: "la picior" }],
  },
  {
    concept: "g11-proiectie-ortogonala-a-unui-punct-pe-un-plan", title: "Proiecția ortogonală a unui punct pe plan",
    derivedFrom: "concepts(g11-proiectie-ortogonala-a-unui-punct-pe-un-plan).body: «piciorul perpendicularei (M₁) construite din M pe plan; MM₁⊥α, M₁∈α».",
    requires: [{ el: "point", role: "foot M₁" }, { el: "segment", role: "MM₁" }, { el: "rightAngle" }],
  },
  {
    concept: "g11-teorema-celor-trei-perpendiculare", title: "Teorema celor trei perpendiculare",
    derivedFrom: "concepts(g11-teorema-celor-trei-perpendiculare).body: «dacă proiecția a₁ a oblicei a este ⊥ pe o dreaptă b din plan, atunci și a ⊥ b» → oblică + proiecție + două unghiuri drepte.",
    requires: [{ el: "segment", role: "oblică/proiecție" }, { el: "rightAngle", role: "a₁⊥b și a⊥b" }, { el: "point", role: "picior" }],
  },
  {
    concept: "g8-teorema-lui-pitagora", title: "Triunghi dreptunghic auxiliar (Pitagora)",
    derivedFrom: "concepts(g8-teorema-lui-pitagora).body: «pătratul ipotenuzei = suma pătratelor catetelor» → triunghi dreptunghic auxiliar în care se rezolvă.",
    requires: [{ el: "segment", role: "catetă/ipotenuză" }, { el: "rightAngle" }],
  },
  {
    concept: "g12-triunghi-dreptunghic", title: "Triunghi dreptunghic (relații metrice)",
    derivedFrom: "concepts(g12-triunghi-dreptunghic).body: «catete a,b, ipotenuză c; c²=a²+b²» → triunghi dreptunghic marcat.",
    requires: [{ el: "segment", role: "catetă/ipotenuză" }, { el: "rightAngle" }],
  },
  {
    concept: "g10-relatii-metrice-in-triunghiul-dreptunghic", title: "Relații metrice în triunghiul dreptunghic",
    derivedFrom: "concepts(g10-relatii-metrice-in-triunghiul-dreptunghic).body: «CD înălțimea corespunzătoare ipotenuzei AB; triunghiurile ACB, CDB, ADC» → înălțimea + piciorul D + unghi drept.",
    requires: [{ el: "segment", role: "înălțimea CD" }, { el: "point", role: "piciorul D" }, { el: "rightAngle" }],
  },
  {
    concept: "g12-sectiunea-piramidei-cu-plan-paralel-cu-baza", title: "Secțiunea piramidei cu plan paralel cu baza",
    derivedFrom: "concepts(g12-sectiunea-piramidei-cu-plan-paralel-cu-baza).body: «plan ∥ baza la distanța h de vârf secționează piramida după un poligon asemenea bazei».",
    requires: [{ el: "sectionCurve", role: "poligon de secțiune" }],
  },
  {
    concept: "g12-sectiune-a-poliedrului", title: "Secțiune a poliedrului",
    derivedFrom: "concepts(g12-sectiune-a-poliedrului).body: «intersecția nevidă a unui poliedru cu un plan (plan secant)» → curba/poligonul de secțiune.",
    requires: [{ el: "sectionCurve", role: "poligon de secțiune" }],
  },
  {
    concept: "g12-sectiuni-conice", title: "Secțiuni conice",
    derivedFrom: "concepts(g12-sectiuni-conice).body: «curbele obținute secționând suprafața conică cu un plan (cerc/elipsă/parabolă/hiperbolă)».",
    requires: [{ el: "sectionCurve", role: "curba de secțiune" }],
  },
  {
    concept: "g12-piramida-regulata", title: "Piramidă regulată (înălțime + centru bază)",
    derivedFrom: "concepts(g12-piramida-regulata).body: «proiecția vârfului pe planul bazei coincide cu centrul de simetrie al bazei» → centrul O + înălțimea VO ⊥ bază.",
    requires: [{ el: "point", role: "centrul bazei O" }, { el: "segment", role: "înălțimea VO" }, { el: "rightAngle", role: "VO⊥bază" }],
  },
  {
    concept: "g12-prisma-regulata", title: "Prismă regulată (apotemă bază)",
    derivedFrom: "concepts(g12-prisma-regulata).body: «prismă dreaptă cu baza poligon regulat»; apotema bazei = perpendiculara din centru pe o latură.",
    requires: [{ el: "point", role: "centrul bazei" }, { el: "segment", role: "apotema" }, { el: "rightAngle", role: "pe latură" }],
  },
];

/**
 * Concepte-metodă relevante figurilor care există în graf dar NU au tipar (ne-draftate) → MARCATE, nu inventate.
 * Motiv tipic: body gol în `concepts` (nu există teorie din care să derivăm tiparul).
 */
export const MARKED: { concept: string; reason: string }[] = [
  { concept: "g9-apotema", reason: "concepts(g9-apotema).body este GOL în graf — tipar ne-draftat (nu inventat); apotema acoperită indirect prin g12-prisma-regulata / g12-piramida-regulata." },
];

const bySlug = new Map(PATTERNS.map((p) => [p.concept, p]));
const markedSet = new Set(MARKED.map((m) => m.concept));

/** Construcția cerută de un exercițiu = REUNIUNEA tiparelor conceptelor lui (categorii distincte). */
export function requiredFor(concepts: string[]): { categories: Set<AuxCategory>; patterns: ConstructionPattern[]; unknown: string[]; marked: string[] } {
  const categories = new Set<AuxCategory>(); const patterns: ConstructionPattern[] = []; const unknown: string[] = []; const marked: string[] = [];
  for (const c of concepts) {
    const p = bySlug.get(c);
    if (p) { patterns.push(p); for (const r of p.requires) categories.add(r.el); continue; }
    if (markedSet.has(c)) { marked.push(c); continue; }
    unknown.push(c);
  }
  return { categories, patterns, unknown, marked };
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
        else if (e.kind === "segment3d") { present.add("segment"); if (/sec[țt]iune|section/i.test((e as { label?: string }).label ?? "")) present.add("sectionCurve"); }
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

export interface ConstructionCheck { ok: boolean; required: AuxCategory[]; present: AuxCategory[]; missing: AuxCategory[]; unknownConcepts: string[]; markedConcepts: string[] }

/** Poarta STRUCTURALĂ: figura conține elementele de construcție cerute de conceptele REALE ale exercițiului? */
export function checkConstruction(spec: FigureSpec2D | FigureSpec3D, concepts: string[]): ConstructionCheck {
  const { categories, unknown, marked } = requiredFor(concepts);
  const present = presentCategories(spec);
  const required = [...categories];
  const missing = required.filter((c) => !present.has(c));
  return { ok: missing.length === 0, required, present: [...present], missing, unknownConcepts: unknown, markedConcepts: marked };
}
