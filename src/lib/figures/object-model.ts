/**
 * ETAPA 43 — MODELUL OBIECTULUI (dimensiune intrinsecă) vs ALEGEREA VEDERII (dimensiunea figurii).
 *
 * Bug-ul de fond: sistemul comprima dimensiunea OBIECTULUI în dimensiunea FIGURII — „se poate desena ca
 * triunghi 2D" ⇒ clasifica „2D", ștergând că un CON e corp 3D. Două întrebări DISTINCTE:
 *   (1) CE E obiectul — dimensiune INTRINSECĂ, dată de entitate (con/piramidă/sferă/cilindru = 3D, mereu);
 *   (2) CUM îl reprezentăm — alegere de VEDERE (pictogramă 3D sau secțiune 2D), cu MOTIV înregistrat.
 * Dimensiunea figurii e un REZULTAT al alegerii vederii, nu o clasificare inițială. Pur (fără DOM).
 */

export type Dim = "2D" | "3D";
export type View = "pictogram3d" | "axialSection" | "plane2d";

/** Vocabular tipizat (ETAPA 42): entitatea îi dă dimensiunea — NU comoditatea desenului. */
const BODY_3D = new Set(["cone", "con", "pyramid", "piramida", "piramidă", "sphere", "sfera", "sferă", "cylinder", "cilindru", "prism", "prisma", "prismă", "cube", "cub", "box", "paralelipiped", "polyhedron", "poliedru", "frustum", "trunchi", "tetrahedron", "tetraedru"]);
const PRIMARY_2D = new Set(["triangle", "triunghi", "trapezoid", "trapez", "circle", "cerc", "parallelogram", "paralelogram", "square", "patrat", "pătrat", "rhombus", "romb", "polygon", "poligon", "quadrilateral", "patrulater"]);
// (point/punct, line/dreaptă, segment, plane/plan = auxiliare neutre — nu dau singure dimensiunea)

export interface Entity { kind: string; id?: string; role?: string }
export interface ObjectModel {
  entities: Entity[];
  intrinsicDim: Dim;
  bodies: string[];        // entități 3D
  primaries2D: string[];   // entități plane primare
  relations: string[];     // ex. "inscribed", "section", "tangent"
  reason: string;          // de ce această dimensiune (din entitate, nu din desen)
}

/** Etapa 1 — modelează obiectul: dimensiunea INTRINSECĂ vine din entități, NU din cum e comod de desenat. */
export function modelObject(entities: Entity[], relations: string[] = []): ObjectModel {
  const k = (e: Entity) => e.kind.toLowerCase().trim();
  const bodies = entities.filter((e) => BODY_3D.has(k(e))).map((e) => e.kind);
  const primaries2D = entities.filter((e) => PRIMARY_2D.has(k(e))).map((e) => e.kind);
  const intrinsicDim: Dim = bodies.length > 0 ? "3D" : "2D";
  const reason = bodies.length
    ? `obiect 3D: ${bodies.join(", ")} ${bodies.length > 1 ? "sunt corpuri cu volum" : "e corp cu volum"} — dimensiune intrinsecă a entității, independentă de cum se desenează (un con rămâne 3D chiar dacă secțiunea lui e un triunghi)`
    : `obiect 2D: ${primaries2D.join(", ") || "figură plană"} ca entitate primară în plan`;
  return { entities, intrinsicDim, bodies, primaries2D, relations, reason };
}

export interface ViewChoice { view: View; reason: string; alongside?: View }

const AMBIGUITY_RELS = new Set(["inscribed", "inscris", "înscris", "tangent-contained", "tangent", "tangenta", "tangentă", "circumscribed", "circumscris"]);
const ROUND = new Set(["cone", "con", "cylinder", "cilindru", "sphere", "sfera", "sferă"]);

/**
 * Etapa 2 — alege vederea PRINCIPIAL (cu motiv), niciodată „2D fiindcă era ușor":
 *   - obiect 2D → vedere plană;
 *   - corp 3D → IMPLICIT pictogramă 3D proiectată (obiect + construcția/secțiunea relevantă);
 *   - EXCEPȚIE: corpuri tangente înscrise (siluetă-conținere, sferă-în-con) → pictograma 3D ar fi ambiguă
 *     ⇒ vederea canonică = secțiunea axială (cu pictograma 3D rămasă ca detaliu opțional).
 */
export function chooseView(model: ObjectModel): ViewChoice {
  if (model.intrinsicDim === "2D") return { view: "plane2d", reason: "entitate plană primară ⇒ vedere 2D" };
  const k = (s: string) => s.toLowerCase().trim();
  const hasContainment = model.relations.some((r) => AMBIGUITY_RELS.has(k(r)));
  const roundBodies = model.bodies.filter((b) => ROUND.has(k(b))).length;
  const ambiguous = hasContainment && roundBodies >= 1; // corp înscris/tangent într-un corp rotund → siluetă ambiguă
  if (ambiguous) {
    return { view: "axialSection", alongside: "pictogram3d", reason: "EXCEPȚIE ambiguitate: corpuri tangente înscrise (siluetă-conținere) — pictograma 3D nu arată tangența clar ⇒ vederea canonică = secțiunea axială (pictograma 3D rămâne detaliu)" };
  }
  return { view: "pictogram3d", alongside: "axialSection", reason: "corp 3D cu pictogramă neambiguă ⇒ vedere 3D proiectată (obiect + planul/secțiunea relevantă); secțiunea axială rămâne detaliu opțional" };
}

/** Conveniență: model + vedere într-un pas, pentru extracție/raportare. */
export function modelAndView(entities: Entity[], relations: string[] = []): { model: ObjectModel; choice: ViewChoice } {
  const model = modelObject(entities, relations);
  return { model, choice: chooseView(model) };
}
