/**
 * ETAPA 56 — RAPORT ONEST DIN DB (Strat 6: evidență doar din artefactul persistat). Re-randează din spec_generat
 * PERSISTAT (sharp), hash-tied; numără imaginile DISTINCTE / 112 și prinde coliziunile între enunțuri DIFERITE
 * (santinela anti-șablon). Raportează rata REALĂ de acceptare vs falsul 112/112.  npm run figura:raport56
 */
import sharp from "sharp";
import { createHash } from "node:crypto";
import { createServiceClient } from "../../src/lib/supabase/service";
import { renderSVG } from "../../src/lib/figures/render-svg";
import type { FigureSpec3D } from "../../src/lib/figures/spec3d";

async function hashOf(spec: FigureSpec3D): Promise<string> {
  const buf = await sharp(Buffer.from(renderSVG(spec)), { density: 200 }).flatten({ background: "white" }).png().toBuffer();
  return createHash("sha256").update(buf).digest("hex");
}

interface Row { slug: string; condition: string; status: string | null; spec_generat: FigureSpec3D | null; render_png: string | null; gates: Record<string, unknown> | null }

async function main() {
  const svc = createServiceClient();
  const { data, error } = await svc.from("figura_autor").select("slug, condition, status, spec_generat, render_png, gates").order("slug");
  if (error) { console.error(error.message); process.exit(1); }
  const rows = (data ?? []) as Row[];

  const byStatus = new Map<string, number>();
  const hashToConds = new Map<string, Set<string>>();
  let cuRender = 0, reproducDate = 0, accReal = 0, hashTied = 0;
  const esecReasons = new Map<string, number>();

  for (const r of rows) {
    byStatus.set(r.status ?? "?", (byStatus.get(r.status ?? "?") ?? 0) + 1);
    const g = r.gates ?? {};
    if (g.esec) esecReasons.set(String(g.esec), (esecReasons.get(String(g.esec)) ?? 0) + 1);
    if (!r.spec_generat || !r.render_png) continue;
    cuRender++;
    // re-randează DIN artefactul persistat (anti-fabricație) + hash-tie
    const h = await hashOf(r.spec_generat);
    if (g.render_hash === h) hashTied++;
    if (!hashToConds.has(h)) hashToConds.set(h, new Set());
    hashToConds.get(h)!.add(r.condition);
    if (typeof g.reproduced === "number" && g.reproduced > 0) reproducDate++;
    if (r.status === "auto-acceptat" || (g.source === "concept" && g.numeric_ok && (g.concept as { ok?: boolean })?.ok)) accReal++;
  }

  // santinela anti-șablon: un hash mapat la ENUNȚURI DIFERITE = coliziune de șablon
  const distincte = hashToConds.size;
  const coliziuni = [...hashToConds.entries()].filter(([, conds]) => conds.size > 1);

  console.log("\n════════ ETAPA 56 — RAPORT ONEST DIN DB (artefact persistat) ════════\n");
  console.log("Status în DB:");
  for (const [s, n] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${s.padEnd(16)} : ${n}`);
  console.log(`\nfiguri cu render persistat        : ${cuRender}/${rows.length}`);
  console.log(`  ├─ reproduc ≥1 dată a problemei  : ${reproducDate}`);
  console.log(`  ├─ acceptare REALĂ (concept+date): ${accReal}   (vs falsul 112/112 din ETAPA 53)`);
  console.log(`  └─ hash-tied (render = spec persistat): ${hashTied}/${cuRender}`);
  console.log(`\nIMAGINI DISTINCTE / ${rows.length}: ${distincte}   (ETAPA 53 avea 52)`);
  console.log(`COLIZIUNI între enunțuri DIFERITE (șablon): ${coliziuni.length}`);
  for (const [h, conds] of coliziuni.slice(0, 8)) console.log(`  • ${h.slice(0, 10)} ← ${conds.size} enunțuri: ${[...conds].map((x) => x.slice(0, 40)).join(" | ")}`);

  if (esecReasons.size) {
    console.log("\nEȘECURI (MARCAT) pe motiv:");
    for (const [why, n] of [...esecReasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}×  ${why}`);
  }

  console.log("\nCONSECINȚĂ ONESTĂ: rata reală (" + accReal + ") << 112. Marcaj onest > șablon greșit.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
