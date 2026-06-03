/**
 * ETAPA 56 — FIGURA = INSTANȚIEREA CONCEPTELOR SPECIFICE pe datele ACESTEI probleme (NU poza unui tip de solid).
 *
 * Aceasta ÎNLOCUIEȘTE calea de șablon (standardSolid „clasifică tip → poză canonică → ștampilează"). Aici NU se
 * emite niciun solid generic: se extrag conceptele invocate (bază / relație / apex / construcție), ancorate
 * DETERMINIST la concept_id din graf (Strat 1), se compune un GeoProblem3D rezolvat de CAS pe datele problemei
 * (Strat 4) cu GIVENS pentru FIECARE dată (numere ȘI relații), iar construcția auxiliară se adaugă DOAR pentru
 * conceptele pe care problema le invocă (Strat 2/3). Dacă constrângerile nu se pot rezolva+reproduce → EȘEC,
 * MARCAT, niciodată șablon.
 */
import type { GeoProblem3D, BuildStep3D, Given3D } from "./cas";
import type { FigureSpec3D } from "./spec3d";
import { presentCategories, type AuxCategory } from "./construction-patterns";

export type ConceptRole = "base" | "relation" | "apex" | "construction" | "measure";
export interface InvokedConcept { slug: string | null; role: ConceptRole; label: string }
export interface ConceptFigure {
  problem: GeoProblem3D | null;
  concepts: InvokedConcept[];   // conceptele invocate (Strat 1) — ancorate la graf (slug) sau MARCAT (slug=null)
  reason?: string;              // dacă problem=null → de ce a eșuat (MARCAT)
}

// ── Strat 1: mapare DETERMINISTĂ tip → concept_id (slug real din `concepts`); fără slot semantic. ──
export const CONCEPT_SLUG = {
  trapez: "g10-trapez",
  bazeTrapez: "g9-bazele-trapezului",
  perpDiag: "g11-drepte-perpendiculare-in-spatiu",
  circumcentru: "g10-centrul-cercului-circumscris",
  inaltime: "g11-dreapta-perpendiculara-pe-un-plan",
  piramidaRegulata: "g12-piramida-regulata",
  prismaRegulata: "g12-prisma-regulata",
  paralelipiped: "g12-paralelipiped-dreptunghic",
  apotema: "g9-apotema",
  diedru: "g11-masura-unghiului-diedru",
} as const;

/**
 * Strat 2 — CONTRACT VIZUAL PER CONCEPT: ce categorii de elemente auxiliare TREBUIE să apară în figură când
 * conceptul e invocat (driverul porții per-concept). Concept fără contribuție vizuală → []. Ancorat la concept_id.
 */
export const VISUAL_CONTRACT: Record<string, AuxCategory[]> = {
  [CONCEPT_SLUG.trapez]: [],
  [CONCEPT_SLUG.bazeTrapez]: [],
  [CONCEPT_SLUG.perpDiag]: ["rightAngle"],                 // diagonale ⊥ ⟹ semn de unghi drept la intersecție
  [CONCEPT_SLUG.circumcentru]: ["point"],                  // vârf peste circumcentru ⟹ punctul O
  [CONCEPT_SLUG.inaltime]: ["segment", "rightAngle"],      // înălțimea VO + unghi drept la picior
  [CONCEPT_SLUG.apotema]: ["segment", "rightAngle"],       // OM + unghi drept la M
  [CONCEPT_SLUG.diedru]: ["dihedralMark"],                 // marcajul diedrului
  [CONCEPT_SLUG.piramidaRegulata]: [],
  [CONCEPT_SLUG.prismaRegulata]: [],
  [CONCEPT_SLUG.paralelipiped]: [],
};

export interface ConceptGate { ok: boolean; missing: { slug: string; need: AuxCategory[] }[] }
/** Poarta PER-CONCEPT (Strat 5.1): fiecare concept invocat își are categoriile vizuale prezente în figură. */
export function conceptGate(spec: FigureSpec3D, concepts: InvokedConcept[]): ConceptGate {
  const present = presentCategories(spec);
  const missing: { slug: string; need: AuxCategory[] }[] = [];
  for (const ic of concepts) {
    if (!ic.slug) continue;
    const need = VISUAL_CONTRACT[ic.slug] ?? [];
    const lipsa = need.filter((cat) => !present.has(cat));
    if (lipsa.length) missing.push({ slug: ic.slug, need: lipsa });
  }
  return { ok: missing.length === 0, missing };
}

// ── parsare numerică (Strat 1): întreg/zecimal + forme cu radical ──
const ITALIC = (s: string) => s.replace(/[\u{1D434}-\u{1D467}]/gu, (ch) => {
  const cp = ch.codePointAt(0)!; const base = cp <= 0x1d44d ? 0x1d434 : 0x1d44e - 26; return String.fromCharCode(65 + ((cp - base) % 26) + (cp <= 0x1d44d ? 0 : 32));
});
function norm(s: string): string { return ITALIC(s).replace(/𝜋/g, "π"); }
/** Valoarea numerică a unui token: 5 · 2,5 · \sqrt{3} · 2\sqrt{3} · 6\sqrt 2 . */
function tokVal(tok: string): number | null {
  tok = tok.trim();
  let m = tok.match(/^(\d+(?:[.,]\d+)?)\s*\\?sqrt\s*\{?\s*(\d+(?:[.,]\d+)?)\s*\}?/);
  if (m) return f(m[1]) * Math.sqrt(f(m[2]));
  m = tok.match(/^\\?sqrt\s*\{?\s*(\d+(?:[.,]\d+)?)\s*\}?/);
  if (m) return Math.sqrt(f(m[1]));
  m = tok.match(/^(\d+(?:[.,]\d+)?)/);
  if (m) return f(m[1]);
  return null;
}
const f = (s: string) => parseFloat(s.replace(",", "."));
const NUMTOK = "(\\d+(?:[.,]\\d+)?\\s*\\\\?sqrt\\s*\\{?\\s*\\d+(?:[.,]\\d+)?\\s*\\}?|\\\\?sqrt\\s*\\{?\\s*\\d+(?:[.,]\\d+)?\\s*\\}?|\\d+(?:[.,]\\d+)?)";
/** Primul număr care urmează (în fereastra dată) după un tipar-cheie. */
function near(c: string, key: RegExp, win = 40): number | null {
  const re = new RegExp(key.source + `[\\s\\S]{0,${win}}?` + NUMTOK, key.flags);
  const m = c.match(re); return m ? tokVal(m[m.length - 1]) : null;
}

/**
 * Construiește figura din conceptele invocate de enunț + datele lui. Doar familiile cu date care CONSTRÂNG complet
 * forma; altfel EȘEC (MARCAT). Fiecare GIVEN e o dată ce TREBUIE reprodusă în figura rezolvată (Strat 5, poarta 2).
 */
export function buildConceptFigure(condition: string): ConceptFigure {
  // string de căutare: fără $, subscripturi (_{}), spațieri LaTeX (\, \;) — păstrează \sqrt pt. tokVal
  const c = norm(condition).replace(/\$/g, "").replace(/[_{}]/g, "").replace(/\\[,;]/g, " ").replace(/\s+/g, " ").toLowerCase();
  const concepts: InvokedConcept[] = [];
  const fail = (reason: string): ConceptFigure => ({ problem: null, concepts, reason });

  // ════ FAMILIA 1: piramidă cu bază TRAPEZ ISOSCEL + diagonale ⊥ + muchii laterale egale (testul canonic b47-033) ══
  if (c.includes("trapez") && (c.includes("diagonal") && (c.includes("perpendicular") || c.includes("reciproc"))) && c.includes("muchi") && c.includes("lateral")) {
    const ab = near(c, /ab\s*=/) ?? near(c, /baza\s*mare/);
    const cd = near(c, /cd\s*=/) ?? near(c, /baza\s*mic[aă]/);
    const edge = near(c, /muchi[a-z]*\s*lateral[a-z]*[\s\S]{0,30}?c[âa]te/) ?? near(c, /lateral[a-z]*[\s\S]{0,30}?c[âa]te/) ?? near(c, /c[âa]te/);
    if (!(ab && cd && edge)) return fail("trapez: lipsesc AB/CD/muchie laterală");
    concepts.push({ slug: CONCEPT_SLUG.trapez, role: "base", label: "trapez isoscel (bază)" });
    concepts.push({ slug: CONCEPT_SLUG.bazeTrapez, role: "base", label: "baze AB∥CD" });
    concepts.push({ slug: CONCEPT_SLUG.perpDiag, role: "relation", label: "diagonale ⊥" });
    concepts.push({ slug: CONCEPT_SLUG.circumcentru, role: "apex", label: "muchii egale ⟹ vârf peste circumcentru" });
    concepts.push({ slug: CONCEPT_SLUG.inaltime, role: "construction", label: "înălțimea VO" });
    const build: BuildStep3D[] = [
      { op: "isoTrapezoidPerpDiag", ids: ["A", "B", "C", "D"], inter: "P", bottomBase: ab, topBase: cd },
      { op: "apexOverCircumcenter", apex: "V", foot: "O", base: ["A", "B", "C", "D"], lateralEdge: edge },
    ];
    const draw: GeoProblem3D["draw"] = {
      segments: [{ of: ["V", "O"], dashed: true, label: "h" }],
      rightAngles3d: [{ at: "P", from: ["A", "B"] }, { at: "O", from: ["A", "V"] }],
    };
    const givens: Given3D[] = [
      { kind: "length3", of: ["A", "B"], value: ab },
      { kind: "length3", of: ["C", "D"], value: cd },
      { kind: "length3", of: ["V", "A"], value: edge },
      { kind: "length3", of: ["V", "C"], value: edge },
      { kind: "angle3", at: "P", rays: ["A", "B"], value: 90 },
    ];
    return { problem: { build, solid: { base: ["A", "B", "C", "D"], apex: "V" }, draw, givens }, concepts };
  }

  // ════ FAMILIA 2: piramidă REGULATĂ (n-gon) cu latura bazei + (înălțime SAU muchie laterală) DATE direct ══
  const pyrReg = c.match(/piramid[aă]\s+(triunghiular[aă]|patrulater[aă]|hexagonal[aă]|pentagonal[aă])\s+regulat/);
  if (pyrReg) {
    const n = pyrReg[1].startsWith("triunghiular") ? 3 : pyrReg[1].startsWith("patrulater") ? 4 : pyrReg[1].startsWith("pentagonal") ? 5 : 6;
    const baseEdge = near(c, /(?:latura|muchia)\s+baz[ei][a-z]*\s*(?:[a-z]{1,3}\s*=)?/) ?? near(c, /ab\s*=/);
    const height = near(c, /[iî]n[aă]l[tț]ime[a-z]*(?:\s*vo)?\s*(?:=|de|are)?/);
    const lateral = near(c, /muchi[a-z]*\s+lateral[a-z]*\s*(?:[a-z]{1,3}\s*=)?/) ?? near(c, /va\s*=/);
    if (!baseEdge) return fail("piramidă regulată: lipsește latura bazei (dată directă)");
    const base = ["A", "B", "C", "D", "E", "F"].slice(0, n);
    const build: BuildStep3D[] = []; const givens: Given3D[] = [{ kind: "length3", of: [base[0], base[1]], value: baseEdge }];
    concepts.push({ slug: CONCEPT_SLUG.piramidaRegulata, role: "base", label: `piramidă regulată n=${n}` });
    if (height) {
      build.push({ op: "regularPyramidPts", base, apex: "V", sides: n, baseEdge, height }, { op: "centroid3", id: "O", of: base });
      givens.push({ kind: "length3", of: ["V", "O"], value: height });
      concepts.push({ slug: CONCEPT_SLUG.inaltime, role: "construction", label: "înălțimea VO dată" });
    } else if (lateral) {
      // baza n-gon; vârful REAL peste circumcentru ca muchia laterală = cea dată
      build.push({ op: "regularBase", ids: base, sides: n, baseEdge });
      build.push({ op: "apexOverCircumcenter", apex: "V", foot: "O", base, lateralEdge: lateral });
      givens.push({ kind: "length3", of: ["V", base[0]], value: lateral });
      concepts.push({ slug: CONCEPT_SLUG.circumcentru, role: "apex", label: "muchie laterală dată ⟹ vârf peste circumcentru" });
    } else return fail("piramidă regulată: lipsește înălțimea sau muchia laterală (dată directă)");
    if (c.includes("apotem")) concepts.push({ slug: CONCEPT_SLUG.apotema, role: "construction", label: "apotema (invocată explicit)" });
    const draw: GeoProblem3D["draw"] = { segments: [{ of: ["V", "O"], dashed: true, label: "h" }], rightAngles3d: [{ at: "O", from: [base[0], "V"] }] };
    if (c.includes("apotem")) { build.push({ op: "midpoint3", id: "M", of: [base[0], base[1]] }); draw.segments!.push({ of: ["O", "M"], label: "a" }); draw.rightAngles3d!.push({ at: "M", from: [base[0], "O"] }); }
    return { problem: { build, solid: { base, apex: "V" }, draw, givens }, concepts };
  }

  // ════ FAMILIA 3: prismă REGULATĂ cu latura bazei + înălțime DATE direct ══
  const prismReg = c.match(/prism[aă]\s+(triunghiular[aă]|patrulater[aă]|hexagonal[aă])\s+regulat/);
  if (prismReg) {
    const n = prismReg[1].startsWith("triunghiular") ? 3 : prismReg[1].startsWith("patrulater") ? 4 : 6;
    const baseEdge = near(c, /(?:latura|muchia)\s+baz[ei][a-z]*\s*(?:[a-z]{1,3}\s*=)?/) ?? near(c, /ab\s*=/);
    const height = near(c, /[iî]n[aă]l[tț]ime[a-z]*\s*(?:=|de|are)?/) ?? near(c, /aa\s*1?\s*=/) ?? near(c, /bb\s*1?\s*=/);
    if (!(baseEdge && height)) return fail("prismă regulată: lipsește latura bazei sau înălțimea (dată directă)");
    const bottom = ["A", "B", "C", "D", "E", "F"].slice(0, n), top = bottom.map((x) => x + "1");
    concepts.push({ slug: CONCEPT_SLUG.prismaRegulata, role: "base", label: `prismă regulată n=${n}` });
    concepts.push({ slug: CONCEPT_SLUG.inaltime, role: "construction", label: "înălțimea (muchie laterală)" });
    const build: BuildStep3D[] = [{ op: "regularPrism", bottom, top, sides: n, baseEdge, height }, { op: "centroid3", id: "O", of: bottom }, { op: "midpoint3", id: "M", of: [bottom[0], bottom[1]] }];
    const draw: GeoProblem3D["draw"] = { segments: [{ of: [bottom[0], top[0]], label: "h" }, { of: ["O", "M"], label: "a" }], rightAngles3d: [{ at: bottom[0], from: ["M", top[0]] }, { at: "M", from: ["O", bottom[0]] }] };
    const givens: Given3D[] = [{ kind: "length3", of: [bottom[0], bottom[1]], value: baseEdge }, { kind: "length3", of: [bottom[0], top[0]], value: height }];
    return { problem: { build, solid: { bottom, top }, draw, givens }, concepts };
  }

  // ════ FAMILIA 4: paralelipiped dreptunghic cu AB, BC, înălțime DATE direct ══
  if (c.includes("paralelipiped") || (c.includes("cub") && c.includes("muchia"))) {
    if (c.includes("cub")) {
      const e = near(c, /muchia\s*(?:[a-z]{0,3}\s*=)?/);
      if (!e) return fail("cub: lipsește muchia (dată directă)");
      concepts.push({ slug: CONCEPT_SLUG.paralelipiped, role: "base", label: "cub" });
      const build: BuildStep3D[] = [{ op: "box", bottom: ["A", "B", "C", "D"], top: ["A1", "B1", "C1", "D1"], length: e, width: e, height: e }, { op: "centroid3", id: "O", of: ["A", "B", "C", "D"] }];
      const draw: GeoProblem3D["draw"] = { segments: [{ of: ["A", "C"], label: "d" }, { of: ["C", "C1"] }, { of: ["A", "C1"], dashed: true }], rightAngles3d: [{ at: "C", from: ["A", "C1"] }] };
      const givens: Given3D[] = [{ kind: "length3", of: ["A", "B"], value: e }, { kind: "length3", of: ["A", "A1"], value: e }];
      return { problem: { build, solid: { bottom: ["A", "B", "C", "D"], top: ["A1", "B1", "C1", "D1"] }, draw, givens }, concepts };
    }
    const ab = near(c, /ab\s*=/), bc = near(c, /bc\s*=/) ?? near(c, /ad\s*=/);
    let h = near(c, /(?:aa\s*1?\s*=|[iî]n[aă]l[tț]ime[a-z]*\s*(?:=|de)?)/);
    // diedru dat (A1BC)/(ABC)=ang ⟹ înălțimea = AB·tan(ang) (AB ⊥ muchia BC) — dată derivată DETERMINIST
    const angM = c.match(/(\d+(?:[.,]\d+)?)\s*°/);
    const ang = angM && ((c.includes("plan") && c.includes("(a1bc)")) || c.includes("diedru")) ? f(angM[1]) : null;
    if (!h && ab && ang) h = ab * Math.tan((ang * Math.PI) / 180);
    if (!(ab && bc && h)) return fail("paralelipiped: lipsesc AB/BC/înălțime (sau diedru din care s-o derivăm)");
    concepts.push({ slug: CONCEPT_SLUG.paralelipiped, role: "base", label: "paralelipiped dreptunghic" });
    const build: BuildStep3D[] = [{ op: "box", bottom: ["A", "B", "C", "D"], top: ["A1", "B1", "C1", "D1"], length: ab, width: bc, height: h }, { op: "centroid3", id: "O", of: ["A", "B", "C", "D"] }];
    const draw: GeoProblem3D["draw"] = { segments: [{ of: ["A", "C"], label: "d" }, { of: ["C", "C1"] }, { of: ["A", "C1"], dashed: true }], rightAngles3d: [{ at: "C", from: ["A", "C1"] }] };
    const givens: Given3D[] = [{ kind: "length3", of: ["A", "B"], value: ab }, { kind: "length3", of: ["B", "C"], value: bc }];
    if (ang) {
      concepts.push({ slug: CONCEPT_SLUG.diedru, role: "relation", label: "diedru între plane (A1BC)/(ABC)" });
      draw.dihedral = { at: "B", rays: ["A", "A1"], label: `${ang}°` };
      givens.push({ kind: "dihedral", edge: ["B", "C"], inPlane1: "A", inPlane2: "A1", value: ang });
    } else givens.push({ kind: "length3", of: ["A", "A1"], value: h });
    return { problem: { build, solid: { bottom: ["A", "B", "C", "D"], top: ["A1", "B1", "C1", "D1"] }, draw, givens }, concepts };
  }

  // ════ FAMILIA 5: tetraedru regulat cu muchia DATĂ direct ══
  if (c.includes("tetraedr") && c.includes("muchi")) {
    const e = near(c, /muchi[a-z]*\s*(?:[a-z]{0,3}\s*=|de)?/);
    if (!e) return fail("tetraedru: lipsește muchia (dată directă)");
    concepts.push({ slug: CONCEPT_SLUG.piramidaRegulata, role: "base", label: "tetraedru regulat" });
    const build: BuildStep3D[] = [{ op: "regularBase", ids: ["A", "B", "C"], sides: 3, baseEdge: e }, { op: "apexOverCircumcenter", apex: "V", foot: "O", base: ["A", "B", "C"], lateralEdge: e }];
    const draw: GeoProblem3D["draw"] = { segments: [{ of: ["V", "O"], dashed: true, label: "h" }], rightAngles3d: [{ at: "O", from: ["A", "V"] }] };
    const givens: Given3D[] = [{ kind: "length3", of: ["A", "B"], value: e }, { kind: "length3", of: ["V", "A"], value: e }];
    return { problem: { build, solid: { base: ["A", "B", "C"], apex: "V" }, draw, givens }, concepts };
  }

  return fail("constrângeri incomplete / date derivate (arie/volum) — nu se poate instanția specific");
}
