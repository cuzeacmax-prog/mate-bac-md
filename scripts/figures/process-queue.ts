/**
 * ETAPA 46 — Procesează COADA DE AUTORAT (declanșat de tine: „procesează coada de autorat").  npm run figura:coada
 *
 * Citește din figura_autor rândurile pending + needs_revision, rulează pipeline-ul ETAPA 45 (CAS + porți +
 * poartă vizuală vs DESENUL DORIT), ține cont de REMARCI la corecție, actualizează spec_generat + render +
 * status. AI = Claude Code (abonament), prin extracția din authoring-registry. Remarcă recurentă = gol
 * GENERAL → reparăm motorul / registry, NU edităm figura de mână.
 */
import sharp from "sharp";
import { createServiceClient } from "../../src/lib/supabase/service";
import { runAuthoring, type AuthorCase, type Remarks } from "../../src/lib/figures/authoring";
import { resolveInput } from "./authoring-registry";

async function pngDataUrl(svg: string | null): Promise<string | null> {
  if (!svg) return null;
  const buf = await sharp(Buffer.from(svg), { density: 200 }).flatten({ background: "white" }).png().toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}
const ICON = (b: boolean) => (b ? "✅" : "⛔");

interface Row { id: string; slug: string; condition: string; desired_kind: string | null; desired_ref: string | null; remarci: Remarks | null; iteratii: number | null; status: string | null }

async function main() {
  const svc = createServiceClient();
  // --retry: reia și cazurile marcate-uman; --refresh: REGENEREAZĂ toate cazurile fără verdict uman
  // (inclusiv auto-acceptat) după o îmbunătățire a MOTORULUI. Niciodată cele cu verdict approved/rejected.
  const statuses = process.argv.includes("--refresh") ? ["pending", "needs_revision", "marcat-uman", "auto-acceptat"]
    : process.argv.includes("--retry") ? ["pending", "needs_revision", "marcat-uman"]
    : ["pending", "needs_revision"];
  const { data, error } = await svc.from("figura_autor")
    .select("id, slug, condition, desired_kind, desired_ref, remarci, iteratii, status")
    .in("status", statuses).order("updated_at");
  if (error) { console.error(error.message); process.exit(1); }
  const rows = (data ?? []) as Row[];

  console.log(`\n════════ COADĂ DE AUTORAT — ${rows.length} de procesat (pending + needs_revision) ════════\n`);
  if (rows.length === 0) { console.log("Coadă goală. Adaugă cazuri din /admin/figura-autor."); return; }

  for (const row of rows) {
    const resolved = resolveInput(row.condition);
    if (!resolved) {
      await svc.from("figura_autor").update({ status: "marcat-uman", updated_at: new Date().toISOString() }).eq("id", row.id);
      console.log(`⚑ ${row.slug}  [marcat-uman]  — extracție necesară (adaugă clasa în authoring-registry)`);
      console.log(`    condiție: ${row.condition.slice(0, 90)}\n`);
      continue;
    }
    const c: AuthorCase = {
      slug: row.slug, condition: row.condition,
      desired: { kind: (row.desired_kind === "image" ? "image" : "description"), ref: row.desired_ref ?? "(fără referință)" },
      desiredDescriptor: resolved.desired, input: resolved.input, remarks: row.remarci ?? undefined,
    };
    const res = runAuthoring(c);
    const png = await pngDataUrl(res.svg);
    const { numeric, visual, desiredMatch } = res.gates;
    await svc.from("figura_autor").update({
      input_kind: c.input.kind, spec_generat: res.spec, gates: res.gates, render_png: png,
      status: res.status, iteratii: (row.iteratii ?? 0) + 1, updated_at: new Date().toISOString(),
    }).eq("id", row.id);

    console.log(`${res.status === "auto-acceptat" ? "✓" : "⚑"} ${row.slug}  [${res.status}]  (rundă ${(row.iteratii ?? 0) + 1}, era „${row.status}")`);
    console.log(`    constrângeri    : ${c.input.kind}`);
    console.log(`    porți numerice  : ${ICON(numeric.ok)} (${numeric.checks.filter((x) => x.pass).length}/${numeric.checks.length})`);
    console.log(`    poartă vizuală  : ${ICON(visual.ok)}`);
    console.log(`    potrivire DORIT : ${ICON(desiredMatch.ok)} (${desiredMatch.checks.map((x) => `${x.name?.split(" ")[0]}:${x.pass ? "·" : "✗"}`).join(" ")})`);
    if (res.remarksConsidered?.length) console.log(`    REMARCI luate în considerare: ${res.remarksConsidered.join(" | ")}`);
    console.log("");
  }
  console.log("Gata. Vezi /admin/figura-autor pentru DORIT vs GENERAT + aprobă/respinge.");
}
main().catch((e) => { console.error(e); process.exit(1); });
