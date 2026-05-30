/**
 * 04-dedup-propose.ts — ETAPA 3.2b: DEDUP CONCEPTE, GRANULARITATE MEDIE + TRASABILITATE EXACTĂ
 *
 * Rulează:  npm run extract:dedup -- --grade 12
 *           (sau: tsx --env-file=.env.local scripts/extraction/04-dedup-propose.ts --grade 12)
 *
 * Ce face:
 *   1. Citește conceptele brute ale unei clase din concept_inventory_raw
 *      (name + first_seen_pdf_page + subtopic).
 *   2. Trimite ÎNTREAGA listă numerotată la claude-sonnet-4-6 la GRANULARITATE MEDIE
 *      (un nod = o unitate predabilă). Două mecanisme, ambele păstrează TOT:
 *        (a) variante de nume → un nume canonic;
 *        (b) consolidare părinte-copil → proprietățile/cazurile/sub-formulele aceluiași
 *            concept devin SUB-PUNCTE (sub_points) în nodul-părinte, nu noduri separate.
 *      Modelul întoarce noduri prin INDECȘI (nu re-scrie textul) → compact, fără pierderi.
 *   3. raw_names (de nod ȘI de sub-punct) sunt copiate VERBATIM după indecși — niciun text
 *      rescris/scurtat. "label"-ul sub-punctului e doar afișare, separat de numele original.
 *   4. VERIFICĂ acoperirea 100% ÎNAINTE de încărcare: aplatizează raw_names + sub_points și
 *      compară ca multiset cu lista de intrare. Dacă lipsește/se dublează ceva → OPREȘTE,
 *      raportează, NU încarcă date incomplete. Apoi încarcă în concept_dedup_proposals
 *      (idempotent: șterge propunerile clasei înainte de reinserare).
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

/** Un sub-punct al unui nod (proprietate / caz / sub-formulă), așa cum îl întoarce modelul. */
interface ModelSubPoint {
  label: string;
  members: number[]; // indecșii bruți care formează acest sub-punct
}

/** Nod brut, așa cum îl întoarce modelul (membri = indecși în lista trimisă). */
interface ModelGroup {
  canonical_name: string;
  kind: string;
  members: number[];          // indecșii care sunt VARIANTE DE NUME ale nodului-părinte
  sub_points?: ModelSubPoint[]; // sub-proprietăți/sub-formule consolidate sub acest nod
  confidence: string;
  note?: string;
}

/** Sub-punct salvat (lossless: păstrăm și textul brut). */
interface SubPoint {
  label: string;
  raw_names: string[];
}

interface ProposalRow {
  grade: number;
  canonical_name: string;
  kind: Kind;
  raw_names: string[];     // variantele de NUME ale nodului
  variant_count: number;   // = raw_names.length (variante de nume ale părintelui)
  sub_points: SubPoint[];  // sub-proprietăți/sub-formule (granularitate medie)
  min_pdf_page: number | null;
  confidence: Confidence;
  note: string;
}

// ── Prompt (română, STRICT JSON) ─────────────────────────────────────────────
const SYSTEM_PROMPT =
  'Ești terminolog de matematică școlară (curriculum BAC Republica Moldova). Primești o ' +
  'listă NUMEROTATĂ de concepte extrase brut dintr-un manual și le organizezi la ' +
  'GRANULARITATE MEDIE: un nod = o unitate predabilă (cât o lecție). Variantele de nume se ' +
  'contopesc, iar sub-proprietățile/sub-formulele/cazurile aceluiași concept devin SUB-PUNCTE ' +
  'în nodul-părinte, NU noduri separate. Răspunzi EXCLUSIV cu obiectul JSON cerut — fără proză, ' +
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

SARCINĂ: organizează indicii la GRANULARITATE MEDIE — un nod = o unitate predabilă (cât o lecție).
Folosește DOUĂ mecanisme, ambele păstrează TOT (niciun concept aruncat):
  (a) Variante de nume → un singur nume canonic (ca înainte).
  (b) Consolidare părinte-copil → proprietățile/cazurile/sub-formulele aceluiași concept predabil
      devin SUB-PUNCTE în nodul-părinte, nu noduri separate.

Întoarce STRICT un singur obiect JSON, exact în forma:
{
  "groups": [
    {
      "canonical_name": "<nume canonic SCURT și corect (terminologie BAC MD)>",
      "kind": "notiune" | "definitie" | "teorema" | "formula" | "procedeu",
      "members": [<indecșii care sunt VARIANTE DE NUME ale acestui nod; [] dacă nodul e doar părinte>],
      "sub_points": [
        { "label": "<etichetă scurtă de afișare>", "members": [<indecșii bruți ai acestui sub-punct>] }
      ],
      "confidence": "high" | "medium" | "low",
      "note": "<gol sau o remarcă scurtă>"
    }
  ]
}

TRASABILITATE (CRUCIAL): te referi la concepte DOAR prin INDEX (numărul [i]) — NU rescrie, NU
scurta, NU traduce textul conceptelor. Sistemul copiază automat numele EXACT original (verbatim
din listă) în raw_names, după indecșii pe care îi dai. "label" e doar o etichetă scurtă de
afișare pentru sub-punct; ea NU înlocuiește textul original (acela e păstrat separat prin index).

REGULI OBLIGATORII:

1. PARTIȚIE COMPLETĂ (constrângere DURĂ): reuniunea TUTUROR indecșilor din toate "members"
   (de nod ȘI de sub_points) trebuie să fie EXACT mulțimea {0, 1, …, ${raw.length - 1}} —
   fiecare index apare EXACT O DATĂ. Nimic omis, nimic dublat. Verifică tu însuți înainte de a răspunde.

2. Variante de nume (members ale nodului): singular/plural, diacritice sparte/lipsă, ordine de
   cuvinte; "metoda X" = "X" = "formula lui X" când denumesc același lucru;
   "primitivă" = "primitivă a unei funcții" = "primitiva unei funcții".

3. Consolidare părinte-copil (sub_points) — NOU. Când mai multe concepte sunt proprietăți, cazuri,
   sub-formule sau instanțe ale ACELUIAȘI concept predabil, pune-le ca sub_points sub un părinte:
   - "proprietatea de aditivitate/liniaritate/monotonie/invarianța semnului a integralei definite"
     → nod-părinte "proprietățile integralei definite", sub_points: aditivitate, liniaritate,
       monotonie, invarianța semnului.
   - "asimptotă verticală/orizontală/oblică"
     → nod-părinte "asimptotele unei funcții", sub_points: verticală, orizontală, oblică.
   Dacă nodul-părinte NU există ca text brut în listă, inventează-i canonical_name și lasă
   "members": [] (toate cele brute intră în sub_points).

4. GRANULARITATE: un nod = o unitate cât o lecție, NU o singură proprietate sau formulă izolată.
   DAR nu exagera: NU consolida concepte GENUIN INDEPENDENTE doar fiindcă împart o subtemă —
   doar relații REALE părinte-copil / proprietate-a / caz-al. Concepte mari, de sine stătătoare
   (ex. "integrală definită" vs "integrală nedefinită") rămân noduri SEPARATE, nu sub-puncte unul
   al altuia.

5. canonical_name și label: forma scurtă, corectă, terminologia BAC MD, cu diacritice corecte.

6. confidence pe nod: "high" = sigur de gruparea/consolidarea făcută; "low" = nesigur (atunci NU
   consolida agresiv — lasă separat și explică în note).

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
  type GGroup = {
    canonical_name: string;
    kind: string;
    members: number[];                                   // indecși GLOBALI: variante de nume
    sub_points: { label: string; members: number[] }[];  // indecși GLOBALI per sub-punct
    confidence: string;
    note: string;
  };
  const groups: GGroup[] = [];

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
      if (stopReason !== 'max_tokens') console.log(`${localGroups.length} noduri  [in ${it} / out ${ot}]`);
    } catch (e) {
      // Secțiune eșuată (parse/rețea) → NU oprim tot; conceptele ei devin singletons.
      console.log(`❌ ${(e as Error)?.message ?? e} → secțiune ca singletons`);
      localGroups = [];
    }

    // Mapare local→global cu PARTIȚIE peste members ȘI sub_points (fiecare index o dată).
    const claim = (li: unknown): number | null => {
      const n = Number(li);
      if (!Number.isInteger(n) || n < 0 || n >= sub.length) { invalidRefs++; return null; }
      const gi = globalIdx[n];
      if (assigned.has(gi)) { duplicateRefs++; return null; }
      assigned.add(gi);
      return gi;
    };

    for (const g of localGroups) {
      const members: number[] = [];
      for (const m of Array.isArray(g.members) ? g.members : []) {
        const gi = claim(m);
        if (gi !== null) members.push(gi);
      }
      const subPoints: { label: string; members: number[] }[] = [];
      for (const sp of Array.isArray(g.sub_points) ? g.sub_points : []) {
        const spMembers: number[] = [];
        for (const m of Array.isArray(sp?.members) ? sp.members : []) {
          const gi = claim(m);
          if (gi !== null) spMembers.push(gi);
        }
        if (spMembers.length === 0) continue;
        const lbl = (sp?.label ?? '').toString().trim();
        subPoints.push({ label: lbl !== '' ? lbl : raw[spMembers[0]].name, members: spMembers });
      }
      if (members.length === 0 && subPoints.length === 0) continue;
      groups.push({
        canonical_name: (g.canonical_name ?? '').trim(),
        kind: g.kind,
        members,
        sub_points: subPoints,
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
      sub_points: [],
      confidence: 'low',
      note: 'not_grouped_by_model',
    });
  }
  if (invalidRefs || duplicateRefs || recovered) {
    console.log(`   ⚠️  validare: ${invalidRefs} indecși invalizi, ${duplicateRefs} dubli ignorați, ` +
      `${recovered} concepte negrupate → singletons.`);
  }

  // 4. Construiește rândurile finale (canonical + sub_points lossless).
  const rows: ProposalRow[] = groups.map((g) => {
    const raws = g.members.map((i) => raw[i].name);
    const subPoints: SubPoint[] = g.sub_points.map((sp) => ({
      label: sp.label,
      raw_names: sp.members.map((i) => raw[i].name),
    }));
    const allIdx = [...g.members, ...g.sub_points.flatMap((sp) => sp.members)];
    const pages = allIdx.map((i) => raw[i].first_seen_pdf_page).filter((p): p is number => typeof p === 'number');
    const canonical = g.canonical_name !== '' ? g.canonical_name : (raws[0] ?? subPoints[0]?.raw_names[0] ?? '(necunoscut)');
    return {
      grade,
      canonical_name: canonical,
      kind: asKind(g.kind),
      raw_names: raws,
      variant_count: raws.length,
      sub_points: subPoints,
      min_pdf_page: pages.length ? Math.min(...pages) : null,
      confidence: asConf(g.confidence),
      note: g.note,
    };
  });
  rows.sort((a, b) => (a.min_pdf_page ?? 1e9) - (b.min_pdf_page ?? 1e9));

  // 4b. VERIFICARE ACOPERIRE 100% ÎNAINTE de încărcare (principiul „nimic aruncat").
  // Aplatizez raw_names + sub_points[].raw_names și compar ca MULTISET cu lista de intrare.
  // Dacă lipsește sau se dublează ceva → OPRESC, NU încarc date incomplete.
  const inputCounts = new Map<string, number>();
  for (const c of raw) inputCounts.set(c.name, (inputCounts.get(c.name) ?? 0) + 1);
  const flatCounts = new Map<string, number>();
  let flatTotal = 0;
  for (const r of rows) {
    for (const n of r.raw_names) { flatCounts.set(n, (flatCounts.get(n) ?? 0) + 1); flatTotal++; }
    for (const sp of r.sub_points) for (const n of sp.raw_names) { flatCounts.set(n, (flatCounts.get(n) ?? 0) + 1); flatTotal++; }
  }
  const missing: string[] = [];
  for (const [name, cnt] of inputCounts) {
    const got = flatCounts.get(name) ?? 0;
    if (got < cnt) missing.push(`"${name}" (×${cnt - got})`);
  }
  const duplicated: string[] = [];
  for (const [name, cnt] of flatCounts) {
    const exp = inputCounts.get(name) ?? 0;
    if (cnt > exp) duplicated.push(`"${name}" (+${cnt - exp})`);
  }
  if (missing.length || duplicated.length || flatTotal !== raw.length) {
    console.error(`\n❌ ACOPERIRE INCOMPLETĂ — NU încarc nimic. Aplatizat ${flatTotal} vs input ${raw.length}.`);
    if (missing.length) console.error(`   LIPSESC (${missing.length}): ${missing.slice(0, 40).join(' | ')}${missing.length > 40 ? ' …' : ''}`);
    if (duplicated.length) console.error(`   DUBLATE (${duplicated.length}): ${duplicated.slice(0, 40).join(' | ')}${duplicated.length > 40 ? ' …' : ''}`);
    console.error('   (Date incomplete NU se scriu în staging. Re-rulează.)');
    process.exit(1);
  }
  console.log(`✅ Acoperire verificată ÎNAINTE de încărcare: ${flatTotal}/${raw.length} ` +
    `(toate numele brute, verbatim, fiecare exact o dată).`);

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
  const nameMerges = rows.filter((r) => r.variant_count > 1);
  const withSubs = rows.filter((r) => r.sub_points.length > 0);
  const totalSubPoints = rows.reduce((s, r) => s + r.sub_points.length, 0);
  const rawInSubPoints = rows.reduce((s, r) => s + r.sub_points.reduce((t, sp) => t + sp.raw_names.length, 0), 0);
  const rawInNames = rows.reduce((s, r) => s + r.raw_names.length, 0);
  const cost = ((inputTokens / 1e6) * 3 + (outputTokens / 1e6) * 15);

  console.log('\n──────── RAPORT DEDUP — GRANULARITATE MEDIE (clasa ' + grade + ') ────────');
  console.log(`Secțiuni (apeluri model):     ${chunks.length}`);
  console.log(`Concepte brute (input):       ${N}`);
  console.log(`Noduri canonice (output):     ${rows.length}   →  reducere ${N} → ${rows.length} (-${N - rows.length})`);
  console.log(`  ├─ noduri cu sub_points:    ${withSubs.length}`);
  console.log(`  ├─ total sub-puncte:        ${totalSubPoints}`);
  console.log(`  └─ noduri cu ≥2 variante de nume: ${nameMerges.length}`);
  console.log(`Acoperire brută (lossless):   ${rawInNames} ca variante de nume + ${rawInSubPoints} în sub-puncte ` +
    `= ${rawInNames + rawInSubPoints} / ${N}`);
  console.log(`Confidence "low":             ${lowCount}`);
  console.log(`Inserat în staging:           ${inserted} rânduri (concept_dedup_proposals, grade=${grade})`);
  console.log(`Tokeni:                       in ${inputTokens} / out ${outputTokens}  ·  ~$${cost.toFixed(4)}`);
  console.log('\nTop 10 noduri-părinte (cele mai multe sub-puncte):');
  for (const r of [...withSubs].sort((a, b) => b.sub_points.length - a.sub_points.length).slice(0, 10)) {
    console.log(`  • ${r.canonical_name}  [${r.kind}, ${r.confidence}] · ${r.sub_points.length} sub-puncte: ` +
      r.sub_points.map((sp) => sp.label).join(', '));
  }
  console.log('\n✅ Doar PROPUNERI. Tabela `concepts` reală NU a fost atinsă. Aprobă tu înainte de orice contopire definitivă.');
}

main().catch((err) => {
  console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err);
  process.exit(1);
});
