/**
 * ETAPA 51 — Construcția soluției derivă din teorie, ANCORATĂ LA GRAFUL REAL.
 *
 * Pentru fiecare figură b47: EXERCIȚIU → CONCEPTE prin exercise_concept_link REAL (dump-ul
 * scripts/figures/b47-concept-links.json, extras din DB — NU shape→concept hardcodat). Construcția cerută =
 * reuniunea tiparelor (PATTERNS, fiecare ancorat la un concept real cu body) ale conceptelor-metodă cu care
 * exercițiul e CHIAR legat în graf. Specul se REGENERĂ determinist din enunț (pipeline-ul real) și se verifică
 * poarta STRUCTURALĂ. Concept legat fără tipar → MARCAT, nu inventat.   npm run verify:construction-graph
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveInput } from "../figures/authoring-registry";
import { runAuthoring, type AuthorCase } from "../../src/lib/figures/authoring";
import { checkConstruction, requiredFor, PATTERNS, MARKED } from "../../src/lib/figures/construction-patterns";

const DIR = join(process.cwd(), "scripts", "figures");
const links: { slug: string; method_concepts: string[] | null }[] = JSON.parse(readFileSync(join(DIR, "b47-concept-links.json"), "utf8"));
const conditions: Record<string, string> = JSON.parse(readFileSync(join(DIR, "b47-conditions.json"), "utf8"));

console.log("\n════════ ETAPA 51 — CONSTRUCȚIA DERIVATĂ DIN GRAFUL REAL (exercise_concept_link) ════════\n");
console.log(`Tipare ancorate la concepte reale: ${PATTERNS.length}  |  concepte marcate (fără tipar): ${MARKED.length}`);
console.log(`Total figuri b47: ${links.length}\n`);

let cuMetoda = 0, complet = 0, lipsa = 0, faraSpec = 0;
const markedHits = new Set<string>();
const gaps: string[] = [];

for (const l of links) {
  const mc = l.method_concepts;
  if (!mc || mc.length === 0) continue; // graful NU leagă exercițiul de o metodă-construcție → nu se cere construcție
  cuMetoda++;
  const cond = conditions[l.slug];
  const r = cond ? resolveInput(cond) : null;
  if (!r) { faraSpec++; gaps.push(`${l.slug}: enunț nerezolvat de extractor`); continue; }

  const ac: AuthorCase = { slug: l.slug, condition: cond, desired: { kind: "description", ref: "graf" }, desiredDescriptor: r.desired, input: r.input, concepts: mc };
  const res = runAuthoring(ac);
  if (!res.spec) { faraSpec++; gaps.push(`${l.slug}: spec neprodus (${res.reason ?? "?"})`); continue; }

  const { patterns, marked } = requiredFor(mc);
  marked.forEach((m) => markedHits.add(m));
  const chk = checkConstruction(res.spec, mc);

  if (chk.ok) complet++; else { lipsa++; gaps.push(`${l.slug}: lipsă ${chk.missing.join(",")} (concepte ${mc.join(",")})`); }
  console.log(`${chk.ok ? "✓" : "✗"} ${l.slug}`);
  console.log(`    concepte (graf real): ${mc.join(", ")}`);
  console.log(`    tipare aplicate     : ${patterns.map((p) => p.title).join(" + ") || "(niciun tipar)"}`);
  console.log(`    cerut → prezent     : [${chk.required.join(", ")}] → [${chk.present.join(", ")}]`);
  console.log(`    → ${chk.ok ? "COMPLET" : `LIPSĂ: ${chk.missing.join(", ")}`}\n`);
}

console.log("──────── REZUMAT ────────");
console.log(`exerciții legate de o metodă-construcție în graf : ${cuMetoda}/${links.length}`);
console.log(`  ├─ construcție COMPLETĂ (poarta structurală)   : ${complet}`);
console.log(`  ├─ construcție cu LIPSĂ                         : ${lipsa}`);
console.log(`  └─ fără spec (extractor/CAS)                    : ${faraSpec}`);
console.log(`exerciții fără metodă-construcție în graf (obiect/calcul, fără construcție cerută): ${links.length - cuMetoda}`);
if (markedHits.size) console.log(`concepte MARCATE întâlnite (fără tipar, ne-inventate): ${[...markedHits].join(", ")}`);
if (gaps.length) { console.log("\nGOLURI (de reparat în motor / re-link în graf):"); gaps.forEach((g) => console.log("  • " + g)); }

// Poarta de regresie: fiecare exercițiu legat de o metodă TREBUIE să primească construcția cerută.
const ok = lipsa === 0 && faraSpec === 0 && cuMetoda > 0;
console.log("\n" + (ok
  ? `✅ Toate cele ${cuMetoda} exerciții legate REAL de o metodă-construcție își primesc construcția (derivată din tiparul conceptului din graf).`
  : `❌ ${lipsa} cu lipsă, ${faraSpec} fără spec — de reparat motorul/legăturile.`));
process.exit(ok ? 0 : 1);
