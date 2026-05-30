/**
 * 07-edge-propose.ts — ETAPA 4: PROPUNERI MUCHII DE PRERECHIZIT (AI propune, omul aprobă)
 *
 * Rulează:  npm run extract:edges
 *           (sau: tsx --env-file=.env.local scripts/extraction/07-edge-propose.ts [--target-grade 12])
 *
 * Semantică muchie: from_concept REQUIRES to_concept  (înveți to_concept ÎNAINTE de from_concept).
 *
 * Flux:
 *   1. Citește TOATE conceptele din `concepts` (id, name, grade_level, subtopic, order_in_grade),
 *      atribuie fiecăruia un ID 1..N (mapare ID→uuid/grade ținută în script).
 *   2. Trimite la claude-sonnet-4-6 lista NUMEROTATĂ completă (cu clasa fiecăruia), marcând
 *      ȚINTELE (clasa --target-grade, implicit 12). Cere, pentru FIECARE țintă, prerechizitele
 *      DIRECTE ca listă de INDICI. STRICT JSON. Modelul emite DOAR numere.
 *   3. Reconstruiește muchiile din indici → uuid (determinist) + VERIFICĂRI STRUCTURALE:
 *      indici reali, nicio muchie spre o clasă mai mare, niciun ciclu (DAG), rădăcini,
 *      cross-clasă vs în-clasă, distribuție confidence. Încarcă în concept_edge_proposals.
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
const DEFAULT_TARGET_GRADE = 12;
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

function buildUserPrompt(concepts: Concept[], targetGrade: number, targetIdx: number[]): string {
  const lines = concepts
    .map((c, i) => `${i + 1}. [cl.${c.grade_level}]${c.grade_level === targetGrade ? ' ⟵ȚINTĂ' : ''} ${c.name}` +
      (c.subtopic ? ` · ${c.subtopic}` : ''))
    .join('\n');
  const N = concepts.length;

  return `Mai jos sunt ${N} concepte de matematică din clasele 1..12, NUMEROTATE 1..${N}, fiecare cu clasa lui.
ȚINTELE sunt cele ${targetIdx.length} concepte din clasa ${targetGrade} (marcate "⟵ȚINTĂ"): ID-urile
[${targetIdx.join(', ')}].

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

1. Câte o intrare pentru FIECARE țintă (toate cele ${targetIdx.length} ID-uri marcate ⟵ȚINTĂ).
2. Doar prerechizite DIRECTE (de care depinde IMEDIAT), tipic 1-4. NU înșira strămoși îndepărtați
   (dacă A are nevoie de B și B de C, pune doar B la A, nu și C).
3. Prerechizitul trebuie să fie dintr-o clasă ≤ clasa țintei. Preferă-l pe cel mai apropiat și
   relevant (de obicei din aceeași clasă sau imediat inferioară). NU pune prerechizite din clase
   MAI MARI decât ținta.
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

// ── Detectare cicluri (DFS pe graful from→to) ────────────────────────────────
function findCycles(n: number, adj: Map<number, number[]>): number[][] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Array(n + 1).fill(WHITE);
  const stack: number[] = [];
  const cycles: number[][] = [];
  const dfs = (u: number) => {
    color[u] = GRAY; stack.push(u);
    for (const v of adj.get(u) ?? []) {
      if (color[v] === WHITE) dfs(v);
      else if (color[v] === GRAY) {
        const i = stack.indexOf(v);
        if (i !== -1) cycles.push(stack.slice(i).concat(v));
      }
    }
    color[u] = BLACK; stack.pop();
  };
  for (const u of adj.keys()) if (color[u] === WHITE) dfs(u);
  return cycles;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({ options: { 'target-grade': { type: 'string' } } });
  const targetGrade = values['target-grade'] ? parseInt(values['target-grade'], 10) : DEFAULT_TARGET_GRADE;
  if (!Number.isInteger(targetGrade) || targetGrade < 1 || targetGrade > 12) {
    console.error(`❌ --target-grade trebuie 1-12 (primit: "${values['target-grade']}")`); process.exit(1);
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
  if (!supabaseUrl || !serviceKey) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = makeClient(supabaseUrl, serviceKey);

  // 1. Citește TOATE conceptele, index 1..N.
  console.log('📥 Citesc toate conceptele din `concepts` …');
  const concepts: Concept[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('concepts')
      .select('id, name, grade_level, subtopic, order_in_grade')
      .order('grade_level', { ascending: true })
      .order('order_in_grade', { ascending: true })
      .order('name', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`Citire concepts: ${error.message}`);
    if (!data || data.length === 0) break;
    concepts.push(...(data as Concept[]));
    if (data.length < 1000) break;
  }
  const N = concepts.length;
  if (N === 0) { console.error('❌ Niciun concept în `concepts`.'); process.exit(1); }
  const gradeOf = (idx1: number) => concepts[idx1 - 1].grade_level; // idx 1-based
  const idOf = (idx1: number) => concepts[idx1 - 1].id;
  const nameOf = (idx1: number) => concepts[idx1 - 1].name;
  const targetIdx = concepts.map((c, i) => (c.grade_level === targetGrade ? i + 1 : 0)).filter((x) => x > 0);
  console.log(`   → ${N} concepte (ID 1..${N}); ${targetIdx.length} ținte (clasa ${targetGrade}).`);

  // 2. Un apel — prerechizite prin ID-uri.
  console.log(`🤖 Cer prerechizitele DIRECTE pentru ${targetIdx.length} ținte (${MODEL})…`);
  const { text, stopReason, inputTokens, outputTokens } = await callModel(anthropic, SYSTEM_PROMPT, buildUserPrompt(concepts, targetGrade, targetIdx));
  if (stopReason === 'max_tokens') console.warn('  ⚠️  Răspuns TRUNCHIAT (max_tokens) — unele ținte pot lipsi.');
  const jsonStr = extractJson(text);
  if (!jsonStr) throw new Error('Modelul nu a întors JSON parsabil.');
  let modelTargets: ModelTarget[];
  try {
    const parsed = JSON.parse(jsonStr) as { targets?: ModelTarget[] };
    modelTargets = Array.isArray(parsed.targets) ? parsed.targets : [];
  } catch (e) { throw new Error(`JSON invalid de la model: ${(e as Error).message}`); }
  console.log(`   → ${modelTargets.length} ținte în răspuns  [in ${inputTokens} / out ${outputTokens} tok]`);

  // 3. Reconstruiește muchiile + VERIFICĂRI STRUCTURALE.
  const targetSet = new Set(targetIdx);
  const edgeKeys = new Set<string>();             // dedup "from-to"
  const edgesIdx: { from: number; to: number; confidence: Confidence; note: string }[] = [];
  const addressedTargets = new Set<number>();
  const problems = {
    invalidTargetId: 0, notATarget: 0, invalidPrereqId: 0, selfLoop: 0, higherGrade: [] as string[], duplicate: 0,
  };

  for (const t of modelTargets) {
    const tId = Number(t.target_id);
    if (!Number.isInteger(tId) || tId < 1 || tId > N) { problems.invalidTargetId++; continue; }
    if (!targetSet.has(tId)) { problems.notATarget++; continue; }
    addressedTargets.add(tId);
    const conf = asConf(t.confidence);
    const note = typeof t.note === 'string' ? t.note : '';
    for (const pId of asIds(t.prereq_ids)) {
      if (pId < 1 || pId > N) { problems.invalidPrereqId++; continue; }
      if (pId === tId) { problems.selfLoop++; continue; }
      if (gradeOf(pId) > gradeOf(tId)) {                                  // muchie spre clasă MAI MARE → invalid
        problems.higherGrade.push(`${nameOf(tId)}(cl.${gradeOf(tId)}) → ${nameOf(pId)}(cl.${gradeOf(pId)})`);
        continue;
      }
      const key = `${tId}-${pId}`;
      if (edgeKeys.has(key)) { problems.duplicate++; continue; }
      edgeKeys.add(key);
      edgesIdx.push({ from: tId, to: pId, confidence: conf, note });
    }
  }

  // Cicluri (DAG) pe graful from→to.
  const adj = new Map<number, number[]>();
  for (const e of edgesIdx) { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from)!.push(e.to); }
  const cycles = findCycles(N, adj);

  // Statistici.
  const crossClass = edgesIdx.filter((e) => gradeOf(e.to) < gradeOf(e.from)).length;
  const inClass = edgesIdx.length - crossClass;
  const rootTargets = targetIdx.filter((ti) => !edgesIdx.some((e) => e.from === ti)); // ținte fără muchie (rădăcini)
  const confDist: Record<string, number> = { high: 0, medium: 0, low: 0 };
  for (const e of edgesIdx) confDist[e.confidence]++;

  // 4. Încarcă în concept_edge_proposals (idempotent: șterge tot înainte).
  const rows: EdgeRow[] = edgesIdx.map((e) => ({
    from_concept: idOf(e.from), to_concept: idOf(e.to), relation: 'prerequisit', confidence: e.confidence, note: e.note,
  }));
  console.log('🧹 Golesc concept_edge_proposals (delete all) …');
  const { error: delErr } = await supabase.from('concept_edge_proposals').delete().not('id', 'is', null);
  if (delErr) throw new Error(`Golire concept_edge_proposals: ${delErr.message}`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('concept_edge_proposals').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Insert muchii [${i}]: ${error.message}`);
    inserted += Math.min(500, rows.length - i);
  }

  // 5. Verificare din DB reală + raport.
  const { count: dbCount } = await supabase.from('concept_edge_proposals').select('*', { count: 'exact', head: true });

  console.log('\n──────── RAPORT MUCHII PRERECHIZIT (ținte clasa ' + targetGrade + ') ────────');
  console.log(`Concepte (noduri):            ${N}  ·  ținte: ${targetIdx.length}`);
  console.log(`Ținte adresate de model:      ${addressedTargets.size} / ${targetIdx.length}`);
  console.log(`Muchii propuse (valide):      ${edgesIdx.length}  ·  inserate în DB: ${dbCount}`);
  console.log(`  ├─ cross-clasă (prereq <):  ${crossClass}`);
  console.log(`  └─ în-clasă (prereq ==):    ${inClass}`);
  console.log(`Ținte-rădăcină (0 prereq):    ${rootTargets.length}`);
  console.log(`Confidence:                   high ${confDist.high} · medium ${confDist.medium} · low ${confDist.low}`);
  console.log(`Tokeni:                       in ${inputTokens} / out ${outputTokens}  ·  ~$${((inputTokens / 1e6) * 3 + (outputTokens / 1e6) * 15).toFixed(4)}`);

  console.log('\n🔎 VERIFICĂRI STRUCTURALE:');
  console.log(`  • indici invalizi: target=${problems.invalidTargetId}, prereq=${problems.invalidPrereqId}; non-țintă=${problems.notATarget}; self-loop=${problems.selfLoop}; dubluri=${problems.duplicate}`);
  if (problems.higherGrade.length === 0) {
    console.log('  ✅ Nicio muchie spre o clasă MAI MARE (prereq.grade ≤ target.grade).');
  } else {
    console.log(`  ❌ ${problems.higherGrade.length} muchii spre clasă mai mare — EXCLUSE: ` +
      problems.higherGrade.slice(0, 8).join(' | ') + (problems.higherGrade.length > 8 ? ' …' : ''));
  }
  if (cycles.length === 0) {
    console.log('  ✅ DAG: niciun ciclu de prerechizit detectat.');
  } else {
    console.log(`  ❌ ${cycles.length} CICLURI detectate (de rezolvat manual):`);
    for (const cyc of cycles.slice(0, 5)) console.log('     ' + cyc.map((i) => nameOf(i)).join(' → '));
  }
  if (dbCount !== rows.length) console.error(`  ❌ DISCREPANȚĂ insert: local ${rows.length} vs DB ${dbCount}.`);

  console.log('\n✅ Doar PROPUNERI (concept_edge_proposals). `concept_edges` reală NU a fost atinsă.');
}

main().catch((err: unknown) => {
  console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err);
  process.exit(1);
});
