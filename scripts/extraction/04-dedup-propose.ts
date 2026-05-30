/**
 * 04-dedup-propose.ts — ETAPA 3.2d: DEDUP CONCEPTE prin ID-uri, granularitate la nivel de NOȚIUNE
 *
 * Rulează:  npm run extract:dedup -- --grade 12
 *           (sau: tsx --env-file=.env.local scripts/extraction/04-dedup-propose.ts --grade 12)
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
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 2000;

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

6. ȚINTĂ pentru această clasă: ~200-350 noduri. Sub 180 = încă prea grosier (ai lăsat noțiuni
   distincte ca sub-puncte) — SPARGE mai mult în noduri. Peste 500 = prea fin (ai pus variante de
   nume ca noduri separate). Calibrează în această fereastră.

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

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({ options: { grade: { type: 'string' } } });
  const grade = values.grade ? parseInt(values.grade, 10) : DEFAULT_GRADE;
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
    console.error(`❌ --grade trebuie să fie un întreg 1-12 (primit: "${values.grade}")`);
    process.exit(1);
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
  if (!supabaseUrl || !serviceKey) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Citește conceptele brute, DISTINCTE după nume (păstrează min pagină + subtema).
  console.log(`📥 Citesc concept_inventory_raw pentru clasa ${grade} …`);
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
  const raw = [...byName.values()].sort((a, b) =>
    (a.first_seen_pdf_page ?? 1e9) - (b.first_seen_pdf_page ?? 1e9) || a.name.localeCompare(b.name, 'ro'));
  const N = raw.length;
  if (N === 0) {
    console.error(`❌ Niciun concept în concept_inventory_raw pentru clasa ${grade}.`);
    process.exit(1);
  }
  console.log(`   → ${N} concepte brute distincte (ID 1..${N}).`);

  // 2. Un singur apel — modelul grupează prin ID-uri.
  console.log(`🤖 Grupare cu ${MODEL} (un apel, apartenență prin ID-uri)…`);
  const { text, stopReason, inputTokens, outputTokens } = await callGrouping(
    anthropic, SYSTEM_PROMPT, buildUserPrompt(grade, raw),
  );
  if (stopReason === 'max_tokens') {
    console.warn('  ⚠️  Răspuns TRUNCHIAT (max_tokens). ID-urile neacoperite devin singletons „neasignat".');
  }
  const jsonStr = extractJson(text);
  if (!jsonStr) throw new Error('Modelul nu a întors JSON parsabil.');
  let modelNodes: ModelNode[];
  try {
    const parsed = JSON.parse(jsonStr) as { nodes?: ModelNode[] };
    modelNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  } catch (e) {
    throw new Error(`JSON invalid de la model: ${(e as Error).message}`);
  }
  console.log(`   → ${modelNodes.length} noduri propuse  [in ${inputTokens} / out ${outputTokens} tok]`);

  // 3. VERIFICARE deterministă a ID-urilor (înainte de a construi orice rând).
  const seen = new Map<number, number>(); // id → de câte ori apare
  let outOfRange = 0;
  const note = (id: number) => seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const nd of modelNodes) {
    for (const id of [...asIds(nd.variant_ids), ...asIds(nd.subpoint_ids)]) {
      if (id < 1 || id > N) { outOfRange++; continue; }
      note(id);
    }
  }
  const duplicates = [...seen.entries()].filter(([, c]) => c > 1).map(([id, c]) => `${id}×${c} ("${raw[id - 1].name}")`);
  if (duplicates.length > 0) {
    console.error(`\n❌ ID-uri DUBLATE de model (${duplicates.length}) — OPRESC, NU încarc nimic:`);
    console.error('   ' + duplicates.slice(0, 50).join(' | ') + (duplicates.length > 50 ? ' …' : ''));
    console.error('   (Re-rulează: gruparea e nedeterministă; o reluare evită de obicei dublarea.)');
    process.exit(1);
  }
  if (outOfRange > 0) console.warn(`   ⚠️  ${outOfRange} ID-uri în afara intervalului 1..${N} — ignorate.`);

  // 4. Construiește rândurile din ID-uri (nume EXACTE din mapare, NU din model).
  const nameOf = (id: number) => raw[id - 1].name;
  const pageOf = (id: number) => raw[id - 1].first_seen_pdf_page;
  const rows: ProposalRow[] = [];
  for (const nd of modelNodes) {
    const variantIds = asIds(nd.variant_ids).filter((id) => id >= 1 && id <= N);
    const subIds = asIds(nd.subpoint_ids).filter((id) => id >= 1 && id <= N);
    if (variantIds.length === 0 && subIds.length === 0) continue;
    const raws = variantIds.map(nameOf);
    const subs = subIds.map(nameOf);
    const pages = [...variantIds, ...subIds].map(pageOf).filter((p): p is number => typeof p === 'number');
    const canonical = (nd.canonical_name ?? '').trim() || raws[0] || subs[0] || '(necunoscut)';
    rows.push({
      grade,
      canonical_name: canonical,
      kind: asKind(nd.kind),
      raw_names: raws,
      variant_count: raws.length,
      sub_points: subs,
      min_pdf_page: pages.length ? Math.min(...pages) : null,
      confidence: asConf(nd.confidence),
      note: typeof nd.note === 'string' ? nd.note : '',
    });
  }

  // ID-uri neasignate de model → singleton cu nume exact (coverage 100% + vezi ce-a ratat).
  let unassigned = 0;
  for (let id = 1; id <= N; id++) {
    if (seen.has(id)) continue;
    unassigned++;
    rows.push({
      grade,
      canonical_name: nameOf(id),
      kind: 'notiune',
      raw_names: [nameOf(id)],
      variant_count: 1,
      sub_points: [],
      min_pdf_page: pageOf(id),
      confidence: 'low',
      note: 'neasignat — verifică',
    });
  }
  rows.sort((a, b) => (a.min_pdf_page ?? 1e9) - (b.min_pdf_page ?? 1e9));

  // 4b. Coverage determinist: reuniunea raw_names + sub_points = exact {1..N} ca multiset de nume.
  const covered = rows.reduce((s, r) => s + r.raw_names.length + r.sub_points.length, 0);
  if (covered !== N) {
    console.error(`\n❌ COVERAGE ${covered}/${N} ≠ N — NU încarc (bug de partiție).`);
    process.exit(1);
  }
  console.log(`✅ Coverage determinist: ${covered}/${N} (fiecare ID exact o dată; ${unassigned} neasignate → singletons).`);

  // 5. Idempotent: TRUNCATE pe grade (delete), apoi inserează.
  console.log(`🧹 Șterg propunerile existente pentru clasa ${grade} …`);
  const { error: delErr } = await supabase.from('concept_dedup_proposals').delete().eq('grade', grade);
  if (delErr) throw new Error(`Ștergere propuneri vechi: ${delErr.message}`);

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('concept_dedup_proposals').insert(batch);
    if (error) throw new Error(`Insert propuneri [${i}..${i + batch.length}]: ${error.message}`);
    inserted += batch.length;
  }

  // 6. Raport.
  const withSubs = rows.filter((r) => r.sub_points.length > 0);
  const totalSubPoints = rows.reduce((s, r) => s + r.sub_points.length, 0);
  const nameMerges = rows.filter((r) => r.variant_count > 1);
  const lowCount = rows.filter((r) => r.confidence === 'low').length;
  const cost = ((inputTokens / 1e6) * 3 + (outputTokens / 1e6) * 15);

  console.log('\n──────── RAPORT DEDUP — ID-BASED (clasa ' + grade + ') ────────');
  console.log(`Concepte brute distincte:     ${N}`);
  console.log(`Noduri canonice (output):     ${rows.length}   →  reducere ${N} → ${rows.length} (-${N - rows.length})`);
  console.log(`  ├─ noduri cu sub_points:    ${withSubs.length}  (${totalSubPoints} sub-puncte)`);
  console.log(`  ├─ noduri cu ≥2 variante:   ${nameMerges.length}`);
  console.log(`  └─ singletons „neasignat":  ${unassigned}`);
  console.log(`Coverage (determinist):       ${covered}/${N}  ·  ID-uri dublate: 0`);
  console.log(`Confidence "low":             ${lowCount}` + (unassigned ? ` (din care ${unassigned} neasignate)` : ''));
  console.log(`Inserat în staging:           ${inserted} rânduri (concept_dedup_proposals, grade=${grade})`);
  console.log(`Tokeni:                       in ${inputTokens} / out ${outputTokens}  ·  ~$${cost.toFixed(4)}`);
  console.log('\nTop 10 noduri-părinte (cele mai multe sub-puncte):');
  for (const r of [...withSubs].sort((a, b) => b.sub_points.length - a.sub_points.length).slice(0, 10)) {
    console.log(`  • ${r.canonical_name}  [${r.kind}, ${r.confidence}] · ${r.sub_points.length} sub: ${r.sub_points.join(', ')}`);
  }
  if (unassigned > 0) {
    console.log(`\n⚠️  ${unassigned} concepte NEASIGNATE de model (singletons „neasignat — verifică"):`);
    for (const r of rows.filter((r) => r.note === 'neasignat — verifică').slice(0, 30)) {
      console.log(`  • ${r.canonical_name}`);
    }
  }
  console.log('\n✅ Doar PROPUNERI. Tabela `concepts` reală NU a fost atinsă. Aprobă tu înainte de orice contopire definitivă.');
}

main().catch((err) => {
  console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err);
  process.exit(1);
});
