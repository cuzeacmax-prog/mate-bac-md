/**
 * ETAPA 53 — DOVADA = ARTEFACTUL PERSISTAT. Citește spec_generat din figura_autor (DB), îl RANDEAZĂ și confirmă
 * că elementele de construcție sunt VIZIBILE pe render (nu doar prezente în spec): punctele auxiliare apar ca
 * etichete, segmentele auxiliare (înălțime/apotemă/diagonală) se desenează peste coaja solidului, marcajele de
 * unghi drept/diedru apar ca arce. Rulează ȘI poarta vizuală (ETAPA 44) pe randarea spec-ului persistat.
 *   npm run figura:verifica-persistat
 */
import { createServiceClient } from "../../src/lib/supabase/service";
import { renderToDrawing } from "../../src/lib/figures/render-svg";
import { structuredVisualChecks } from "../../src/lib/figures/visual-gate";
import type { FigureSpec3D, Scene3D } from "../../src/lib/figures/spec3d";

function polyEdgeCount(scene: Scene3D): number {
  const edges = new Set<string>();
  for (const e of scene.elements) if (e.kind === "polyhedron") {
    for (const f of e.faces) for (let i = 0; i < f.length; i++) edges.add([f[i], f[(i + 1) % f.length]].sort().join("|"));
  }
  return edges.size;
}

async function main() {
  const svc = createServiceClient();
  const { data, error } = await svc.from("figura_autor").select("slug, spec_generat, render_png, gates, status").like("slug", "b47-%").order("slug");
  if (error) { console.error(error.message); process.exit(1); }
  const rows = data ?? [];

  let cuSpec = 0, vizibile = 0, faraPng = 0, visualOk = 0;
  const gaps: string[] = [];

  for (const row of rows) {
    const spec = row.spec_generat as FigureSpec3D | null;
    if (row.render_png == null) faraPng++;
    if (!spec || !spec.scene) continue;
    const scene = spec.scene as Scene3D;

    const polyVerts = new Set<string>();
    for (const e of scene.elements) if (e.kind === "polyhedron") e.vertices.forEach((v) => polyVerts.add(v));
    const auxPoints = scene.points.map((p) => (p as { id?: string }).id).filter((id): id is string => !!id && !polyVerts.has(id));
    const hasRA = scene.elements.some((e) => e.kind === "rightAngle3d");
    const hasDih = scene.elements.some((e) => e.kind === "angle3d");
    const hasAuxSeg = scene.elements.some((e) => e.kind === "segment3d");
    const constructionInSpec = hasRA || hasDih || hasAuxSeg || auxPoints.length > 0;
    if (!constructionInSpec) continue;
    cuSpec++;

    // RANDEAZĂ spec-ul PERSISTAT și verifică VIZIBILITATEA construcției pe desen
    const d = renderToDrawing(spec);
    const labelTexts = new Set(d.labels.map((l) => l.text));
    const auxLabelsVisible = auxPoints.every((id) => labelTexts.has(id));      // punctele auxiliare etichetate pe desen
    const auxSegmentsDrawn = d.polylines.length > polyEdgeCount(scene);         // linii peste coaja solidului = segmente auxiliare
    const dotsForPoints = (d.dots?.length ?? 0) >= scene.points.length;        // punctișor la fiecare punct nominal
    const visible = auxLabelsVisible && auxSegmentsDrawn && dotsForPoints;
    if (visible) vizibile++; else gaps.push(`${row.slug}: labels=${auxLabelsVisible} segPesteCoaja=${auxSegmentsDrawn} dots=${dotsForPoints} (aux ${auxPoints.join(",")})`);

    // POARTA VIZUALĂ (ETAPA 44) pe randarea spec-ului PERSISTAT
    const vc = structuredVisualChecks(spec, d);
    if (vc.ok) visualOk++;
  }

  console.log("\n════════ ETAPA 53 — DOVADA DIN DB: spec persistat → render → construcție VIZIBILĂ ════════\n");
  console.log(`figuri b47 în DB                                : ${rows.length}`);
  console.log(`cu construcție în spec_generat (RA/diedru/seg/pct): ${cuSpec}`);
  console.log(`  └─ construcție VIZIBILĂ pe render-ul persistat : ${vizibile}`);
  console.log(`poartă vizuală (ETAPA 44) pe render persistat OK : ${visualOk}/${cuSpec}`);
  console.log(`fără render_png                                  : ${faraPng}`);
  if (gaps.length) { console.log("\nGOLURI (în spec dar NU vizibile pe render — de reparat randorul):"); gaps.slice(0, 20).forEach((g) => console.log("  • " + g)); }

  const ok = cuSpec > 22 && vizibile === cuSpec && faraPng === 0 && visualOk === cuSpec;
  console.log("\n" + (ok
    ? `✅ Pe artefactele PERSISTATE: ${cuSpec} figuri au construcție în spec ȘI o ARATĂ pe render; poarta vizuală trece pe toate.`
    : `❌ vizibile=${vizibile}/${cuSpec}, vizualOk=${visualOk}/${cuSpec}, faraPng=${faraPng} — de reparat.`));
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
