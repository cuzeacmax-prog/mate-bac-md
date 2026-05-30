/**
 * 04-dedup-propose.ts — ETAPA 3.1: DEDUP CONCEPTE (AI propune, omul aprobă)
 *
 * Rulează:  npm run extract:dedup -- --grade 12
 *           (sau: tsx --env-file=.env.local scripts/extraction/04-dedup-propose.ts --grade 12)
 *
 * Ce face:
 *   1. Citește conceptele brute ale unei clase din concept_inventory_raw
 *      (name + first_seen_pdf_page + subtopic).
 *   2. Trimite ÎNTREAGA listă numerotată la claude-sonnet-4-6 și cere GRUPAREA
 *      variantelor de formulare ale ACELUIAȘI concept (NU contopește concepte distincte).
 *      Modelul întoarce grupuri prin INDECȘI (nu re-scrie textul) → output compact, fără pierderi.
 *   3. Validează acoperirea (fiecare concept apare exact o dată); conceptele negrupate
 *      devin grupuri-singleton (confidence "low", note "not_grouped_by_model").
 *   4. Încarcă propunerile în staging-ul concept_dedup_proposals.
 *      Idempotent: șterge propunerile clasei înainte de reinserare.
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
const MAX_TOKENS = 16000;          // per secțiune (output compact prin indecși)
const DEFAULT_GRADE = 12;
// Lista întreagă într-un apel poate trunchia output-ul (ex. clasa 12 = 736 concepte).
// Atunci împărțim pe SECȚIUNI (granițe de subtopic — fără să rupem grupuri legate).
const MAX_CONCEPTS_PER_CALL = 250; // prag soft; tăiem doar la schimbare de subtopic
const HARD_CAP_PER_CALL = 450;     // cap dur, ca o secțiune uriașă să nu scape
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

/** Grup brut, așa cum îl întoarce modelul (membri = indecși în lista trimisă). */
interface ModelGroup {
  canonical_name: string;
  kind: string;
  members: number[];
  confidence: string;
  note?: string;
}

interface ProposalRow {
  grade: number;
  canonical_name: string;
  kind: Kind;
  raw_names: string[];
  variant_count: number;
  min_pdf_page: number | null;
  confidence: Confidence;
  note: string;
}

// ── Prompt (română, STRICT JSON) ─────────────────────────────────────────────
const SYSTEM_PROMPT =
  'Ești terminolog de matematică școlară (curriculum BAC Republica Moldova). Primești o ' +
  'listă NUMEROTATĂ de concepte extrase brut dintr-un manual și grupezi DOAR variantele de ' +
  'formulare ale ACELUIAȘI concept. Răspunzi EXCLUSIV cu obiectul JSON cerut — fără proză, ' +
  'fără markdown, fără ```.';

function buildUserPrompt(grade: number, raw: RawConcept[]): string {
  const lines = raw
    .map((c, i) => {
      const page = c.first_seen_pdf_page ?? '—';
      const sub = c.subtopic ? ` · ${c.subtopic}` : '';
      return `[${i}] ${c.name}  (p.${page}${sub})`;
    })
    .join('\n');

  return `Clasa ${grade}. Mai jos sunt ${raw.length} concepte brute, fiecare cu un INDEX [i], pagina și (uneori) subtema.

LISTA:
${lines}

SARCINĂ: grupează indicii care denumesc ACELAȘI concept (doar variante de formulare).

Întoarce STRICT un singur obiect JSON, exact în forma:
{
  "groups": [
    {
      "canonical_name": "<nume canonic SCURT și corect (terminologie BAC MD)>",
      "kind": "notiune" | "definitie" | "teorema" | "formula" | "procedeu",
      "members": [<indecșii din listă care intră în acest grup>],
      "confidence": "high" | "medium" | "low",
      "note": "<gol sau o remarcă scurtă>"
    }
  ]
}

REGULI OBLIGATORII:

1. PARTIȚIE COMPLETĂ: fiecare index din 0 până la ${raw.length - 1} trebuie să apară în EXACT UN
   singur grup. Un concept care stă singur formează un grup cu un singur membru.

2. Grupează DOAR variante de formulare ale ACELUIAȘI concept:
   - singular/plural, diacritice sparte sau lipsă, ordine de cuvinte;
   - "metoda X" = "X" = "formula lui X" CÂND denumesc același lucru;
   - "primitivă" = "primitivă a unei funcții" = "primitiva unei funcții".

3. NU contopi concepte GENUIN DISTINCTE chiar dacă numele seamănă. Păstrează SEPARAT (exemple):
   - "asimptotă verticală la dreapta" ≠ "...la stînga" ≠ "asimptotă orizontală" ≠ "asimptotă oblică";
   - "arie laterală" ≠ "arie totală";
   - "integrală definită" ≠ "integrală nedefinită".
   Diferența de sens (poziție, tip, domeniu) înseamnă concepte diferite, nu variante.

4. canonical_name: forma scurtă, corectă, în terminologia tipărită în manualele BAC MD.
   Păstrează diacriticele corecte (scrie "asimptotă", nu "asimptota").

5. Dacă NU ești sigur că doi termeni sunt același concept, NU-i contopi: lasă-i în grupuri
   separate, pune confidence "low" și explică pe scurt în note de ce ai ezitat.

6. confidence pe grup: "high" = sigur că toate variantele sunt același concept; "low" = nesigur.

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

/**
 * Împarte lista (deja ordonată după pagină) în secțiuni de cel mult ~MAX_CONCEPTS_PER_CALL,
 * tăind DOAR la schimbare de subtopic → nu rupem un subtopic (grup legat) între apeluri.
 * Întoarce array-uri de indecși GLOBALI. O singură secțiune dacă lista e mică.
 */
function sectionChunks(raw: RawConcept[]): number[][] {
  if (raw.length <= MAX_CONCEPTS_PER_CALL) return [raw.map((_, i) => i)];
  const chunks: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    cur.push(i);
    const boundary = i + 1 >= raw.length || raw[i + 1].subtopic !== raw[i].subtopic;
    if ((cur.length >= MAX_CONCEPTS_PER_CALL && boundary) || cur.length >= HARD_CAP_PER_CALL) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

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

  // 1. Citește conceptele brute ale clasei (paginat, ca să nu lovim plafonul de 1000).
  console.log(`📥 Citesc concept_inventory_raw pentru clasa ${grade} …`);
  const raw: RawConcept[] = [];
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
    raw.push(...(data as RawConcept[]));
    if (data.length < PAGE) break;
  }
  if (raw.length === 0) {
    console.error(`❌ Niciun concept în concept_inventory_raw pentru clasa ${grade}.`);
    process.exit(1);
  }
  console.log(`   → ${raw.length} concepte brute.`);

  // 2. Grupare — un apel dacă lista încape, altfel pe secțiuni (granițe de subtopic).
  const N = raw.length;
  const chunks = sectionChunks(raw);
  console.log(`🤖 Grupare cu ${MODEL}: ${chunks.length} ${chunks.length === 1 ? 'apel' : 'secțiuni'} ` +
    `(≤ ${MAX_CONCEPTS_PER_CALL} concepte/secțiune, tăiate la subtopic).`);

  const assigned = new Set<number>(); // indecși GLOBALI deja plasați
  let duplicateRefs = 0;
  let invalidRefs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const groups: { canonical_name: string; kind: string; members: number[]; confidence: string; note: string }[] = [];

  for (let c = 0; c < chunks.length; c++) {
    const globalIdx = chunks[c];                       // local i → globalIdx[i]
    const sub = globalIdx.map((gi) => raw[gi]);
    const label = `secțiunea ${c + 1}/${chunks.length} (${sub.length} concepte)`;
    process.stdout.write(`  • ${label} … `);

    let localGroups: ModelGroup[] = [];
    try {
      const { text, stopReason, inputTokens: it, outputTokens: ot } = await callGrouping(
        anthropic, SYSTEM_PROMPT, buildUserPrompt(grade, sub),
      );
      inputTokens += it;
      outputTokens += ot;
      if (stopReason === 'max_tokens') {
        console.log(`⚠️  TRUNCHIAT — concepte negrupate → singletons  [in ${it} / out ${ot}]`);
      }
      const jsonStr = extractJson(text);
      const parsed = jsonStr ? (JSON.parse(jsonStr) as { groups?: ModelGroup[] }) : {};
      localGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
      if (stopReason !== 'max_tokens') console.log(`${localGroups.length} grupuri  [in ${it} / out ${ot}]`);
    } catch (e) {
      // Secțiune eșuată (parse/rețea) → NU oprim tot; conceptele ei devin singletons.
      console.log(`❌ ${(e as Error)?.message ?? e} → secțiune ca singletons`);
      localGroups = [];
    }

    // Validare locală + mapare la indecși globali.
    for (const g of localGroups) {
      const members: number[] = [];
      for (const m of Array.isArray(g.members) ? g.members : []) {
        const li = Number(m);
        if (!Number.isInteger(li) || li < 0 || li >= sub.length) { invalidRefs++; continue; }
        const gi = globalIdx[li];
        if (assigned.has(gi)) { duplicateRefs++; continue; }
        assigned.add(gi);
        members.push(gi);
      }
      if (members.length === 0) continue;
      groups.push({
        canonical_name: (g.canonical_name ?? '').trim(),
        kind: g.kind,
        members,
        confidence: g.confidence,
        note: typeof g.note === 'string' ? g.note : '',
      });
    }
  }

  // 3. Acoperire globală: orice concept neplasat (negrupat/secțiune eșuată) → singleton.
  let recovered = 0;
  for (let i = 0; i < N; i++) {
    if (assigned.has(i)) continue;
    recovered++;
    groups.push({
      canonical_name: raw[i].name,
      kind: 'notiune',
      members: [i],
      confidence: 'low',
      note: 'not_grouped_by_model',
    });
  }
  if (invalidRefs || duplicateRefs || recovered) {
    console.log(`   ⚠️  validare: ${invalidRefs} indecși invalizi, ${duplicateRefs} dubli ignorați, ` +
      `${recovered} concepte negrupate → singletons.`);
  }

  // 4. Construiește rândurile finale.
  const rows: ProposalRow[] = groups.map((g) => {
    const raws = g.members.map((i) => raw[i].name);
    const pages = g.members.map((i) => raw[i].first_seen_pdf_page).filter((p): p is number => typeof p === 'number');
    const canonical = g.canonical_name !== '' ? g.canonical_name : raws[0];
    return {
      grade,
      canonical_name: canonical,
      kind: asKind(g.kind),
      raw_names: raws,
      variant_count: raws.length,
      min_pdf_page: pages.length ? Math.min(...pages) : null,
      confidence: asConf(g.confidence),
      note: g.note,
    };
  });
  rows.sort((a, b) => (a.min_pdf_page ?? 1e9) - (b.min_pdf_page ?? 1e9));

  // 5. Idempotent: șterge propunerile clasei, apoi inserează.
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
  const lowCount = rows.filter((r) => r.confidence === 'low').length;
  const merges = rows.filter((r) => r.variant_count > 1);
  const variantsInMerges = merges.reduce((s, r) => s + r.variant_count, 0);
  const cost = ((inputTokens / 1e6) * 3 + (outputTokens / 1e6) * 15);

  console.log('\n──────── RAPORT DEDUP (clasa ' + grade + ') ────────');
  console.log(`Secțiuni (apeluri model):   ${chunks.length}`);
  console.log(`Concepte brute (input):     ${N}`);
  console.log(`Concepte canonice (output): ${rows.length}`);
  console.log(`  ├─ grupuri cu ≥2 variante: ${merges.length} (au absorbit ${variantsInMerges} brute)`);
  console.log(`  └─ singletons (1 variantă): ${rows.length - merges.length}`);
  console.log(`Reducere:                   ${N} → ${rows.length}  (-${N - rows.length})`);
  console.log(`Confidence "low":           ${lowCount}`);
  console.log(`Inserat în staging:         ${inserted} rânduri (concept_dedup_proposals, grade=${grade})`);
  console.log(`Tokeni:                     in ${inputTokens} / out ${outputTokens}  ·  ~$${cost.toFixed(4)}`);
  console.log('\nTop 10 grupări (cele mai multe variante):');
  for (const r of [...merges].sort((a, b) => b.variant_count - a.variant_count).slice(0, 10)) {
    console.log(`  • ${r.canonical_name}  [${r.kind}, ${r.confidence}] ← ${r.raw_names.length}: ${r.raw_names.join(' | ')}`);
  }
  console.log('\n✅ Doar PROPUNERI. Tabela `concepts` reală NU a fost atinsă. Aprobă tu înainte de orice contopire definitivă.');
}

main().catch((err) => {
  console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err);
  process.exit(1);
});
