/**
 * ETAPA 52 — Construcția declanșată din RELAȚIILE/OBIECTELE extrase de CAS (NU din exercise_concept_link).
 *
 * Pe lotul de 100 (enunțuri reale, b47-conditions.json): pentru fiecare exercițiu extragem TIPURILE DE
 * RELAȚIE/OBIECT (extractTriggers, din structura CAS), tiparele lor dau construcția cerută, motorul o asamblează
 * (augmentConstruction, în runAuthoring) și poarta STRUCTURALĂ verifică prezența. Acoperirea vine din relațiile
 * extrase, nu din legături semantice — deci mult peste cele 22 ale ETAPA 51.  npm run verify:construction-relations
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveInput } from "../figures/authoring-registry";
import { runAuthoring, type AuthorCase } from "../../src/lib/figures/authoring";
import { extractTriggers } from "../../src/lib/figures/relation-trigger";
import { checkConstruction, requiredFor, PATTERNS } from "../../src/lib/figures/construction-patterns";

const conditions: Record<string, string> = JSON.parse(readFileSync(join(process.cwd(), "scripts", "figures", "b47-conditions.json"), "utf8"));
const slugs = Object.keys(conditions).sort();

console.log("\n════════ ETAPA 52 — CONSTRUCȚIA DIN TIPUL DE RELAȚIE/OBIECT EXTRAS DE CAS ════════\n");
console.log(`Tipare per tip (relație/obiect): ${PATTERNS.length}  |  lot: ${slugs.length} exerciții\n`);

const trigCount = new Map<string, number>();        // de câte exerciții e declanșat fiecare trigger
const trigConstr = new Map<string, number>();        // dintre care duc la construcție cerută
let cuConstructie = 0, complet = 0, lipsa = 0, faraConstructie = 0, faraSpec = 0;
const markedHits = new Set<string>(), unknownHits = new Set<string>();
const gaps: string[] = [];

for (const slug of slugs) {
  const r = resolveInput(conditions[slug]);
  if (!r) { faraSpec++; continue; }
  const triggers = extractTriggers(r.input);
  for (const t of triggers) trigCount.set(t, (trigCount.get(t) ?? 0) + 1);

  const req = requiredFor(triggers);
  req.marked.forEach((m) => markedHits.add(m));
  req.unknown.forEach((u) => unknownHits.add(u));

  const ac: AuthorCase = { slug, condition: conditions[slug], desired: { kind: "description", ref: "relations" }, desiredDescriptor: r.desired, input: r.input };
  const res = runAuthoring(ac);
  if (!res.spec) { faraSpec++; continue; }

  if (req.categories.size === 0) { faraConstructie++; continue; } // doar obiecte fără construcție (con/cilindru/sferă) sau fără triggere
  cuConstructie++;
  for (const t of triggers) if (requiredFor([t]).categories.size > 0) trigConstr.set(t, (trigConstr.get(t) ?? 0) + 1);
  const chk = checkConstruction(res.spec, triggers);
  if (chk.ok) complet++; else { lipsa++; gaps.push(`${slug}: lipsă ${chk.missing.join(",")} (triggere ${triggers.join(",")})`); }
}

console.log("TIP DE RELAȚIE/OBIECT → tipar → câte exerciții îl declanșează:");
for (const p of PATTERNS) {
  const n = trigCount.get(p.trigger) ?? 0;
  if (n > 0) console.log(`  ${p.trigger.padEnd(30)} → ${p.title.padEnd(42)} : ${n} ex (concept ${p.concept})`);
}
const noPat = [...trigCount.keys()].filter((t) => !PATTERNS.some((p) => p.trigger === t));
if (noPat.length) { console.log("\nTipuri extrase FĂRĂ tipar (no-construction / marcate / necunoscute):"); for (const t of noPat) console.log(`  ${t.padEnd(30)} : ${trigCount.get(t)} ex`); }

console.log("\n──────── REZUMAT ────────");
console.log(`exerciții cu construcție CERUTĂ (≥1 tip de relație/obiect cu tipar) : ${cuConstructie}/${slugs.length}`);
console.log(`  ├─ construcție COMPLETĂ (poarta structurală)                     : ${complet}`);
console.log(`  └─ construcție cu LIPSĂ                                          : ${lipsa}`);
console.log(`exerciții fără construcție cerută (corp desenat complet)           : ${faraConstructie}`);
console.log(`exerciții fără spec (extractor n-a parsat — tabele/algebră)        : ${faraSpec}`);
if (markedHits.size) console.log(`tipuri MARCATE întâlnite (fără tipar, ne-inventate)               : ${[...markedHits].join(", ")}`);
if (unknownHits.size) console.log(`tipuri NECUNOSCUTE (de adăugat în set)                            : ${[...unknownHits].join(", ")}`);
if (gaps.length) { console.log("\nGOLURI (de reparat în motor):"); gaps.forEach((g) => console.log("  • " + g)); }

console.log(`\nComparație ETAPA 51 (declanșare din exercise_concept_link): 22/100 cu construcție.`);
console.log(`ETAPA 52 (declanșare din relațiile extrase de CAS): ${cuConstructie}/100 cu construcție.`);

const ok = lipsa === 0 && cuConstructie > 22;
console.log("\n" + (ok
  ? `✅ Acoperirea construcției vine din relațiile extrase (${cuConstructie}/100), mult peste 22; toate cele declanșate trec poarta structurală.`
  : `❌ lipsă=${lipsa}, cuConstructie=${cuConstructie} — de reparat motorul/extractorul de relații.`));
process.exit(ok ? 0 : 1);
