/**
 * 04-dedup-propose.ts — ETAPA 3.4: DEDUP CONCEPTE prin ID-uri, granularitate la nivel de NOȚIUNE
 *
 * Rulează:  npm run extract:dedup -- --grade 12
 *           npm run extract:dedup -- --grades 1-11      (mai multe clase într-o rulare)
 *           (sau: tsx --env-file=.env.local scripts/extraction/04-dedup-propose.ts --grades 1-11)
 *
 * Granularitate independentă de clasă: gardă DURĂ ≤ 9 sub-puncte/nod; retry pe dubluri de ID
 * sau noduri prea grosiere. VERIFICARE din DB reală după fiecare clasă (coverage + max sub-puncte).
 *
 * De ce ID-uri: a cere modelului să copieze 736 de nume verbatim e fragil — le „curăță"
 * (rescrie/scurtează). Soluție: modelul grupează DOAR prin NUMERE (ID-uri 1..N); numele se
 * reatașează DETERMINIST din maparea index→nume_exact ținută în script. Modelul nu emite
 * niciodată textul unui concept brut — doar canonical_name (eticheta nodului) și kind.
 *
 * Flux:
 *   1. Citește conceptele brute DISTINCTE ale clasei din concept_inventory_raw, atribuie
 *      fiecăruia un ID 1..N (mapare ID→nume_exact + first_seen_pdf_page + subtopic).
 *   2. Trimite o listă NUMEROTATĂ la claude-sonnet-4-6; modelul întoarce STRICT JSON cu noduri
 *      la GRANULARITATE MEDIE: { canonical_name, kind, variant_ids[], subpoint_ids[], confidence, note }.
 *   3. Scriptul reconstruiește raw_names + sub_points din ID-uri (nume EXACT din inventar).
 *   4. VERIFICARE deterministă: reuniunea variant_ids + subpoint_ids = exact {1..N}, fiecare o dată.
 *      - ID dublat → EROARE, oprește, raportează (NU încarcă).
 *      - ID neasignat de model → nod singleton (nume exact, confidence "low", note "neasignat — verifică").
 *   5. Încarcă în concept_dedup_proposals (idempotent: TRUNCATE pe grade înainte).
 *
 * NU atinge tabela `concepts` reală. Doar propuneri — nimic definitiv până la aprobarea umană.
 *
 * Requires: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

// ── Config ───────────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 32000;          // output e doar numere + canonical_names → compact
const DEFAULT_GRADE = 12;
const MAX_RETRIES = 4;             // retry rețea/rate-limit per apel
const BASE_BACKOFF_MS = 2000;
const MAX_GROUP_ATTEMPTS = 5;      // reîncercări grupare la dubluri de ID sau granularitate prea grosieră
const MAX_SUBPOINTS = 9;           // gardă grade-independentă: niciun nod > 9 sub-puncte

const VALID_KINDS = ['notiune', 'definitie', 'teorema', 'formula', 'procedeu'] as const;
const VALID_CONF = ['high', 'medium', 'low'] as const;
type Kind = (typeof VALID_KINDS)[number];
type Confidence = (typeof VALID_CONF)[number];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Tipuri ───────────────────────────────────────────────────────────────────
interface RawConcept {
  name: string;
  first_seen_pdf_page: number | null;
  subtopic: string | null;
}

/** Nod întors de model — apartenența e DOAR prin ID-uri (1..N), niciun nume de concept brut. */
interface ModelNode {
  canonical_name: string;
  kind: string;
  variant_ids: number[];   // ID-uri care sunt VARIANTE DE NUME ale nodului
  subpoint_ids: number[];  // ID-uri care sunt sub-proprietăți/sub-formule/cazuri
  confidence: string;
  note?: string;
}

interface ProposalRow {
  grade: number;
  canonical_name: string;
  kind: Kind;
  raw_names: string[];     // nume EXACTE (verbatim) reconstruite din variant_ids
  variant_count: number;   // = raw_names.length
  sub_points: string[];    // nume EXACTE (verbatim) reconstruite din subpoint_ids
  min_pdf_page: number | null;
  confidence: Confidence;
  note: string;
}

// ── Prompt (română, STRICT JSON) ─────────────────────────────────────────────
const SYSTEM_PROMPT =
  'Ești terminolog de matematică școlară (curriculum BAC Republica Moldova). Primești o listă ' +
  'NUMEROTATĂ de concepte și le organizezi la nivel de NOȚIUNE: un nod = O SINGURĂ noțiune ' +
  'predabilă (cât o definiție/subsecțiune, un termen pe care manualul îl definește explicit), ' +
  'NU un capitol întreg. Te referi la concepte EXCLUSIV prin numărul lor (ID) — NU scrii, NU ' +
  'rescrii, NU repeta textul conceptelor în răspuns. Răspunzi EXCLUSIV cu obiectul JSON cerut — ' +
  'fără proză, fără markdown, fără ```.';

function buildUserPrompt(grade: number, raw: RawConcept[]): string {
  const lines = raw
    .map((c, i) => {
      const page = c.first_seen_pdf_page ?? '—';
      const sub = c.subtopic ? ` · ${c.subtopic}` : '';
      return `${i + 1}. ${c.name}  (p.${page}${sub})`;
    })
    .join('\n');
  const N = raw.length;

  return `Clasa ${grade}. Mai jos sunt ${N} concepte brute, NUMEROTATE 1..${N}, fiecare cu pagina și (uneori) subtema.

LISTA:
${lines}

SARCINĂ: organizează ID-urile la nivel de NOȚIUNE — un nod = O SINGURĂ noțiune predabilă (cât o
definiție/subsecțiune, un termen pe care manualul îl definește explicit), NU un capitol întreg.
Două mecanisme, ambele păstrează TOT (niciun ID aruncat):
  (a) Variante de nume → același nod (variant_ids).
  (b) Sub-puncte → DOAR proprietățile/formulele/cazurile/sub-tipurile ALE ACELEI noțiuni devin
      subpoint_ids ale ei (ex. sub "asimptotele unei funcții": verticală/orizontală/oblică).
      sub_points NU sunt lecții întregi și NU adună noțiuni-surori sub un antet.

Întoarce STRICT un singur obiect JSON, exact în forma:
{
  "nodes": [
    {
      "canonical_name": "<nume canonic SCURT și corect (terminologie BAC MD)>",
      "kind": "notiune" | "definitie" | "teorema" | "formula" | "procedeu",
      "variant_ids": [<ID-uri care sunt variante de nume ale acestui nod; [] dacă nodul e doar părinte>],
      "subpoint_ids": [<ID-uri ale sub-proprietăților/sub-formulelor/cazurilor acestui nod>],
      "confidence": "high" | "medium" | "low",
      "note": "<gol sau o remarcă scurtă>"
    }
  ]
}

REGULI OBLIGATORII:

1. PARTIȚIE COMPLETĂ (constrângere DURĂ): reuniunea TUTUROR ID-urilor din toate "variant_ids" ȘI
   "subpoint_ids" trebuie să fie EXACT mulțimea {1, 2, …, ${N}} — fiecare ID apare EXACT O DATĂ în
   tot răspunsul. Nimic omis, nimic dublat. Verifică tu însuți înainte de a răspunde.

2. Folosește DOAR numere (ID-uri) pentru apartenență. NU scrie numele conceptelor brute nicăieri.
   Singurele texte libere sunt "canonical_name" (eticheta nodului) și "note".

3. Variante de nume (variant_ids): singular/plural, diacritice sparte/lipsă, ordine de cuvinte;
   "metoda X" = "X" = "formula lui X" când denumesc același lucru;
   "primitivă" = "primitivă a unei funcții" = "primitiva unei funcții".

4. Sub-puncte (subpoint_ids) — TEST STRICT. Un ID e sub-punct DOAR dacă e un caz/proprietate/
   parametru/sub-tip ÎNGUST al noțiunii-părinte și NU are sens ca lecție/definiție de sine
   stătătoare. Exemple corecte de sub-puncte: "verticală/orizontală/oblică" sub „asimptotă";
   "aria laterală"/"aria totală"/"volumul" sub „con"; "bazele"/"înălțimea"/"muchiile" sub „prismă".
   DACĂ manualul DEFINEȘTE termenul ca noțiune proprie (are nume de sine stătător: „eșantion",
   „ortocentru", „monom", „paralelipiped", „cub", „mediană", „histogramă", „variabilă statistică"),
   atunci e NOD PROPRIU, NU sub-punct — chiar dacă apare în aceeași secțiune.
   Dacă noțiunea-părinte a sub-punctelor NU există ca ID, inventează-i canonical_name, variant_ids: [].

5. GRANULARITATE FINĂ (noțiune, nu capitol):
   - Un nod e MAI FIN decât o secțiune. O secțiune conține tipic 2-5 noțiuni DISTINCTE — fiecare
     e nodul ei, NU sub-punct al unui antet comun.
   - INTERZIS canonical_name de tip antet/secțiune: NU folosi "și"/virgulă care înșiră mai multe
     noțiuni, NU folosi prefixe-umbrelă ca "Elemente de …", "Noțiuni de …", "… și părțile sale".
     Exemple GREȘITE (nu face așa), cu spargerea CORECTĂ:
     ✗ "Elemente de geometrie a triunghiului" → ✓ "ortocentru", "centru de greutate", "mediană",
        "bisectoarea triunghiului", "mediatoare", "cerc circumscris", "cerc înscris" = noduri.
     ✗ "Populație statistică și eșantion" → ✓ "populație statistică", "eșantion", "sondaj",
        "variabilă statistică", "caracteristică statistică" = noduri.
     ✗ "Polinom" cu 11 sub → ✓ "polinom", "monom", "gradul unui polinom", "rădăcina polinomului" = noduri.
     ✗ "Integrala definită — noțiune și funcții integrabile" → ✓ "integrală definită", "sumă Riemann",
        "funcție integrabilă", "diviziune a intervalului" = noduri.
   - canonical_name = exact O noțiune.
   - Totuși NU contopi noțiuni mari independente (ex. "integrală definită" ≠ "integrală nedefinită").

6. GRANULARITATE (independentă de clasă — NU țintă un număr fix de noduri):
   - GARDĂ DURĂ: NICIUN nod nu trebuie să aibă peste 9 sub-puncte. Dacă un nod ar ajunge la ≥10,
     e lump de CAPITOL — sparge-l în noțiuni distincte (fiecare devine nodul ei).
   - În medie ~1-3 sub-puncte per nod. Multe noțiuni stau singure (0 sub-puncte).
   - Un "sub-punct" e doar o proprietate/caz/sub-tip ÎNGUST al unei singure noțiuni; dacă termenul
     e el însuși o noțiune definită de manual, scoate-l ca NOD propriu, nu ca sub-punct.

7. canonical_name: scurt, corect, terminologia BAC MD, cu diacritice corecte.
   confidence: "high" = sigur; "low" = nesigur (atunci explică în note).

Răspunde DOAR cu obiectul JSON.`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}

const asKind = (v: unknown): Kind => (VALID_KINDS.includes(v as Kind) ? (v as Kind) : 'notiune');
const asConf = (v: unknown): Confidence => (VALID_CONF.includes(v as Confidence) ? (v as Confidence) : 'low');

/** Apel model cu retry/backoff; streaming (output potențial mare). */
async function callGrouping(anthropic: Anthropic, system: string, user: string) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const msg = await stream.finalMessage();
      const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      return {
        text,
        stopReason: msg.stop_reason,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      };
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retriable =
        status === undefined || status === 408 || status === 409 || status === 429 ||
        status === 529 || (typeof status === 'number' && status >= 500);
      if (!retriable || attempt === MAX_RETRIES) break;
      const backoff = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 500);
      console.warn(`  ↻ retry ${attempt + 1}/${MAX_RETRIES} (status=${status ?? 'net'}) după ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

/** Normalizează un array de ID-uri întregi din ce a întors modelul. */
function asIds(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v) {
    const n = Number(x);
    if (Number.isInteger(n)) out.push(n);
  }
  return out;
}

// ── Per-clasă ────────────────────────────────────────────────────────────────
interface GradeReport {
  grade: number;
  N: number;
  nodes: number;
  dbCovered: number;
  maxSub: number;
  unassigned: number;
  cost: number;
  ok: boolean;
  problems: string[];
}

const costOf = (inTok: number, outTok: number) => (inTok / 1e6) * 3 + (outTok / 1e6) * 15;

// Tip concret al clientului (ReturnType<typeof createClient> ar folosi genericii impliciti → `never`).
function makeClient(url: string, key: string) {
  return createClient(url, key);
}
type Db = ReturnType<typeof makeClient>;

/** Citește conceptele brute DISTINCTE ale unei clase (mapare ID 1..N → nume exact). */
async function readConcepts(supabase: Db, grade: number): Promise<RawConcept[]> {
  const all: RawConcept[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('concept_inventory_raw')
      .select('name, first_seen_pdf_page, subtopic')
      .eq('grade', grade)
      .order('first_seen_pdf_page', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Citire concept_inventory_raw: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as RawConcept[]));
    if (data.length < PAGE) break;
  }
  const byName = new Map<string, RawConcept>();
  for (const r of all) {
    const ex = byName.get(r.name);
    if (!ex) byName.set(r.name, { ...r });
    else if (r.first_seen_pdf_page != null && (ex.first_seen_pdf_page == null || r.first_seen_pdf_page < ex.first_seen_pdf_page)) {
      ex.first_seen_pdf_page = r.first_seen_pdf_page;
      ex.subtopic = r.subtopic;
    }
  }
  return [...byName.values()].sort((a, b) =>
    (a.first_seen_pdf_page ?? 1e9) - (b.first_seen_pdf_page ?? 1e9) || a.name.localeCompare(b.name, 'ro'));
}

/** Un apel de grupare validat: fără ID-uri dublate. Întoarce nodurile + harta `seen` + max sub-puncte. */
interface Attempt { modelNodes: ModelNode[]; seen: Map<number, number>; maxSub: number; }
function evaluateAttempt(modelNodes: ModelNode[], N: number): { attempt: Attempt; dupCount: number; outOfRange: number } {
  const seen = new Map<number, number>();
  let outOfRange = 0;
  for (const nd of modelNodes) {
    for (const id of [...asIds(nd.variant_ids), ...asIds(nd.subpoint_ids)]) {
      if (id < 1 || id > N) { outOfRange++; continue; }
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
  }
  const dupCount = [...seen.values()].filter((c) => c > 1).length;
  let maxSub = 0;
  for (const nd of modelNodes) maxSub = Math.max(maxSub, asIds(nd.subpoint_ids).filter((id) => id >= 1 && id <= N).length);
  return { attempt: { modelNodes, seen, maxSub }, dupCount, outOfRange };
}

/** Rulează dedup-ul pe O clasă: retry la dubluri/granularitate, încărcare, verificare din DB. */
async function runGrade(anthropic: Anthropic, supabase: Db, grade: number): Promise<GradeReport> {
  console.log(`\n════════════ CLASA ${grade} ════════════`);
  const raw = await readConcepts(supabase, grade);
  const N = raw.length;
  if (N === 0) {
    return { grade, N: 0, nodes: 0, dbCovered: 0, maxSub: 0, unassigned: 0, cost: 0, ok: false, problems: ['niciun concept în concept_inventory_raw'] };
  }
  console.log(`📥 ${N} concepte brute distincte (ID 1..${N}).`);

  // Retry: reîncearcă la ID-uri dublate SAU la max sub-puncte > MAX_SUBPOINTS. Păstrează cea mai bună.
  let inTok = 0, outTok = 0;
  let best: Attempt | null = null;
  for (let attempt = 1; attempt <= MAX_GROUP_ATTEMPTS; attempt++) {
    const { text, stopReason, inputTokens, outputTokens } = await callGrouping(anthropic, SYSTEM_PROMPT, buildUserPrompt(grade, raw));
    inTok += inputTokens; outTok += outputTokens;
    if (stopReason === 'max_tokens') console.warn('  ⚠️  Răspuns TRUNCHIAT (max_tokens).');
    const jsonStr = extractJson(text);
    let modelNodes: ModelNode[] = [];
    try {
      const parsed = jsonStr ? (JSON.parse(jsonStr) as { nodes?: ModelNode[] }) : {};
      modelNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    } catch (e) {
      console.warn(`  ↻ încercarea ${attempt}/${MAX_GROUP_ATTEMPTS}: JSON invalid (${(e as Error).message}) — reîncerc`);
      continue;
    }
    const { attempt: att, dupCount, outOfRange } = evaluateAttempt(modelNodes, N);
    if (dupCount > 0) {
      console.warn(`  ↻ încercarea ${attempt}/${MAX_GROUP_ATTEMPTS}: ${dupCount} ID-uri dublate — reîncerc  [in ${inputTokens}/out ${outputTokens}]`);
      continue;
    }
    console.log(`  încercarea ${attempt}: ${modelNodes.length} noduri, max_sub=${att.maxSub}` +
      `${outOfRange ? `, ${outOfRange} ID out-of-range` : ''}  [in ${inputTokens}/out ${outputTokens}]`);
    if (!best || att.maxSub < best.maxSub) best = att;
    if (att.maxSub <= MAX_SUBPOINTS) break;
    console.warn(`  ↻ max_sub ${att.maxSub} > ${MAX_SUBPOINTS} (lump de capitol) — reîncerc pentru granularitate mai fină`);
  }

  if (!best) {
    console.error(`  ❌ Clasa ${grade}: toate încercările au eșuat (dubluri/JSON invalid) — NU încarc.`);
    return { grade, N, nodes: 0, dbCovered: 0, maxSub: 0, unassigned: 0, cost: costOf(inTok, outTok), ok: false, problems: ['toate încercările au eșuat (dubluri/JSON invalid)'] };
  }

  const { modelNodes, seen } = best;
  const nameOf = (id: number) => raw[id - 1].name;
  const pageOf = (id: number) => raw[id - 1].first_seen_pdf_page;

  // Construiește rândurile din ID-uri (nume EXACTE din mapare).
  const rows: ProposalRow[] = [];
  for (const nd of modelNodes) {
    const variantIds = asIds(nd.variant_ids).filter((id) => id >= 1 && id <= N);
    const subIds = asIds(nd.subpoint_ids).filter((id) => id >= 1 && id <= N);
    if (variantIds.length === 0 && subIds.length === 0) continue;
    const raws = variantIds.map(nameOf);
    const subs = subIds.map(nameOf);
    const pages = [...variantIds, ...subIds].map(pageOf).filter((p): p is number => typeof p === 'number');
    rows.push({
      grade,
      canonical_name: (nd.canonical_name ?? '').trim() || raws[0] || subs[0] || '(necunoscut)',
      kind: asKind(nd.kind),
      raw_names: raws,
      variant_count: raws.length,
      sub_points: subs,
      min_pdf_page: pages.length ? Math.min(...pages) : null,
      confidence: asConf(nd.confidence),
      note: typeof nd.note === 'string' ? nd.note : '',
    });
  }
  // ID-uri neasignate → singleton cu nume exact.
  let unassigned = 0;
  for (let id = 1; id <= N; id++) {
    if (seen.has(id)) continue;
    unassigned++;
    rows.push({
      grade, canonical_name: nameOf(id), kind: 'notiune', raw_names: [nameOf(id)], variant_count: 1,
      sub_points: [], min_pdf_page: pageOf(id), confidence: 'low', note: 'neasignat — verifică',
    });
  }
  rows.sort((a, b) => (a.min_pdf_page ?? 1e9) - (b.min_pdf_page ?? 1e9));

  const coveredLocal = rows.reduce((s, r) => s + r.raw_names.length + r.sub_points.length, 0);
  if (coveredLocal !== N) {
    return { grade, N, nodes: rows.length, dbCovered: 0, maxSub: best.maxSub, unassigned, cost: costOf(inTok, outTok), ok: false, problems: [`partiție internă ${coveredLocal}/${N}`] };
  }

  // Idempotent: TRUNCATE pe grade, apoi insert.
  const { error: delErr } = await supabase.from('concept_dedup_proposals').delete().eq('grade', grade);
  if (delErr) throw new Error(`Ștergere propuneri vechi (grade ${grade}): ${delErr.message}`);
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from('concept_dedup_proposals').insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(`Insert propuneri (grade ${grade}) [${i}]: ${error.message}`);
  }

  // ── VERIFICARE din DB REALĂ (round-trip) ──────────────────────────────────
  interface DbRow { raw_names: string[]; sub_points: string[] }
  const dbRows: DbRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('concept_dedup_proposals')
      .select('raw_names, sub_points')
      .eq('grade', grade)
      .range(from, from + 999);
    if (error) throw new Error(`Citire verificare (grade ${grade}): ${error.message}`);
    if (!data || data.length === 0) break;
    dbRows.push(...(data as DbRow[]));
    if (data.length < 1000) break;
  }
  const dbNodes = dbRows.length;
  const dbCovered = dbRows.reduce((s, r) => s + (r.raw_names?.length ?? 0) + (r.sub_points?.length ?? 0), 0);
  const dbMaxSub = dbRows.reduce((m, r) => Math.max(m, r.sub_points?.length ?? 0), 0);

  const problems: string[] = [];
  if (dbCovered !== N) problems.push(`coverage DB ${dbCovered}/${N} INCOMPLET`);
  if (dbMaxSub > MAX_SUBPOINTS) problems.push(`max sub-puncte ${dbMaxSub} > ${MAX_SUBPOINTS}`);
  const ok = problems.length === 0;

  const withSubs = rows.filter((r) => r.sub_points.length > 0);
  console.log(`✅ Inserat ${dbNodes} noduri (reducere ${N} → ${dbNodes}). Neasignate: ${unassigned}. ~$${costOf(inTok, outTok).toFixed(4)}`);
  console.log(`   🔎 VERIFICARE DB clasa ${grade}: noduri=${dbNodes} · coverage=${dbCovered}/${N} · max_sub=${dbMaxSub} · noduri cu sub=${withSubs.length}` +
    `  →  ${ok ? '✅ OK' : '❌ PROBLEMĂ: ' + problems.join('; ')}`);

  return { grade, N, nodes: dbNodes, dbCovered, maxSub: dbMaxSub, unassigned, cost: costOf(inTok, outTok), ok, problems };
}

// ── Parse --grades ("1-11" | "1,2,5" | mixt) ─────────────────────────────────
function parseGrades(spec: string | undefined, fallback: number): number[] {
  if (!spec) return [fallback];
  const set = new Set<number>();
  for (const tokRaw of spec.split(',')) {
    const tok = tokRaw.trim();
    if (!tok) continue;
    const m = tok.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { let a = +m[1], b = +m[2]; if (a > b) [a, b] = [b, a]; for (let g = a; g <= b; g++) set.add(g); }
    else if (/^\d+$/.test(tok)) set.add(+tok);
    else throw new Error(`Token --grades invalid: "${tok}"`);
  }
  const grades = [...set].filter((g) => g >= 1 && g <= 12).sort((a, b) => a - b);
  if (grades.length === 0) throw new Error('--grades nu conține nicio clasă validă (1..12).');
  return grades;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({ options: { grade: { type: 'string' }, grades: { type: 'string' } } });
  const grades = values.grades
    ? parseGrades(values.grades, DEFAULT_GRADE)
    : [values.grade ? parseInt(values.grade, 10) : DEFAULT_GRADE];
  for (const g of grades) {
    if (!Number.isInteger(g) || g < 1 || g > 12) {
      console.error(`❌ clasă invalidă: ${g} (trebuie 1-12)`);
      process.exit(1);
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
  if (!supabaseUrl || !serviceKey) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = makeClient(supabaseUrl, serviceKey);

  console.log(`🎯 Dedup pentru clasele: [${grades.join(', ')}]  (max ${MAX_SUBPOINTS} sub-puncte/nod, retry ≤${MAX_GROUP_ATTEMPTS})`);
  const reports: GradeReport[] = [];
  for (const g of grades) {
    try {
      reports.push(await runGrade(anthropic, supabase, g));
    } catch (e) {
      console.error(`💥 Clasa ${g} a eșuat: ${(e as Error)?.message ?? e}`);
      reports.push({ grade: g, N: 0, nodes: 0, dbCovered: 0, maxSub: 0, unassigned: 0, cost: 0, ok: false, problems: [(e as Error)?.message ?? 'eroare'] });
    }
  }

  // ── SUMAR (din DB reală) ──────────────────────────────────────────────────
  console.log('\n════════════ SUMAR (verificat din DB) ════════════');
  for (const r of reports) {
    console.log(`${r.ok ? '✅' : '❌'} Clasa ${String(r.grade).padStart(2)} · ${String(r.nodes).padStart(3)} noduri · ` +
      `coverage ${r.dbCovered}/${r.N} · max_sub ${r.maxSub} · neasignate ${r.unassigned}` +
      (r.problems.length ? `  →  ${r.problems.join('; ')}` : ''));
  }
  const totalCost = reports.reduce((s, r) => s + r.cost, 0);
  const failed = reports.filter((r) => !r.ok);
  console.log(`Cost total: ~$${totalCost.toFixed(4)}`);
  console.log('\n✅ Doar PROPUNERI (concept_dedup_proposals). `concepts` reală NU a fost atinsă.');
  if (failed.length > 0) {
    console.error(`\n⚠️  ${failed.length} clasă/clase cu PROBLEME — NU „gata": [${failed.map((r) => r.grade).join(', ')}]. Re-rulează doar pe ele.`);
    process.exitCode = 1;
  } else {
    console.log(`🎉 Toate ${reports.length} clasele: coverage complet și max sub-puncte ≤ ${MAX_SUBPOINTS}.`);
  }
}

main().catch((err) => {
  console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err);
  process.exit(1);
});
