/**
 * 07-edge-propose.ts — ETAPA 4 / 4b: PROPUNERI MUCHII DE PRERECHIZIT (AI propune, omul aprobă)
 *
 * Rulează:  npm run extract:edges                      (țintele = clasele 1-11; clasa 12 NU e atinsă)
 *           npm run extract:edges -- --grades 5,9       (doar anumite clase-țintă)
 *           (sau: tsx --env-file=.env.local scripts/extraction/07-edge-propose.ts)
 *
 * Semantică muchie: from_concept REQUIRES to_concept  (înveți to_concept ÎNAINTE de from_concept).
 *
 * Flux (per clasă-țintă g):
 *   - Candidați de prerechizit = conceptele din clasele ≤ g (listă numerotată, index→uuid).
 *   - Țintele = conceptele clasei g. Modelul (claude-sonnet-4-6) întoarce, prin INDICI, pentru
 *     fiecare țintă prerechizitele DIRECTE: [{target_id, prereq_ids[], confidence, note}].
 *   - Reconstrucție deterministă indici→uuid.
 * Idempotență SIGURĂ: șterge din concept_edge_proposals DOAR muchiile cu from_concept în clasele
 *   procesate (niciodată clasa 12), apoi inserează. Muchiile clasei 12 rămân intacte.
 * Verificări structurale peste TOT graful (din DB): indici reali, 0 muchii spre clasă mai mare,
 *   cicluri (DAG) raportate cu nume, total/cross/in-clasă/rădăcini/confidence per clasă.
 *
 * NU atinge `concept_edges` reală. Doar propuneri.
 *
 * Requires: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

// ── Config ───────────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 24000;
const PROTECTED_GRADE = 12; // gata + validată manual — NU se atinge
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 2000;
const VALID_CONF = ['high', 'medium', 'low'] as const;
type Confidence = (typeof VALID_CONF)[number];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Tipuri ───────────────────────────────────────────────────────────────────
interface Concept {
  id: string;
  name: string;
  grade_level: number;
  subtopic: string | null;
  order_in_grade: number;
}
interface ModelTarget {
  target_id: number;
  prereq_ids: number[];
  confidence: string;
  note?: string;
}
interface EdgeRow {
  from_concept: string;
  to_concept: string;
  relation: 'prerequisit';
  confidence: Confidence;
  note: string;
}
interface GradeProblems {
  invalidTargetId: number; notATarget: number; invalidPrereqId: number;
  selfLoop: number; higherGrade: string[]; duplicate: number;
}
const emptyProblems = (): GradeProblems => ({ invalidTargetId: 0, notATarget: 0, invalidPrereqId: 0, selfLoop: 0, higherGrade: [], duplicate: 0 });

const asConf = (v: unknown): Confidence => (VALID_CONF.includes(v as Confidence) ? (v as Confidence) : 'low');
function asIds(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v) { const n = Number(x); if (Number.isInteger(n)) out.push(n); }
  return out;
}
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}
function makeClient(url: string, key: string) { return createClient(url, key); }
type Db = ReturnType<typeof makeClient>;

// ── Prompt ───────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT =
  'Ești proiectant de curriculum de matematică (BAC Republica Moldova). Construiești muchii de ' +
  'PRERECHIZIT: pentru fiecare concept-țintă, ce trebuie știut ÎNAINTE ca să-l poți învăța. Te ' +
  'referi la concepte EXCLUSIV prin numărul lor (ID). Răspunzi EXCLUSIV cu obiectul JSON cerut — ' +
  'fără proză, fără markdown, fără ```.';

function buildUserPrompt(candidates: Concept[], targetGrade: number, targetIdx: number[]): string {
  const lines = candidates
    .map((c, i) => `${i + 1}. [cl.${c.grade_level}]${c.grade_level === targetGrade ? ' ⟵ȚINTĂ' : ''} ${c.name}` +
      (c.subtopic ? ` · ${c.subtopic}` : ''))
    .join('\n');
  const M = candidates.length;

  return `Mai jos sunt ${M} concepte de matematică din clasele 1..${targetGrade}, NUMEROTATE 1..${M}, fiecare cu clasa lui.
ȚINTELE sunt cele ${targetIdx.length} concepte din clasa ${targetGrade} (marcate "⟵ȚINTĂ").

LISTA:
${lines}

SARCINĂ: pentru FIECARE țintă (clasa ${targetGrade}), dă PRERECHIZITELE DIRECTE — conceptele de care
depinde IMEDIAT ca să poată fi învățată. Răspunde prin INDICI (numere), nu prin nume.

Întoarce STRICT un singur obiect JSON, exact în forma:
{
  "targets": [
    { "target_id": <ID-ul țintei>, "prereq_ids": [<ID-uri prerechizit DIRECT>], "confidence": "high"|"medium"|"low", "note": "<scurt sau gol>" }
  ]
}

REGULI OBLIGATORII:

1. Câte o intrare pentru FIECARE țintă (toate cele ${targetIdx.length} concepte marcate ⟵ȚINTĂ).
2. Doar prerechizite DIRECTE (de care depinde IMEDIAT), tipic 1-4. NU înșira strămoși îndepărtați
   (dacă A are nevoie de B și B de C, pune doar B la A, nu și C).
3. Prerechizitul trebuie să fie dintr-o clasă ≤ clasa țintei. Preferă-l pe cel mai apropiat și
   relevant. NU pune prerechizite din clase MAI MARI decât ținta.
4. O țintă fundamentală care nu are prerechizit în listă → "prereq_ids": [] (rădăcină).
5. NU pune ținta ca propriul ei prerechizit. Evită lanțuri circulare.
6. confidence: "high" = sigur de dependență; "low" = nesigur.

Răspunde DOAR cu obiectul JSON.`;
}

async function callModel(anthropic: Anthropic, system: string, user: string) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const stream = anthropic.messages.stream({ model: MODEL, max_tokens: MAX_TOKENS, system, messages: [{ role: 'user', content: user }] });
      const msg = await stream.finalMessage();
      const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      return { text, stopReason: msg.stop_reason, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retriable = status === undefined || status === 408 || status === 409 || status === 429 || status === 529 || (typeof status === 'number' && status >= 500);
      if (!retriable || attempt === MAX_RETRIES) break;
      const backoff = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 500);
      console.warn(`  ↻ retry ${attempt + 1}/${MAX_RETRIES} (status=${status ?? 'net'}) după ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// ── Detectare cicluri (DFS pe graful uuid from→to) ───────────────────────────
function findCycles(adj: Map<string, string[]>): string[][] {
  const color = new Map<string, number>(); // 0 white, 1 gray, 2 black
  const stack: string[] = [];
  const cycles: string[][] = [];
  const dfs = (u: string) => {
    color.set(u, 1); stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const cv = color.get(v) ?? 0;
      if (cv === 0) dfs(v);
      else if (cv === 1) { const i = stack.indexOf(v); if (i !== -1) cycles.push(stack.slice(i).concat(v)); }
    }
    color.set(u, 2); stack.pop();
  };
  for (const u of adj.keys()) if ((color.get(u) ?? 0) === 0) dfs(u);
  return cycles;
}

// ── Propunere muchii pentru O clasă-țintă ────────────────────────────────────
interface GradeResult {
  grade: number; targets: number; addressed: number;
  edges: EdgeRow[]; problems: GradeProblems; inTok: number; outTok: number;
}

async function proposeForGrade(anthropic: Anthropic, allConcepts: Concept[], targetGrade: number): Promise<GradeResult> {
  const candidates = allConcepts.filter((c) => c.grade_level <= targetGrade); // păstrează ordinea globală
  const M = candidates.length;
  const idOf = (i1: number) => candidates[i1 - 1].id;
  const gradeOf = (i1: number) => candidates[i1 - 1].grade_level;
  const nameOf = (i1: number) => candidates[i1 - 1].name;
  const targetIdx = candidates.map((c, i) => (c.grade_level === targetGrade ? i + 1 : 0)).filter((x) => x > 0);
  const problems = emptyProblems();
  if (targetIdx.length === 0) return { grade: targetGrade, targets: 0, addressed: 0, edges: [], problems, inTok: 0, outTok: 0 };

  console.log(`\n──── clasa ${targetGrade}: ${targetIdx.length} ținte · ${M} candidați (cl. ≤ ${targetGrade}) ────`);
  const { text, stopReason, inputTokens, outputTokens } = await callModel(anthropic, SYSTEM_PROMPT, buildUserPrompt(candidates, targetGrade, targetIdx));
  if (stopReason === 'max_tokens') console.warn('  ⚠️  Răspuns TRUNCHIAT (max_tokens) — unele ținte pot lipsi.');
  const jsonStr = extractJson(text);
  if (!jsonStr) throw new Error(`Clasa ${targetGrade}: model fără JSON parsabil.`);
  let modelTargets: ModelTarget[];
  try {
    const parsed = JSON.parse(jsonStr) as { targets?: ModelTarget[] };
    modelTargets = Array.isArray(parsed.targets) ? parsed.targets : [];
  } catch (e) { throw new Error(`Clasa ${targetGrade}: JSON invalid (${(e as Error).message}).`); }

  const targetSet = new Set(targetIdx);
  const edgeKeys = new Set<string>();
  const addressed = new Set<number>();
  const edges: EdgeRow[] = [];
  for (const t of modelTargets) {
    const tId = Number(t.target_id);
    if (!Number.isInteger(tId) || tId < 1 || tId > M) { problems.invalidTargetId++; continue; }
    if (!targetSet.has(tId)) { problems.notATarget++; continue; }
    addressed.add(tId);
    const conf = asConf(t.confidence);
    const note = typeof t.note === 'string' ? t.note : '';
    for (const pId of asIds(t.prereq_ids)) {
      if (pId < 1 || pId > M) { problems.invalidPrereqId++; continue; }
      if (pId === tId) { problems.selfLoop++; continue; }
      if (gradeOf(pId) > gradeOf(tId)) { problems.higherGrade.push(`${nameOf(tId)}(cl.${gradeOf(tId)}) → ${nameOf(pId)}(cl.${gradeOf(pId)})`); continue; }
      const key = `${tId}-${pId}`;
      if (edgeKeys.has(key)) { problems.duplicate++; continue; }
      edgeKeys.add(key);
      edges.push({ from_concept: idOf(tId), to_concept: idOf(pId), relation: 'prerequisit', confidence: conf, note });
    }
  }
  console.log(`  → ${addressed.size}/${targetIdx.length} ținte adresate · ${edges.length} muchii  [in ${inputTokens}/out ${outputTokens}]` +
    (problems.higherGrade.length ? ` · ${problems.higherGrade.length} spre-clasă-mai-mare excluse` : ''));
  return { grade: targetGrade, targets: targetIdx.length, addressed: addressed.size, edges, problems, inTok: inputTokens, outTok: outputTokens };
}

// ── Verificare structurală peste TOT graful (din DB reală) ───────────────────
async function verifyWholeGraph(supabase: Db, allConcepts: Concept[]): Promise<void> {
  const byId = new Map(allConcepts.map((c) => [c.id, c]));
  const edges: { from_concept: string; to_concept: string; confidence: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('concept_edge_proposals').select('from_concept, to_concept, confidence').range(from, from + 999);
    if (error) throw new Error(`Citire verificare: ${error.message}`);
    if (!data || data.length === 0) break;
    edges.push(...(data as typeof edges));
    if (data.length < 1000) break;
  }

  const gradeOf = (id: string) => byId.get(id)?.grade_level ?? -1;
  const nameOf = (id: string) => byId.get(id)?.name ?? `?${id.slice(0, 6)}`;

  let dangling = 0, higher = 0;
  const higherEx: string[] = [];
  let cross = 0, inClass = 0;
  const confDist: Record<string, number> = { high: 0, medium: 0, low: 0 };
  const perClass = new Map<number, { edges: number; cross: number }>();
  const adj = new Map<string, string[]>();
  const fromSet = new Set<string>();

  for (const e of edges) {
    if (!byId.has(e.from_concept) || !byId.has(e.to_concept)) { dangling++; continue; }
    const fg = gradeOf(e.from_concept), tg = gradeOf(e.to_concept);
    if (tg > fg) { higher++; if (higherEx.length < 8) higherEx.push(`${nameOf(e.from_concept)}(cl.${fg}) → ${nameOf(e.to_concept)}(cl.${tg})`); }
    if (tg < fg) cross++; else inClass++;
    confDist[(e.confidence as string) in confDist ? (e.confidence as string) : 'low']++;
    const pc = perClass.get(fg) ?? { edges: 0, cross: 0 };
    pc.edges++; if (tg < fg) pc.cross++; perClass.set(fg, pc);
    if (!adj.has(e.from_concept)) adj.set(e.from_concept, []);
    adj.get(e.from_concept)!.push(e.to_concept);
    fromSet.add(e.from_concept);
  }

  const cycles = findCycles(adj);
  // Rădăcini = concepte care sunt vreodată „from" în 0 muchii (nu au prerechizit) — per clasă.
  const rootsPerClass = new Map<number, number>();
  for (const c of allConcepts) {
    if (!fromSet.has(c.id)) {
      rootsPerClass.set(c.grade_level, (rootsPerClass.get(c.grade_level) ?? 0) + 1);
    }
  }

  console.log('\n════════════ VERIFICARE STRUCTURALĂ (tot graful, din DB) ════════════');
  console.log(`Total muchii:            ${edges.length}  (cross-clasă ${cross} · în-clasă ${inClass})`);
  console.log(`Confidence:              high ${confDist.high} · medium ${confDist.medium} · low ${confDist.low}`);
  console.log(`  • indici/uuid reali:   ${dangling === 0 ? '✅ toate referă noduri reale' : `❌ ${dangling} muchii dangling`}`);
  console.log(`  • muchii spre clasă mai mare: ${higher === 0 ? '✅ 0' : `❌ ${higher} — ${higherEx.join(' | ')}`}`);
  if (cycles.length === 0) {
    console.log('  • DAG: ✅ niciun ciclu de prerechizit.');
  } else {
    console.log(`  • DAG: ❌ ${cycles.length} CICLURI (de rezolvat manual):`);
    for (const cyc of cycles.slice(0, 10)) console.log('     ' + cyc.map(nameOf).join(' → '));
  }
  console.log('\nPer clasă (from = ținta):');
  for (let g = 1; g <= 12; g++) {
    const pc = perClass.get(g);
    if (!pc) continue;
    console.log(`  cl.${String(g).padStart(2)} · muchii ${String(pc.edges).padStart(4)} (cross ${pc.cross}) · rădăcini ${rootsPerClass.get(g) ?? 0}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
function parseGrades(spec: string | undefined): number[] {
  if (!spec) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const set = new Set<number>();
  for (const tokRaw of spec.split(',')) {
    const tok = tokRaw.trim(); if (!tok) continue;
    const m = tok.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { let a = +m[1], b = +m[2]; if (a > b) [a, b] = [b, a]; for (let g = a; g <= b; g++) set.add(g); }
    else if (/^\d+$/.test(tok)) set.add(+tok);
    else throw new Error(`Token --grades invalid: "${tok}"`);
  }
  return [...set].filter((g) => g >= 1 && g <= 12).sort((a, b) => a - b);
}

async function main() {
  const { values } = parseArgs({ options: { grades: { type: 'string' } } });
  const targetGrades = parseGrades(values.grades);
  if (targetGrades.includes(PROTECTED_GRADE)) {
    console.error(`❌ Refuz să ating clasa ${PROTECTED_GRADE} (gata + validată). Rulează doar pe 1-11.`); process.exit(1);
  }
  if (targetGrades.length === 0) { console.error('❌ Nicio clasă-țintă validă.'); process.exit(1); }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
  if (!supabaseUrl || !serviceKey) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = makeClient(supabaseUrl, serviceKey);

  // Citește TOATE conceptele (ordine globală stabilă: grade, order_in_grade, name).
  console.log('📥 Citesc toate conceptele din `concepts` …');
  const allConcepts: Concept[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('concepts')
      .select('id, name, grade_level, subtopic, order_in_grade')
      .order('grade_level', { ascending: true }).order('order_in_grade', { ascending: true }).order('name', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`Citire concepts: ${error.message}`);
    if (!data || data.length === 0) break;
    allConcepts.push(...(data as Concept[]));
    if (data.length < 1000) break;
  }
  console.log(`   → ${allConcepts.length} concepte. Clase-țintă: [${targetGrades.join(', ')}] (clasa ${PROTECTED_GRADE} protejată).`);

  // Propune muchii pentru fiecare clasă-țintă (TOATE apelurile întâi; abia apoi atingem DB-ul).
  const results: GradeResult[] = [];
  for (const g of targetGrades) results.push(await proposeForGrade(anthropic, allConcepts, g));
  const allEdges = results.flatMap((r) => r.edges);

  // Idempotență SIGURĂ: șterge DOAR muchiile cu from_concept în clasele procesate (NU clasa 12).
  const fromIds = allConcepts.filter((c) => targetGrades.includes(c.grade_level)).map((c) => c.id);
  console.log(`\n🧹 Șterg muchiile existente cu from_concept în clasele [${targetGrades.join(', ')}] (${fromIds.length} concepte) — clasa ${PROTECTED_GRADE} NEATINSĂ …`);
  for (let i = 0; i < fromIds.length; i += 100) {
    const { error } = await supabase.from('concept_edge_proposals').delete().in('from_concept', fromIds.slice(i, i + 100));
    if (error) throw new Error(`Ștergere muchii 1-11: ${error.message}`);
  }
  let inserted = 0;
  for (let i = 0; i < allEdges.length; i += 500) {
    const { error } = await supabase.from('concept_edge_proposals').insert(allEdges.slice(i, i + 500));
    if (error) throw new Error(`Insert muchii [${i}]: ${error.message}`);
    inserted += Math.min(500, allEdges.length - i);
  }
  const inTok = results.reduce((s, r) => s + r.inTok, 0), outTok = results.reduce((s, r) => s + r.outTok, 0);
  console.log(`⬆️  Inserate ${inserted} muchii noi (clasele ${targetGrades.join(',')}).  ~$${((inTok / 1e6) * 3 + (outTok / 1e6) * 15).toFixed(4)}`);

  // Sumar per clasă (din rulare) + verificare structurală peste TOT graful (din DB).
  console.log('\n──────── propuneri per clasă-țintă (rulare) ────────');
  for (const r of results) {
    const hg = r.problems.higherGrade.length;
    console.log(`  cl.${String(r.grade).padStart(2)} · ținte ${r.addressed}/${r.targets} · muchii ${r.edges.length}` +
      ` · excl: self ${r.problems.selfLoop}, dubluri ${r.problems.duplicate}, clasă-mai-mare ${hg}, indici ${r.problems.invalidTargetId + r.problems.invalidPrereqId}`);
  }
  await verifyWholeGraph(supabase, allConcepts);
  console.log('\n✅ Doar PROPUNERI (concept_edge_proposals). `concept_edges` reală NU a fost atinsă. Clasa 12: intactă.');
}

main().catch((err: unknown) => {
  console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err);
  process.exit(1);
});
