/**
 * ETAPA 50→51→52 — CONSTRUCȚIA SOLUȚIEI DERIVĂ DIN TEORIE, DECLANȘATĂ DIN RELAȚIILE EXTRASE DE CAS.
 *
 * ETAPA 51 a ancorat tiparele la teoria reală (concept_id + body). ETAPA 52 schimbă DECLANȘATORUL: construcția
 * NU mai vine din exercise_concept_link (dominat de concepte de OBIECT/CALCUL — substantive), ci din TIPUL DE
 * RELAȚIE și TIPUL DE OBIECT extrase de CAS. Metoda (diedru, distanță punct–plan, secțiune) e IMPLICATĂ de o
 * relație, nu e un substantiv — deci cheia tiparului e relația/obiectul, nu eticheta semantică.
 *
 * Cheia = `trigger` (ex. "rel:angle(plane,plane)", "obj:pyramid-regular"). Ancorarea în teorie rămâne: fiecare
 * tipar păstrează `concept` (slug real din graf) + `derivedFrom` (din body-ul conceptului). Construcția unui
 * exercițiu = REUNIUNEA tiparelor pentru tipurile de relație/obiect EXTRASE de CAS (vezi relation-trigger.ts).
 * Tip extras fără tipar → MARCAT, nu inventat. exercise_concept_link rămâne doar pentru teorie/navigare.
 */
import type { FigureSpec2D } from "./spec";
import type { FigureSpec3D, Scene3D } from "./spec3d";

/** Categorie de element auxiliar (mașină-citibilă), verificabilă în figura produsă. */
export type AuxCategory = "rightAngle" | "dihedralMark" | "sectionCurve" | "segment" | "point";
export interface AuxElement { el: AuxCategory; role?: string }

export interface ConstructionPattern {
  /** TIPUL DE RELAȚIE / OBIECT care declanșează construcția (cheia). */
  trigger: string;
  kind: "relation" | "object";
  /** slug-ul REAL al conceptului-metodă din graf (ancorarea în teorie). */
  concept: string;
  title: string;
  /** teoria din care e draftat — extras din BODY-ul real al conceptului. */
  derivedFrom: string;
  requires: AuxElement[];
}

/**
 * Setul MĂRGINIT de tipare per TIP DE RELAȚIE/OBIECT (zeci), fiecare ancorat la un concept real cu body.
 * Tipurile de relație SUNT metodele tipizate (ETAPA 42): angle(plane,plane)→diedru, distance(point,plane)→
 * perpendiculară+picior, parallel-section→secțiune etc.
 */
export const PATTERNS: ConstructionPattern[] = [
  // ── OBIECTE (corpul implică o construcție internă: centru, înălțime, apotemă, triunghi dreptunghic) ──
  { trigger: "obj:pyramid-regular", kind: "object", concept: "g12-piramida-regulata", title: "Piramidă regulată (înălțime + centru bază)",
    derivedFrom: "concepts(g12-piramida-regulata).body: «proiecția vârfului pe planul bazei coincide cu centrul de simetrie al bazei» → centrul O + înălțimea VO⊥bază + apotema.",
    requires: [{ el: "point", role: "centrul bazei O" }, { el: "segment", role: "înălțimea VO" }, { el: "rightAngle", role: "VO⊥bază" }] },
  { trigger: "obj:prism-regular", kind: "object", concept: "g12-prisma-regulata", title: "Prismă regulată (apotemă + muchie laterală)",
    derivedFrom: "concepts(g12-prisma-regulata).body: «prismă dreaptă cu baza poligon regulat»; apotema = perpendiculara din centru pe latură.",
    requires: [{ el: "point", role: "centrul bazei" }, { el: "segment", role: "apotema" }, { el: "rightAngle", role: "pe latură" }] },
  { trigger: "obj:cuboid", kind: "object", concept: "g12-triunghi-dreptunghic", title: "Paralelipiped/cub (triunghi dreptunghic diagonală)",
    derivedFrom: "concepts(g12-triunghi-dreptunghic).body: «c²=a²+b²» → triunghi dreptunghic diagonală-feței / muchie (Pitagora în spațiu).",
    requires: [{ el: "segment", role: "diagonală/muchie" }, { el: "rightAngle" }] },
  // ── RELAȚII (metoda e implicată de relația dintre obiecte) ──
  { trigger: "rel:angle(plane,plane)", kind: "relation", concept: "g11-masura-unghiului-diedru", title: "Diedru (unghi între plane)",
    derivedFrom: "concepts(g11-masura-unghiului-diedru).body: «măsura unui unghi liniar; intersecția diedrului cu un plan perpendicular pe muchie».",
    requires: [{ el: "dihedralMark", role: "unghi liniar" }, { el: "rightAngle", role: "perpendiculară pe muchie" }, { el: "segment" }] },
  { trigger: "rel:angle(line,plane)", kind: "relation", concept: "g11-unghiul-format-de-o-dreapta-si-un-plan", title: "Unghi dreaptă–plan",
    derivedFrom: "concepts(g11-unghiul-format-de-o-dreapta-si-un-plan).body: «unghiul ascuțit dintre dreaptă și proiecția ei ortogonală pe plan».",
    requires: [{ el: "segment", role: "proiecția" }, { el: "point", role: "picior" }, { el: "rightAngle" }, { el: "dihedralMark", role: "unghiul" }] },
  { trigger: "rel:distance(point,plane)", kind: "relation", concept: "g11-distanta-de-la-un-punct-la-un-plan", title: "Distanța punct–plan",
    derivedFrom: "concepts(g11-distanta-de-la-un-punct-la-un-plan).body: «lungimea segmentului cu o extremitate punctul și cealaltă proiecția lui pe plan».",
    requires: [{ el: "segment", role: "perpendiculara" }, { el: "point", role: "picior" }, { el: "rightAngle" }] },
  { trigger: "rel:perpendicular(line,plane)", kind: "relation", concept: "g11-dreapta-perpendiculara-pe-un-plan", title: "Perpendiculara pe plan (înălțime)",
    derivedFrom: "concepts(g11-dreapta-perpendiculara-pe-un-plan).body: «dreapta perpendiculară pe orice dreaptă din plan» (înălțimea din vârf pe bază).",
    requires: [{ el: "segment", role: "perpendiculara" }, { el: "point", role: "picior" }, { el: "rightAngle" }] },
  { trigger: "rel:projection(point,plane)", kind: "relation", concept: "g11-proiectie-ortogonala-a-unui-punct-pe-un-plan", title: "Proiecția ortogonală pe plan",
    derivedFrom: "concepts(g11-proiectie-ortogonala-a-unui-punct-pe-un-plan).body: «piciorul perpendicularei din punct pe plan».",
    requires: [{ el: "point", role: "picior" }, { el: "segment" }, { el: "rightAngle" }] },
  { trigger: "rel:three-perpendiculars", kind: "relation", concept: "g11-teorema-celor-trei-perpendiculare", title: "Teorema celor trei perpendiculare",
    derivedFrom: "concepts(g11-teorema-celor-trei-perpendiculare).body: «dacă proiecția oblicei e ⊥ pe o dreaptă din plan, atunci și oblica e ⊥ pe ea».",
    requires: [{ el: "segment", role: "oblică/proiecție" }, { el: "rightAngle" }, { el: "point", role: "picior" }] },
  { trigger: "rel:right-triangle", kind: "relation", concept: "g8-teorema-lui-pitagora", title: "Triunghi dreptunghic auxiliar (Pitagora)",
    derivedFrom: "concepts(g8-teorema-lui-pitagora).body: «pătratul ipotenuzei = suma pătratelor catetelor».",
    requires: [{ el: "segment", role: "catetă/ipotenuză" }, { el: "rightAngle" }] },
  { trigger: "rel:metric-right-triangle", kind: "relation", concept: "g10-relatii-metrice-in-triunghiul-dreptunghic", title: "Relații metrice în triunghiul dreptunghic",
    derivedFrom: "concepts(g10-relatii-metrice-in-triunghiul-dreptunghic).body: «CD înălțimea corespunzătoare ipotenuzei; triunghiurile ACB, CDB, ADC».",
    requires: [{ el: "segment", role: "înălțimea" }, { el: "point", role: "piciorul" }, { el: "rightAngle" }] },
  { trigger: "rel:midpoint", kind: "relation", concept: "g10-relatii-metrice-in-triunghiul-dreptunghic", title: "Mijloc → mediană/înălțime (triunghi dreptunghic)",
    derivedFrom: "concepts(g10-relatii-metrice-in-triunghiul-dreptunghic).body: mijlocul unei laturi → mediana/înălțimea care formează triunghi dreptunghic auxiliar.",
    requires: [{ el: "point", role: "mijloc" }, { el: "segment" }, { el: "rightAngle" }] },
  { trigger: "rel:parallel-section(cone)", kind: "relation", concept: "g12-sectiuni-conice", title: "Secțiune conică (plan ∥ bază)",
    derivedFrom: "concepts(g12-sectiuni-conice).body: «curbele obținute secționând suprafața conică cu un plan».",
    requires: [{ el: "sectionCurve", role: "curba de secțiune" }] },
  { trigger: "rel:parallel-section(pyramid)", kind: "relation", concept: "g12-sectiunea-piramidei-cu-plan-paralel-cu-baza", title: "Secțiune piramidă cu plan ∥ bază",
    derivedFrom: "concepts(g12-sectiunea-piramidei-cu-plan-paralel-cu-baza).body: «plan ∥ baza secționează piramida după un poligon asemenea bazei».",
    requires: [{ el: "sectionCurve", role: "poligon de secțiune" }] },
  { trigger: "rel:plane-section(polyhedron)", kind: "relation", concept: "g12-sectiune-a-poliedrului", title: "Secțiune a poliedrului",
    derivedFrom: "concepts(g12-sectiune-a-poliedrului).body: «intersecția nevidă a unui poliedru cu un plan secant».",
    requires: [{ el: "sectionCurve", role: "poligon de secțiune" }] },
];

/** Tipuri de obiect care se desenează COMPLET și nu cer construcție auxiliară prin teorie (figura = corpul). */
export const NO_CONSTRUCTION: string[] = ["obj:cone", "obj:cylinder", "obj:sphere"];

/** Tipuri de relație/obiect relevante figurilor, dar fără tipar draftat → MARCATE, nu inventate. */
export const MARKED: { trigger: string; reason: string }[] = [
  { trigger: "obj:frustum", reason: "trunchi de piramidă — construcția (apotemă trapez + înălțime + secțiune diagonală) încă ne-draftată; concept g12-trunchi-de-piramida-regulata există în graf." },
  { trigger: "rel:inscribed-sphere(cone)", reason: "sferă înscrisă în con — secțiune axială cu cerc înscris; tipar dedicat ne-draftat." },
];

const byTrigger = new Map(PATTERNS.map((p) => [p.trigger, p]));
const noConstr = new Set(NO_CONSTRUCTION);
const markedSet = new Set(MARKED.map((m) => m.trigger));

/** Construcția cerută de un exercițiu = REUNIUNEA tiparelor pentru tipurile de relație/obiect EXTRASE. */
export function requiredFor(triggers: string[]): {
  categories: Set<AuxCategory>; patterns: ConstructionPattern[]; marked: string[]; noConstruction: string[]; unknown: string[];
} {
  const categories = new Set<AuxCategory>(); const patterns: ConstructionPattern[] = [];
  const marked: string[] = []; const noConstruction: string[] = []; const unknown: string[] = [];
  for (const t of triggers) {
    const p = byTrigger.get(t);
    if (p) { patterns.push(p); for (const r of p.requires) categories.add(r.el); continue; }
    if (noConstr.has(t)) { noConstruction.push(t); continue; }
    if (markedSet.has(t)) { marked.push(t); continue; }
    unknown.push(t);
  }
  return { categories, patterns, marked, noConstruction, unknown };
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

export interface ConstructionCheck { ok: boolean; required: AuxCategory[]; present: AuxCategory[]; missing: AuxCategory[]; markedTriggers: string[]; unknownTriggers: string[] }

/** Poarta STRUCTURALĂ: figura conține elementele cerute de tipurile de relație/obiect extrase de CAS? */
export function checkConstruction(spec: FigureSpec2D | FigureSpec3D, triggers: string[]): ConstructionCheck {
  const { categories, marked, unknown } = requiredFor(triggers);
  const present = presentCategories(spec);
  const required = [...categories];
  const missing = required.filter((c) => !present.has(c));
  return { ok: missing.length === 0, required, present: [...present], missing, markedTriggers: marked, unknownTriggers: unknown };
}
