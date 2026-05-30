/**
 * 03-load-inventory.ts — ETAPA 3.0: Încarcă concept_inventory_raw (staging)
 *
 * Citește cele 12 clasa-NN-inventory.json din output/ și inserează fiecare
 * intrare din concept_inventory ca rând în concept_inventory_raw (Supabase).
 * Idempotent: TRUNCATE la fiecare rulare înainte de reinserare.
 *
 * Rulare:
 *   tsx --env-file=.env.local scripts/extraction/03-load-inventory.ts
 *
 * NU atinge tabela `concepts` sau alte tabele. Doar staging.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ConceptEntry {
  name: string;
  first_seen_pdf_page?: number;
  module?: string;
  subtopic?: string;
  occurrences?: number;
}

interface InventoryFile {
  grade: number;
  concept_inventory: ConceptEntry[];
}

async function main() {
  // Găsim toate fișierele clasa-NN-inventory.json
  const files = readdirSync(OUTPUT_DIR)
    .filter((f) => /^clasa-\d{2}-inventory\.json$/.test(f))
    .sort();

  if (files.length === 0) {
    console.error("Nu s-au găsit fișiere inventory în", OUTPUT_DIR);
    process.exit(1);
  }

  console.log(`Fișiere găsite: ${files.length}`);
  files.forEach((f) => console.log(" -", f));

  // Colectăm toate rândurile
  const rows: {
    grade: number;
    name: string;
    first_seen_pdf_page: number | null;
    module: string | null;
    subtopic: string | null;
    occurrences: number | null;
  }[] = [];

  const countPerGrade: Record<number, number> = {};

  for (const file of files) {
    const raw = readFileSync(join(OUTPUT_DIR, file), "utf-8");
    const data: InventoryFile = JSON.parse(raw);
    const grade = data.grade;
    const concepts = data.concept_inventory ?? [];

    countPerGrade[grade] = concepts.length;

    for (const c of concepts) {
      rows.push({
        grade,
        name: c.name,
        first_seen_pdf_page: c.first_seen_pdf_page ?? null,
        module: c.module ?? null,
        subtopic: c.subtopic ?? null,
        occurrences: c.occurrences ?? null,
      });
    }
  }

  console.log(`\nTotal rânduri colectate: ${rows.length}`);

  // DELETE toate rândurile — idempotent (service role bypass RLS)
  console.log("\nGolire concept_inventory_raw ...");
  const { error: delErr } = await supabase
    .from("concept_inventory_raw")
    .delete()
    .gte("grade", 1); // grade >= 1 acoperă tot (clasele 1-12)
  if (delErr) {
    console.error("Eroare la DELETE:", delErr.message);
    process.exit(1);
  }
  console.log("Tabelă golită.");

  // INSERT în batch-uri de 500
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("concept_inventory_raw").insert(batch);
    if (error) {
      console.error(`Eroare la insert batch ${i}-${i + BATCH}:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    process.stdout.write(`\r  Inserat: ${inserted}/${rows.length}`);
  }
  console.log("\n");

  // Raport final
  console.log("=== RAPORT ===");
  console.log(`Total rânduri inserate: ${inserted}`);
  console.log("\nDistribuție pe clase:");
  for (const grade of Object.keys(countPerGrade).map(Number).sort((a, b) => a - b)) {
    console.log(`  Clasa ${String(grade).padStart(2, "0")}: ${countPerGrade[grade]} concepte`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
