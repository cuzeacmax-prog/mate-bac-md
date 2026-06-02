/**
 * ETAPA 47 — Backbone DETERMINIST pentru lotul de 100. Selectează ~100 enunțuri (module V/VI, cuvinte-cheie
 * geometrice), rulează pipeline-ul (model obiect/vedere implicit prin extractor + CAS + porți numerice +
 * poarta vizuală structurată), randează PNG pe disc + base64, PERSISTĂ în figura_autor. Apoi subagenții
 * Sonnet SE UITĂ la PNG-uri (verificare vizuală multimodală obligatorie). Pur determinist; fără AInic aici.
 *
 *   npm run figura:batch47        → procesează + persistă + scrie manifestul _b47/manifest.json
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServiceClient } from "../../src/lib/supabase/service";
import { resolveInput } from "./authoring-registry";
import { runAuthoring, type AuthorCase } from "../../src/lib/figures/authoring";

const OUT = "scripts/figures/_b47";
const slugFor = (exId: string, n: number) => `b47-${String(n).padStart(3, "0")}-${exId.slice(0, 8)}`;

interface Row { id: string; exercise_number: string | null; module: string | null; statement: string }

async function main() {
  const svc = createServiceClient();
  mkdirSync(OUT, { recursive: true });

  const { data, error } = await svc.from("exercise_raw")
    .select("id, exercise_number, module, statement")
    .in("module", ["Modulul V", "Modulul VI"])
    .filter("statement", "not.is", null)
    .order("module").order("exercise_number").limit(600);
  if (error) { console.error(error.message); process.exit(1); }
  const geoRe = /triunghi|trapez|paralelogram|\bcon\b|piramid|sfer|cilindru|prism|romb|patrulater|tetraedr|cub|dreptunghi|p[aă]trat/i;
  const all = (data as Row[]).filter((r) => r.statement && geoRe.test(r.statement));
  const rows = all.slice(0, 100);

  const reasons: Record<string, number> = {};
  const stats = { total: rows.length, extracted: 0, numericFail: 0, visualFail: 0, noExtract: 0, generated: 0 };
  const manifest: Array<{ slug: string; png: string; condition: string; status: string }> = [];

  let n = 0;
  for (const r of rows) {
    n++;
    const slug = slugFor(r.id, n);
    const resolved = resolveInput(r.statement);
    let status = "marcat-uman"; let reason = ""; let spec: unknown = null; let gates: unknown = null; let pngB64: string | null = null;

    if (!resolved) {
      status = "marcat-uman"; reason = "extracție eșuată"; stats.noExtract++;
    } else {
      stats.extracted++;
      const c: AuthorCase = { slug, condition: r.statement, desired: { kind: "description", ref: "(lot 47)" }, desiredDescriptor: resolved.desired, input: resolved.input };
      const res = runAuthoring(c);
      spec = res.spec; gates = res.gates;
      if (!res.gates.numeric.ok) { status = "marcat-uman"; reason = "numere nereproduse / invariant picat"; stats.numericFail++; }
      else if (!res.gates.visual.ok) { status = "marcat-uman"; reason = "vizual (structurat) picat"; stats.visualFail++; }
      else { status = "pending-visual"; reason = ""; } // așteaptă PRIVIREA agentului Sonnet
      if (res.svg) {
        try {
          const buf = await sharp(Buffer.from(res.svg), { density: 160 }).flatten({ background: "white" }).png().toBuffer();
          pngB64 = `data:image/png;base64,${buf.toString("base64")}`;
          const png = `${OUT}/${slug}.png`; writeFileSync(png, buf);
          stats.generated++;
          if (status === "pending-visual") manifest.push({ slug, png, condition: r.statement.slice(0, 160), status });
        } catch { /* render fail */ }
      }
    }
    if (reason) reasons[reason] = (reasons[reason] ?? 0) + 1;

    await svc.from("figura_autor").upsert({
      slug, condition: r.statement, desired_kind: "description", desired_ref: `lot47 ${r.module} ${r.exercise_number ?? ""}`.trim(),
      input_kind: resolved?.input.kind ?? null, spec_generat: spec, gates: gates ? { ...gates, reason } : { reason },
      render_png: pngB64, status, verdict_uman: null, iteratii: 1, updated_at: new Date().toISOString(),
    }, { onConflict: "slug" });
  }

  writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
  console.log("\n════════ ETAPA 47 — backbone determinist ════════");
  console.log(`total=${stats.total} · extrase=${stats.extracted} · generate(PNG)=${stats.generated} · pending-visual=${manifest.length}`);
  console.log(`marcate fără extracție=${stats.noExtract} · numerice picate=${stats.numericFail} · vizual-structurat picate=${stats.visualFail}`);
  console.log("MOTIVE:", JSON.stringify(reasons));
  console.log(`manifest pentru privirea Sonnet: ${OUT}/manifest.json (${manifest.length} figuri de privit)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
