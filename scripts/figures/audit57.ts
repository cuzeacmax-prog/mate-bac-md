/**
 * ETAPA 57 — META-AUDIT: porțile mint? (A3)
 * Alege 5 figuri ACCEPTATE pseudo-aleator (ordine md5(slug||'etapa57') — deterministă, ne-cherry-pick-uită),
 * re-randează din spec_generat PERSISTAT, recalculează sha256(PNG) și compară cu gates->render_hash.
 * Pentru cele cu source=concept: re-rulează solve-ul din condition și compară numărul de măsurători
 * reale (r.checks) cu gates->reproduced, listând fiecare măsurătoare (nume, așteptat, obținut, pass).
 *   npx tsx --env-file=.env.local scripts/figures/audit57.ts
 */
import sharp from "sharp";
import { createHash } from "node:crypto";
import { createServiceClient } from "../../src/lib/supabase/service";
import { buildConceptFigure } from "../../src/lib/figures/concept-figure";
import { solveAndVerify3D } from "../../src/lib/figures/cas";
import { renderSVG } from "../../src/lib/figures/render-svg";
import type { FigureSpec3D } from "../../src/lib/figures/spec3d";

interface Row {
  slug: string; condition: string; status: string;
  spec_generat: FigureSpec3D | null;
  gates: { source?: string; reproduced?: number; render_hash?: string } | null;
}

async function main() {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("figura_autor")
    .select("slug, condition, status, spec_generat, gates")
    .in("status", ["auto-acceptat", "approved"]);
  if (error) { console.error(error.message); process.exit(1); }
  const rows = (data ?? []) as Row[];

  // selecție deterministă pseudo-aleatoare: sortare după md5(slug || 'etapa57'), primele 5
  const pick = rows
    .map((r) => ({ r, k: createHash("md5").update(r.slug + "etapa57").digest("hex") }))
    .sort((a, b) => a.k.localeCompare(b.k))
    .slice(0, 5)
    .map((x) => x.r);

  console.log(`\n════════ ETAPA 57 A3 — META-AUDIT PORȚI (5/${rows.length} acceptate, selecție md5) ════════\n`);
  let mismatch = 0;
  for (const row of pick) {
    console.log(`── ${row.slug}  [${row.status}, source=${row.gates?.source}]`);
    if (!row.spec_generat) { console.log("   ✗ FĂRĂ spec_generat persistat — poarta nu are artefact!"); mismatch++; continue; }

    // 1) re-randare din spec PERSISTAT → hash
    const svg = renderSVG(row.spec_generat);
    const buf = await sharp(Buffer.from(svg), { density: 200 }).flatten({ background: "white" }).png().toBuffer();
    const hash = createHash("sha256").update(buf).digest("hex");
    const stored = row.gates?.render_hash ?? "(lipsă)";
    const same = hash === stored;
    if (!same) mismatch++;
    console.log(`   render_hash stocat : ${stored}`);
    console.log(`   render_hash re-calc: ${hash}  ${same ? "✓ IDENTIC" : "✗ MISMATCH — POARTA MINTE"}`);

    // 2) reproduced = măsurători reale?
    if (row.gates?.source === "concept") {
      const cf = buildConceptFigure(row.condition);
      if (!cf.problem) { console.log(`   ✗ buildConceptFigure nu mai produce problemă: ${cf.reason}`); mismatch++; continue; }
      const r = solveAndVerify3D(cf.problem);
      const n = r.checks?.length ?? 0;
      const claimed = row.gates?.reproduced;
      console.log(`   reproduced stocat=${claimed}  re-măsurat=${n}  ${n === claimed ? "✓" : "✗ DIFERĂ"}`);
      for (const c of r.checks ?? []) {
        console.log(`     • ${c.name}  →  ${c.detail}  ${c.pass ? "pass" : "FAIL"}`);
      }
      if (n !== claimed) mismatch++;
    } else {
      console.log(`   (source=relation — nu are gates.reproduced; doar hash-ul e verificabil)`);
    }
    console.log("");
  }
  console.log(mismatch === 0 ? "✅ Toate porțile verificate corespund artefactelor persistate." : `❌ ${mismatch} nepotriviri — porți care mint.`);
  process.exit(mismatch === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
