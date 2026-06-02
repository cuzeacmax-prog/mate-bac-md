/**
 * ETAPA 43 — Probă: DIMENSIUNEA OBIECTULUI ≠ dimensiunea FIGURII. Dovada că e CONCEPTUAL (nu o regulă pe con):
 * modelăm obiectul (dimensiune intrinsecă din entitate), apoi ALEGEM vederea cu motiv. Un con e 3D chiar dacă
 * secțiunea lui e un triunghi.   Rulează:  npm run verify:geo-views
 */
import { modelAndView, type Entity } from "../../src/lib/figures/object-model";
import { coneSectionScene } from "../../src/lib/figures/relations";
import { verifyFigure3D } from "../../src/lib/figures/verify";
import { projectFigure } from "../../src/lib/figures/project";

interface Case { titlu: string; entities: Entity[]; relations: string[]; asteptatDim: "2D" | "3D"; asteptatView: string }
const cases: Case[] = [
  { titlu: "con cu plan de secțiune (distanța de la vârf la plan = 2)", entities: [{ kind: "con" }, { kind: "plan", role: "secțiune" }], relations: ["section"], asteptatDim: "3D", asteptatView: "pictogram3d" },
  { titlu: "sferă înscrisă în con", entities: [{ kind: "con" }, { kind: "sfera", role: "inscribed" }], relations: ["inscribed", "tangent"], asteptatDim: "3D", asteptatView: "axialSection" },
  { titlu: "piramidă regulată (corp simplu)", entities: [{ kind: "piramida" }], relations: [], asteptatDim: "3D", asteptatView: "pictogram3d" },
  { titlu: "triunghi isoscel cu bisectoare (figură plană)", entities: [{ kind: "triunghi" }], relations: [], asteptatDim: "2D", asteptatView: "plane2d" },
  { titlu: "paralelogram cu diagonală", entities: [{ kind: "paralelogram" }], relations: [], asteptatDim: "2D", asteptatView: "plane2d" },
];

let allOk = true;
console.log("\n════════ OBIECT (dimensiune intrinsecă) → VEDERE (aleasă cu motiv) ════════\n");
for (const c of cases) {
  const { model, choice } = modelAndView(c.entities, c.relations);
  const dimOk = model.intrinsicDim === c.asteptatDim;
  const viewOk = choice.view === c.asteptatView;
  const ok = dimOk && viewOk && choice.reason.length > 0;
  if (!ok) allOk = false;
  console.log(`${ok ? "✓" : "✗"} ${c.titlu}`);
  console.log(`    entități        : ${c.entities.map((e) => e.kind + (e.role ? `(${e.role})` : "")).join(" + ")}`);
  console.log(`    OBIECT          : ${model.intrinsicDim}  — ${model.reason}`);
  console.log(`    VEDERE          : ${choice.view}${choice.alongside ? ` (+detaliu: ${choice.alongside})` : ""}`);
  console.log(`    motiv vedere    : ${choice.reason}`);
  console.log(`    ${dimOk ? "·" : "✗"} dim ${model.intrinsicDim}/${c.asteptatDim}  ${viewOk ? "·" : "✗"} vedere ${choice.view}/${c.asteptatView}\n`);
}

// Dovada că pictograma con-secțiune e o FIGURĂ 3D reală (con + cerc-secțiune), nu un triunghi 2D gol.
console.log("──────── pictograma 3D con-secțiune (R3 H6, distanță vârf→plan = 2) ────────");
const scene = coneSectionScene(3, 6, { rel: "distanceApexToParallelPlane", value: 2 });
if (!scene) { console.log("✗ scenă nulă"); allOk = false; }
else {
  const spec = { scene };
  const ver = verifyFigure3D(spec);
  const d = projectFigure(spec, -35, 20);
  const hasConElements = scene.elements.some((e) => e.kind === "cone3d") && scene.elements.some((e) => e.kind === "circle3d");
  const ok = ver.ok && d.polylines.length > 4 && hasConElements;
  if (!ok) allOk = false;
  console.log(`    elemente scenă  : ${scene.elements.map((e) => e.kind).join(", ")}`);
  console.log(`    verifyFigure3D  : ${ver.ok}`);
  console.log(`    proiecție       : ${d.polylines.length} polilinii, etichete ${d.labels.map((l) => l.text).filter(Boolean).join(",")}`);
  console.log(`    ${ok ? "✓" : "✗"} con 3D + cerc-secțiune (NU triunghi 2D gol)\n`);
}

console.log(allOk
  ? "✅ Confirmat: dimensiunea ține de OBIECT (entitate), vederea e o alegere SEPARATĂ cu motiv; conul rămâne 3D."
  : "❌ Separarea obiect/vedere nu funcționează pe unele cazuri.");
process.exit(allOk ? 0 : 1);
