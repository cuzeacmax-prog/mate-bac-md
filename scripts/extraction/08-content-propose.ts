/**
 * 08-content-propose.ts — ETAPA 6/6b: PROBĂ extracție CONȚINUT al nodurilor (AI propune)
 *
 * 6b: source_pages = paginile TUTUROR componentelor conceptului (name + raw_names + sub_points,
 *     via concept_dedup_proposals + concept_inventory_raw.first_seen_pdf_page), nu doar prima apariție.
 *
 * Rulează:  npm run extract:content -- --grade 12 --from-page 60 --to-page 66
 *           (sau: tsx --env-file=.env.local scripts/extraction/08-content-propose.ts)
 *
 * Felie de probă: conceptele clasei --grade cu order_in_grade în [from-page, to-page].
 * Pentru fiecare concept:
 *   1. Randează cu MuPDF paginile sale sursă (order_in_grade ± 1, clamp) la ~150 DPI.
 *   2. Vision (claude-sonnet-4-6): paginile + numele conceptului + sub_points → STRICT JSON cu
 *      definiție / formule LaTeX / condiții / 1 exemplu rezolvat. NU inventează; câmp gol dacă lipsește.
 *   3. Scrie în concept_content_proposals (idempotent pe felie). NU atinge `concepts`.body.
 *
 * Requires: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPdfForRender } from './01-inventory';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-6';
const DEFAULT_GRADE = 12;
const DEFAULT_FROM = 60;
const DEFAULT_TO = 66;
const DPI = 150;            // mai mare ca inventarul (130) — formulele mici lizibile
const MAX_TOKENS = 4000;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const VALID_CONF = ['high', 'medium', 'low'] as const;
type Confidence = (typeof VALID_CONF)[number];
const asConf = (v: unknown): Confidence => (VALID_CONF.includes(v as Confidence) ? (v as Confidence) : 'low');
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);

interface SliceConcept {
  id: string;
  name: string;
  order_in_grade: number;
  sub_points: string[];
}
interface ContentRow {
  concept_id: string;
  definitie: string;
  formule_latex: string[];
  conditii: string;
  exemplu: string;
  confidence: Confidence;
  source_pages: number[];
}

function makeClient(url: string, key: string) { return createClient(url, key); }

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}

const SYSTEM_PROMPT =
  'Ești un extractor de conținut din manuale de matematică (BAC Republica Moldova). Primești ' +
  'IMAGINILE paginilor unde apare un anumit concept și extragi DOAR conținutul ACELUI concept, ' +
  'în format JSON strict. Formulele se dau în LaTeX. NU inventezi nimic care nu e pe pagină — ' +
  'dacă un câmp lipsește, îl lași gol. Răspunzi EXCLUSIV cu obiectul JSON, fără proză, fără ```.';

function buildUserPrompt(name: string, subPoints: string[]): string {
  const subs = subPoints.length ? `Sub-puncte (părți ale conceptului): ${subPoints.join('; ')}.` : 'Fără sub-puncte listate.';
  return `Conceptul de extras: „${name}".
${subs}

Din imaginile paginilor de mai sus, extrage DOAR conținutul acestui concept (ignoră restul paginii).
Întoarce STRICT un singur obiect JSON, exact cu cheile:
{
  "definitie": "<definiția sau enunțul, text curat în română; gol dacă nu apare>",
  "formule_latex": ["<formulele relevante în LaTeX, ex. \\\\int_a^b f(x)\\\\,dx>"],
  "conditii": "<condiții/ipoteze dacă există; gol altfel>",
  "exemplu": "<UN exemplu rezolvat scurt dacă apare pe pagină: enunț + pașii esențiali; gol altfel>",
  "confidence": "high" | "medium" | "low"
}

REGULI:
1. NU inventa conținut care nu e pe pagină. Dacă ceva lipsește, lasă câmpul gol ("" sau []).
2. Formulele în LaTeX valid (fără $...$, doar corpul). Păstrează notația din manual.
3. Păstrează terminologia și diacriticele exact ca în manual (română-moldovenească).
4. confidence: "high" = conținutul e clar și complet pe pagină; "low" = parțial/ambiguu.

Răspunde DOAR cu obiectul JSON.`;
}

async function callVision(anthropic: Anthropic, images: string[], name: string, subPoints: string[]) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const content: Anthropic.Messages.ContentBlockParam[] = images.map((b64) => ({
        type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 },
      }));
      content.push({ type: 'text', text: buildUserPrompt(name, subPoints) });
      const msg = await anthropic.messages.create({
        model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      });
      const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      return { text, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retriable = status === undefined || status === 408 || status === 409 || status === 429 || status === 529 || (typeof status === 'number' && status >= 500);
      if (!retriable || attempt === MAX_RETRIES) break;
      const backoff = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 500);
      console.warn(`    ↻ retry ${attempt + 1}/${MAX_RETRIES} (status=${status ?? 'net'}) după ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

async function main() {
  const { values } = parseArgs({ options: { grade: { type: 'string' }, 'from-page': { type: 'string' }, 'to-page': { type: 'string' } } });
  const grade = values.grade ? parseInt(values.grade, 10) : DEFAULT_GRADE;
  const fromPage = values['from-page'] ? parseInt(values['from-page'], 10) : DEFAULT_FROM;
  const toPage = values['to-page'] ? parseInt(values['to-page'], 10) : DEFAULT_TO;
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) { console.error('❌ --grade 1-12'); process.exit(1); }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
  if (!supabaseUrl || !serviceKey) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = makeClient(supabaseUrl, serviceKey);

  // 1. Felia de concepte.
  console.log(`📥 Felie: clasa ${grade}, order_in_grade ∈ [${fromPage}, ${toPage}] …`);
  const { data, error } = await supabase
    .from('concepts')
    .select('id, name, order_in_grade, sub_points')
    .eq('grade_level', grade)
    .gte('order_in_grade', fromPage)
    .lte('order_in_grade', toPage)
    .order('order_in_grade', { ascending: true });
  if (error) throw new Error(`Citire concepts: ${error.message}`);
  const slice: SliceConcept[] = (data ?? []).map((c) => ({
    id: c.id as string, name: c.name as string, order_in_grade: (c.order_in_grade as number) ?? 0,
    sub_points: Array.isArray(c.sub_points) ? (c.sub_points as string[]) : [],
  }));
  if (slice.length === 0) { console.error('❌ Niciun concept în felie.'); process.exit(1); }
  console.log(`   → ${slice.length} concepte: ${slice.map((c) => `${c.name} (p.${c.order_in_grade})`).join(' · ')}`);

  // 1b. Sursare CORECTĂ — paginile din TOATE componentele conceptului (nu doar prima apariție).
  //   dedupMap: canonical_name → raw_names (variantele de nume ale nodului).
  const dedupMap = new Map<string, string[]>();
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await supabase.from('concept_dedup_proposals').select('canonical_name, raw_names').eq('grade', grade).range(from, from + 999);
    if (e) throw new Error(`Citire concept_dedup_proposals: ${e.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as { canonical_name: string; raw_names: unknown }[]) dedupMap.set(r.canonical_name, asStrArr(r.raw_names));
    if (data.length < 1000) break;
  }
  //   rawPageMap: nume exact din inventar → min first_seen_pdf_page.
  const rawPageMap = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await supabase.from('concept_inventory_raw').select('name, first_seen_pdf_page').eq('grade', grade).range(from, from + 999);
    if (e) throw new Error(`Citire concept_inventory_raw: ${e.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as { name: string; first_seen_pdf_page: number | null }[]) {
      if (r.first_seen_pdf_page == null) continue;
      const ex = rawPageMap.get(r.name);
      if (ex == null || r.first_seen_pdf_page < ex) rawPageMap.set(r.name, r.first_seen_pdf_page);
    }
    if (data.length < 1000) break;
  }

  // 2. Deschide PDF-ul (MuPDF, 150 DPI).
  const pdfPath = path.resolve(__dirname, `../../docs/manuale-source/clasa-${String(grade).padStart(2, '0')}.pdf`);
  console.log(`📄 Deschid ${pdfPath} la ${DPI} DPI (MuPDF) …`);
  const doc = await openPdfForRender(pdfPath, DPI);
  const pageCount = doc.length;

  // source_pages = paginile TUTUROR componentelor (name + raw_names + sub_points), fiecare ±1.
  const sourcePagesFor = (c: SliceConcept): number[] => {
    const components = new Set<string>([c.name, ...(dedupMap.get(c.name) ?? []), ...c.sub_points]);
    const pages = new Set<number>();
    for (const nm of components) {
      const pg = rawPageMap.get(nm);
      if (pg != null) for (const d of [-1, 0, 1]) pages.add(pg + d);
    }
    if (pages.size === 0) for (const d of [-1, 0, 1]) pages.add(c.order_in_grade + d); // fallback
    return [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  };

  // Idempotent: șterge propunerile de conținut existente pentru conceptele feliei.
  await supabase.from('concept_content_proposals').delete().in('concept_id', slice.map((c) => c.id));

  let totalIn = 0, totalOut = 0;
  const rows: ContentRow[] = [];
  for (const c of slice) {
    const pages = sourcePagesFor(c);
    process.stdout.write(`  📄 „${c.name}" · pagini [${pages.join(', ')}] … `);
    const images = pages.map((p) => doc.getPage(p).toString('base64'));
    const { text, inputTokens, outputTokens } = await callVision(anthropic, images, c.name, c.sub_points);
    totalIn += inputTokens; totalOut += outputTokens;

    const jsonStr = extractJson(text);
    let row: ContentRow;
    if (!jsonStr) {
      row = { concept_id: c.id, definitie: '', formule_latex: [], conditii: '', exemplu: '', confidence: 'low', source_pages: pages };
      console.log(`⚠️  fără JSON  [in ${inputTokens}/out ${outputTokens}]`);
    } else {
      try {
        const o = JSON.parse(jsonStr) as Record<string, unknown>;
        row = {
          concept_id: c.id,
          definitie: asStr(o.definitie),
          formule_latex: asStrArr(o.formule_latex),
          conditii: asStr(o.conditii),
          exemplu: asStr(o.exemplu),
          confidence: asConf(o.confidence),
          source_pages: pages,
        };
        console.log(`✓ def ${row.definitie.length}c · ${row.formule_latex.length} formule · ` +
          `${row.exemplu ? 'exemplu' : 'fără exemplu'} · conf=${row.confidence}  [in ${inputTokens}/out ${outputTokens}]`);
      } catch {
        row = { concept_id: c.id, definitie: '', formule_latex: [], conditii: '', exemplu: '', confidence: 'low', source_pages: pages };
        console.log(`⚠️  JSON invalid  [in ${inputTokens}/out ${outputTokens}]`);
      }
    }
    rows.push(row);
  }

  // 3. Inserează.
  const { error: insErr } = await supabase.from('concept_content_proposals').insert(rows);
  if (insErr) throw new Error(`Insert concept_content_proposals: ${insErr.message}`);

  // 4. Verificare DB + raport.
  const { count } = await supabase.from('concept_content_proposals').select('*', { count: 'exact', head: true })
    .in('concept_id', slice.map((c) => c.id));
  const cost = (totalIn / 1e6) * 3 + (totalOut / 1e6) * 15;
  console.log('\n──────── RAPORT CONȚINUT (felie clasa ' + grade + ', pg ' + fromPage + '-' + toPage + ') ────────');
  console.log(`Concepte procesate:    ${slice.length}  (inserate în DB: ${count})`);
  console.log(`Cu definiție:          ${rows.filter((r) => r.definitie).length}`);
  console.log(`Cu formule LaTeX:      ${rows.filter((r) => r.formule_latex.length > 0).length}  (total ${rows.reduce((s, r) => s + r.formule_latex.length, 0)} formule)`);
  console.log(`Cu exemplu:            ${rows.filter((r) => r.exemplu).length}`);
  console.log(`Confidence:            high ${rows.filter((r) => r.confidence === 'high').length} · medium ${rows.filter((r) => r.confidence === 'medium').length} · low ${rows.filter((r) => r.confidence === 'low').length}`);
  console.log(`Tokeni:                in ${totalIn} / out ${totalOut}  ·  ~$${cost.toFixed(4)}`);
  console.log('\n✅ Doar PROPUNERI (concept_content_proposals). `concepts`.body NU a fost atins.');
}

main().catch((err: unknown) => {
  console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err);
  process.exit(1);
});
