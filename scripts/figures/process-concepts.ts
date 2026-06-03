/**
 * ETAPA 56 — RE-PROCESARE prin coloana vertebrală NOUĂ (figura = instanțierea conceptelor specifice, NU șablon).
 *   npm run figura:concepte   (--all pt. inclusiv approved)
 *
 * Pentru fiecare figura_autor: buildConceptFigure (concepte ancorate + GeoProblem3D pe datele problemei) →
 * solveAndVerify3D (reproduce FIECARE dată) → poarta PER-CONCEPT (Strat 5.1) + poarta vizuală (ETAPA 44) →
 * render (sharp) + hash anti-șablon. CALEA DE ȘABLON E ȘTEARSĂ: dacă nu se instanțiază specific și nu se
 * reproduc datele → EȘEC, MARCAT (status esec-*), niciun body3d generic. Rândurile cu verdict uman nu se ating
 * la eșec (nu distrugem munca omului). Dovada se persistă: spec_generat + render_png + gates(render_hash).
 */
import sharp from "sharp";
import { createHash } from "node:crypto";
import { createServiceClient } from "../../src/lib/supabase/service";
import { buildConceptFigure, conceptGate } from "../../src/lib/figures/concept-figure";
import { solveAndVerify3D } from "../../src/lib/figures/cas";
import { renderSVG, renderToDrawing } from "../../src/lib/figures/render-svg";
import { structuredVisualChecks } from "../../src/lib/figures/visual-gate";
import { resolveInput } from "./authoring-registry";
import { runAuthoring } from "../../src/lib/figures/authoring";
import type { FigureSpec3D } from "../../src/lib/figures/spec3d";

async function png(spec: FigureSpec3D): Promise<{ url: string; hash: string }> {
  const svg = renderSVG(spec);
  const buf = await sharp(Buffer.from(svg), { density: 200 }).flatten({ background: "white" }).png().toBuffer();
  return { url: `data:image/png;base64,${buf.toString("base64")}`, hash: createHash("sha256").update(buf).digest("hex") };
}

interface Row { id: string; slug: string; condition: string; verdict_uman: string | null; iteratii: number | null; status: string | null }

async function main() {
  const svc = createServiceClient();
  const { data, error } = await svc.from("figura_autor").select("id, slug, condition, verdict_uman, iteratii, status").order("slug");
  if (error) { console.error(error.message); process.exit(1); }
  const rows = (data ?? []) as Row[];
  const all = process.argv.includes("--all");

  let acceptate = 0, esuate = 0, neatinse = 0, relatie = 0;
  console.log(`\n════════ ETAPA 56 — RE-PROCESARE CONCEPT-DRIVEN (${rows.length} figuri) ════════\n`);

  for (const row of rows) {
    // nu distrugem munca omului: rândurile cu verdict uman se ating doar dacă noul pipeline ACCEPTĂ (improvement)
    const protejat = !!row.verdict_uman && !all;
    const cf = buildConceptFigure(row.condition);

    // ── Calea A: instanțiere specifică din concepte + solve + reproduce ──
    if (cf.problem) {
      const r = solveAndVerify3D(cf.problem);
      if (r.accepted && r.spec) {
        const spec = r.spec as FigureSpec3D;
        const cg = conceptGate(spec, cf.concepts);
        const vc = structuredVisualChecks(spec, renderToDrawing(spec));
        const verdict = r.checks.length > 0 && cg.ok && vc.ok; // reproduce FIECARE dată + fiecare concept + vizibil
        const { url, hash } = await png(spec);
        const gates = {
          source: "concept", reproduced: r.checks.length, numeric_ok: r.checks.every((x) => x.pass),
          concept: { ok: cg.ok, missing: cg.missing }, visual: { ok: vc.ok },
          concepts: cf.concepts.map((x) => ({ slug: x.slug, role: x.role, label: x.label })), render_hash: hash,
        };
        await svc.from("figura_autor").update({
          input_kind: "concept", spec_generat: spec, gates, render_png: url,
          status: row.verdict_uman ?? (verdict ? "auto-acceptat" : "esec-poarta"),
          iteratii: (row.iteratii ?? 0) + 1, updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        acceptate += verdict ? 1 : 0; esuate += verdict ? 0 : 1;
        console.log(`${verdict ? "✓" : "⚑"} ${row.slug}  reproduce ${r.checks.length} date  concepte ${cf.concepts.length}  ${verdict ? "ACCEPTAT" : "EȘEC-POARTĂ(" + cg.missing.map((m) => m.slug).join(",") + ")"}`);
        continue;
      }
      // solve a eșuat (date nereproduse) → MARCAT, NICIUN șablon
      if (protejat) { neatinse++; console.log(`· ${row.slug}  [protejat de verdict uman] solve eșuat: ${r.reason}`); continue; }
      await svc.from("figura_autor").update({ input_kind: "concept", spec_generat: null, gates: { source: "concept", esec: r.reason, concepts: cf.concepts }, render_png: null, status: row.verdict_uman ?? "esec-solve", iteratii: (row.iteratii ?? 0) + 1, updated_at: new Date().toISOString() }).eq("id", row.id);
      esuate++; console.log(`✗ ${row.slug}  EȘEC-SOLVE: ${r.reason}`);
      continue;
    }

    // ── Calea B: construcție GENUINĂ non-șablon (con-secțiune, secțiune axială 2D…) — NU body3d ──
    const ri = resolveInput(row.condition);
    if (ri && ri.input.kind !== "body3d") {
      const res = runAuthoring({ slug: row.slug, condition: row.condition, desired: { kind: "description", ref: "concept" }, desiredDescriptor: ri.desired, input: ri.input });
      if (res.spec) {
        const spec = res.spec as FigureSpec3D;
        const { url, hash } = await png(spec);
        await svc.from("figura_autor").update({ input_kind: ri.input.kind, spec_generat: spec, gates: { source: "relation", visual: { ok: res.gates.visual.ok }, render_hash: hash }, render_png: url, status: row.verdict_uman ?? res.status, iteratii: (row.iteratii ?? 0) + 1, updated_at: new Date().toISOString() }).eq("id", row.id);
        relatie++; console.log(`✓ ${row.slug}  [relație ${ri.input.kind}]  ${res.status}`);
        continue;
      }
    }

    // ── EȘEC: calea de șablon e ștearsă → MARCAT „lipsă instanțiere", niciun body3d ──
    if (protejat) { neatinse++; console.log(`· ${row.slug}  [protejat de verdict uman] ${cf.reason}`); continue; }
    await svc.from("figura_autor").update({ input_kind: "concept", spec_generat: null, gates: { source: "concept", esec: cf.reason, concepts: cf.concepts }, render_png: null, status: row.verdict_uman ?? "esec-concept", iteratii: (row.iteratii ?? 0) + 1, updated_at: new Date().toISOString() }).eq("id", row.id);
    esuate++; console.log(`✗ ${row.slug}  MARCAT: ${cf.reason}`);
  }

  console.log(`\n──────── ${acceptate} acceptate · ${relatie} relație non-șablon · ${esuate} eșuate(MARCAT) · ${neatinse} neatinse(verdict uman) ────────`);
  console.log("Raport ONEST din DB cu: npm run figura:raport56");
}
main().catch((e) => { console.error(e); process.exit(1); });
