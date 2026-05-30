/**
 * 08-content-propose.ts — ETAPA 6/6b/6c/7: extracție CONȚINUT al nodurilor (AI propune)
 *
 * Rulează:  npm run extract:content -- --grades 12
 *           npm run extract:content -- --grades 1-11
 *           (probă pe o felie: --grades 12 --from-page 60 --to-page 66)
 *
 * BATCH API (50%): o cerere per concept (custom_id = concept_id), UN batch per clasă
 *   (chunked sub limita de 256 MB — imaginile sunt mari). claude-sonnet-4-6.
 * 6b: source_pages = paginile TUTUROR componentelor (name + raw_names + sub_points →
 *     first_seen_pdf_page din concept_inventory_raw), nu doar prima apariție.
 * 6c: prompt ancorat pe conceptul NUMIT (definiție + prima formulă sunt ale lui; sub_points secundare).
 *
 * NU atinge `concepts`.body. Doar propuneri în concept_content_proposals.
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
const DPI = 150;
const MAX_TOKENS = 8000;       // 7b: ridicat de la 4000 — concepte dense trunchiau JSON-ul
const MAX_PAGES_PER_CONCEPT = 8;       // plafon pagini/concept (mărimea cererii)
const BATCH_MAX_BYTES = 150 * 1024 * 1024; // margine sub 256 MB / batch
const BATCH_MAX_REQUESTS = 1000;       // chunk-uri rezonabile
const POLL_INTERVAL_MS = 20_000;
const BATCH_MAX_WAIT_MS = 24 * 60 * 60 * 1000;
const PRICE_IN = 3, PRICE_OUT = 15, BATCH_DISCOUNT = 0.5;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const VALID_CONF = ['high', 'medium', 'low'] as const;
type Confidence = (typeof VALID_CONF)[number];
const asConf = (v: unknown): Confidence => (VALID_CONF.includes(v as Confidence) ? (v as Confidence) : 'low');
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);

interface Concept { id: string; name: string; order_in_grade: number; sub_points: string[] }
interface ContentRow { concept_id: string; definitie: string; formule_latex: string[]; conditii: string; exemplu: string; confidence: Confidence; source_pages: number[]; note: string }
type BatchRequest = Anthropic.Messages.BatchCreateParams.Request;

function makeClient(url: string, key: string) { return createClient(url, key); }
type Db = ReturnType<typeof makeClient>;

// Structured output via TOOL USE — elimina ambiguitatea escape-urilor LaTeX in JSON text.
const CONTENT_TOOL: Anthropic.Messages.Tool = {
  name: 'record_content',
  description: 'Inregistreaza continutul extras al conceptului matematic numit.',
  input_schema: {
    type: 'object',
    properties: {
      definitie: { type: 'string', description: 'Definitia/enuntul conceptului NUMIT mai intai, apoi sub-aspectele.' },
      formule_latex: { type: 'array', items: { type: 'string' }, description: 'Formule LaTeX; PRIMA e a conceptului numit.' },
      conditii: { type: 'string' },
      exemplu: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['definitie', 'formule_latex', 'conditii', 'exemplu', 'confidence'],
  },
};

/** Extrage ContentRow din blocul tool_use (input deja parsat de SDK — fara JSON manual, fara probleme de escaping). */
function rowFromContent(content: Anthropic.Messages.ContentBlock[], conceptId: string, pages: number[], note: string): ContentRow | null {
  const tu = content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
  if (!tu) return null;
  const o = (tu.input ?? {}) as Record<string, unknown>;
  return { concept_id: conceptId, definitie: asStr(o.definitie), formule_latex: asStrArr(o.formule_latex), conditii: asStr(o.conditii), exemplu: asStr(o.exemplu), confidence: asConf(o.confidence), source_pages: pages, note };
}

// ── Prompt (ancorat pe conceptul numit — 6c) ─────────────────────────────────
const SYSTEM_PROMPT =
  'Ești un extractor de conținut din manuale de matematică (BAC Republica Moldova). Primești ' +
  'IMAGINILE paginilor sursă și extragi conținutul unui concept ANUME. Conduci MEREU cu ' +
  'conceptul NUMIT: definiția și prima formulă trebuie să fie ALE LUI; sub-punctele sunt ' +
  'sub-aspecte secundare, acoperite DUPĂ conținutul de bază. Formulele în LaTeX. NU inventezi ' +
  'nimic care nu e pe pagină — câmp gol dacă lipsește. Înregistrezi rezultatul EXCLUSIV prin ' +
  'tool-ul record_content.';

function buildUserPrompt(name: string, subPoints: string[]): string {
  const subs = subPoints.length
    ? `Sub-aspecte de acoperit DUPĂ conținutul principal (sub-secțiuni, NU subiectul central): ${subPoints.join('; ')}.`
    : 'Fără sub-aspecte listate.';
  return `Concept PRINCIPAL (numit): „${name}".
${subs}

Caută în TOATE imaginile paginilor de mai sus DEFINIȚIA și FORMULA CENTRALĂ ale conceptului numit
(pot fi pe o pagină ulterioară, nu neapărat prima). Extrage conținutul ANCORAT pe acest nume și
înregistrează-l prin tool-ul record_content.

REGULI:
1. ANCORARE: definitie + PRIMA formulă din formule_latex trebuie să fie ALE CONCEPTULUI NUMIT,
   NU ale unui sub-aspect. Dacă un sub-aspect diverge de nume, tot îl acoperi pe scurt, dar NU el conduce.
2. NU inventa conținut care nu e pe pagini. Dacă ceva lipsește, lasă câmpul gol ("" sau []).
3. Formulele în LaTeX valid (fără $...$, doar corpul). Păstrează notația din manual.
4. Păstrează terminologia și diacriticele exact ca în manual (română-moldovenească).
5. confidence: "high" = conținutul conceptului numit e clar pe pagini; "low" = parțial/ambiguu.`;
}

function buildRequest(conceptId: string, images: string[], name: string, subPoints: string[]): BatchRequest {
  const content: Anthropic.Messages.ContentBlockParam[] = images.map((b64) => ({
    type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 },
  }));
  content.push({ type: 'text', text: buildUserPrompt(name, subPoints) });
  return { custom_id: conceptId, params: { model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, tools: [CONTENT_TOOL], tool_choice: { type: 'tool', name: 'record_content' }, messages: [{ role: 'user', content }] } };
}

/** Retry SYNC pe un singur concept (tool use). Întoarce rândul + tokeni, sau null. */
async function syncExtract(anthropic: Anthropic, images: string[], name: string, subPoints: string[], conceptId: string, pages: number[]): Promise<{ row: ContentRow; inTok: number; outTok: number } | null> {
  const content: Anthropic.Messages.ContentBlockParam[] = images.map((b64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } }));
  content.push({ type: 'text', text: buildUserPrompt(name, subPoints) });
  try {
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, tools: [CONTENT_TOOL], tool_choice: { type: 'tool', name: 'record_content' }, messages: [{ role: 'user', content }] });
    const row = rowFromContent(msg.content, conceptId, pages, '');
    return row ? { row, inTok: msg.usage.input_tokens, outTok: msg.usage.output_tokens } : null;
  } catch { return null; }
}

async function pollBatch(anthropic: Anthropic, id: string, label: string): Promise<Anthropic.Messages.MessageBatch> {
  const start = Date.now();
  for (;;) {
    const b = await anthropic.messages.batches.retrieve(id);
    if (b.processing_status === 'ended') return b;
    const c = b.request_counts;
    console.log(`    ⏳ ${label}: ${b.processing_status} · ok=${c.succeeded} err=${c.errored} proc=${c.processing} (${((Date.now() - start) / 60000).toFixed(1)} min)`);
    if (Date.now() - start > BATCH_MAX_WAIT_MS) throw new Error(`Batch ${id} a depășit 24h.`);
    await sleep(POLL_INTERVAL_MS);
  }
}

// ── Procesare per clasă ──────────────────────────────────────────────────────
interface GradeReport { grade: number; concepts: number; inserted: number; withDef: number; withFormulas: number; withExample: number; failed: number; retried: number; conf: Record<string, number>; inTok: number; outTok: number }
const emptyReport = (grade: number): GradeReport => ({ grade, concepts: 0, inserted: 0, withDef: 0, withFormulas: 0, withExample: 0, failed: 0, retried: 0, conf: {}, inTok: 0, outTok: 0 });

async function processGrade(anthropic: Anthropic, supabase: Db, grade: number, fromPage: number | null, toPage: number | null, onlyFailed: boolean): Promise<GradeReport> {
  console.log(`\n════════════ CLASA ${grade} ════════════`);
  // 1. Concepte (toată clasa, sau felia din [from,to]).
  let q = supabase.from('concepts').select('id, name, order_in_grade, sub_points').eq('grade_level', grade);
  if (fromPage != null) q = q.gte('order_in_grade', fromPage);
  if (toPage != null) q = q.lte('order_in_grade', toPage);
  const { data: cData, error: cErr } = await q.order('order_in_grade', { ascending: true });
  if (cErr) throw new Error(`Citire concepts: ${cErr.message}`);
  let concepts: Concept[] = (cData ?? []).map((c) => ({ id: c.id as string, name: c.name as string, order_in_grade: (c.order_in_grade as number) ?? 0, sub_points: Array.isArray(c.sub_points) ? (c.sub_points as string[]) : [] }));
  if (concepts.length === 0) { console.log('   (nicio concept) — sar.'); return emptyReport(grade); }

  // --only-failed: păstrează doar conceptele cu propunere goală sau note='parse_fail'.
  if (onlyFailed) {
    const allIds = concepts.map((c) => c.id);
    const failedSet = new Set<string>();
    for (let i = 0; i < allIds.length; i += 100) {
      const { data, error } = await supabase.from('concept_content_proposals').select('concept_id, definitie, formule_latex, note').in('concept_id', allIds.slice(i, i + 100));
      if (error) throw new Error(`Citire propuneri (only-failed): ${error.message}`);
      for (const r of (data ?? []) as { concept_id: string; definitie: string | null; formule_latex: unknown; note: string | null }[]) {
        const empty = (r.definitie ?? '') === '' && (Array.isArray(r.formule_latex) ? r.formule_latex.length : 0) === 0;
        if (empty || r.note === 'parse_fail') failedSet.add(r.concept_id);
      }
    }
    concepts = concepts.filter((c) => failedSet.has(c.id));
    console.log(`🔁 only-failed: ${concepts.length} concepte de re-rulat.`);
    if (concepts.length === 0) { console.log('   (niciun eșec) — sar.'); return emptyReport(grade); }
  }
  console.log(`📥 ${concepts.length} concepte.`);

  // dedup + inventory maps (pentru source_pages).
  const dedupMap = new Map<string, string[]>();
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('concept_dedup_proposals').select('canonical_name, raw_names').eq('grade', grade).range(f, f + 999);
    if (error) throw new Error(`Citire dedup: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as { canonical_name: string; raw_names: unknown }[]) dedupMap.set(r.canonical_name, asStrArr(r.raw_names));
    if (data.length < 1000) break;
  }
  const rawPageMap = new Map<string, number>();
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('concept_inventory_raw').select('name, first_seen_pdf_page').eq('grade', grade).range(f, f + 999);
    if (error) throw new Error(`Citire inventory: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as { name: string; first_seen_pdf_page: number | null }[]) {
      if (r.first_seen_pdf_page == null) continue;
      const ex = rawPageMap.get(r.name);
      if (ex == null || r.first_seen_pdf_page < ex) rawPageMap.set(r.name, r.first_seen_pdf_page);
    }
    if (data.length < 1000) break;
  }

  // 2. PDF + cache pagini.
  const pdfPath = path.resolve(__dirname, `../../docs/manuale-source/clasa-${String(grade).padStart(2, '0')}.pdf`);
  console.log(`📄 ${pdfPath} @ ${DPI} DPI (MuPDF) …`);
  const doc = await openPdfForRender(pdfPath, DPI);
  const pageCount = doc.length;
  const pageCache = new Map<number, string>();
  const renderPage = (p: number): string => {
    let b = pageCache.get(p);
    if (b == null) { b = doc.getPage(p).toString('base64'); pageCache.set(p, b); }
    return b;
  };
  const sourcePagesFor = (c: Concept): number[] => {
    const comps = new Set<string>([c.name, ...(dedupMap.get(c.name) ?? []), ...c.sub_points]);
    const pages = new Set<number>();
    for (const nm of comps) { const pg = rawPageMap.get(nm); if (pg != null) for (const d of [-1, 0, 1]) pages.add(pg + d); }
    if (pages.size === 0) for (const d of [-1, 0, 1]) pages.add(c.order_in_grade + d);
    let arr = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
    if (arr.length > MAX_PAGES_PER_CONCEPT) {
      arr = [...arr].sort((a, b) => Math.abs(a - c.order_in_grade) - Math.abs(b - c.order_in_grade)).slice(0, MAX_PAGES_PER_CONCEPT).sort((a, b) => a - b);
    }
    return arr;
  };

  // Idempotent: TRUNCATE propunerile clasei.
  const ids = concepts.map((c) => c.id);
  for (let i = 0; i < ids.length; i += 100) await supabase.from('concept_content_proposals').delete().in('concept_id', ids.slice(i, i + 100));

  // 3. Construiește + trimite batch-uri (chunked sub limita de bytes).
  const sourcePages = new Map<string, number[]>();
  const batchIds: string[] = [];
  let curReqs: BatchRequest[] = [];
  let curBytes = 0;
  const submit = async () => {
    if (curReqs.length === 0) return;
    const created = await anthropic.messages.batches.create({ requests: curReqs });
    batchIds.push(created.id);
    console.log(`   ▶ batch ${batchIds.length} trimis: ${created.id} (${curReqs.length} cereri, ~${(curBytes / 1024 / 1024).toFixed(0)} MB)`);
    curReqs = []; curBytes = 0;
  };
  console.log(`🖼️  Randez + construiesc cererile …`);
  for (const c of concepts) {
    const pages = sourcePagesFor(c);
    sourcePages.set(c.id, pages);
    const images = pages.map(renderPage);
    const bytes = images.reduce((s, b) => s + b.length, 0) + 4096;
    if (curReqs.length > 0 && (curBytes + bytes > BATCH_MAX_BYTES || curReqs.length + 1 > BATCH_MAX_REQUESTS)) await submit();
    curReqs.push(buildRequest(c.id, images, c.name, c.sub_points));
    curBytes += bytes;
  }
  await submit();
  console.log(`📦 ${concepts.length} cereri → ${batchIds.length} batch(uri).`);

  // 4. Poll + colectează rezultatele (cu retry SYNC la parse-fail / eroare per-cerere).
  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  const rowByConcept = new Map<string, ContentRow>();
  let inTok = 0, outTok = 0, failed = 0, retried = 0;
  for (let i = 0; i < batchIds.length; i++) {
    const id = batchIds[i];
    const ended = await pollBatch(anthropic, id, `cl.${grade} batch ${i + 1}/${batchIds.length}`);
    console.log(`   ✓ ${id} ended: ok=${ended.request_counts.succeeded} err=${ended.request_counts.errored}. Descarc …`);
    for await (const item of await anthropic.messages.batches.results(id)) {
      const cid = item.custom_id;
      const pages = sourcePages.get(cid) ?? [];
      let row: ContentRow | null = null;
      if (item.result.type === 'succeeded') {
        const msg = item.result.message;
        inTok += msg.usage.input_tokens; outTok += msg.usage.output_tokens;
        row = rowFromContent(msg.content, cid, pages, '');
      }
      // Retry SYNC o dată pe parse-fail SAU eroare per-cerere.
      if (!row) {
        const c = conceptById.get(cid);
        if (c) {
          const r = await syncExtract(anthropic, pages.map(renderPage), c.name, c.sub_points, cid, pages);
          if (r) { row = r.row; inTok += r.inTok; outTok += r.outTok; retried++; }
        }
      }
      if (!row) { failed++; row = { concept_id: cid, definitie: '', formule_latex: [], conditii: '', exemplu: '', confidence: 'low', source_pages: pages, note: 'parse_fail' }; }
      rowByConcept.set(cid, row);
    }
  }
  // Concepte care nu au apărut în niciun rezultat → încearcă sync, altfel parse_fail.
  for (const c of concepts) {
    if (rowByConcept.has(c.id)) continue;
    const pages = sourcePages.get(c.id) ?? [];
    const r = await syncExtract(anthropic, pages.map(renderPage), c.name, c.sub_points, c.id, pages);
    if (r) { rowByConcept.set(c.id, r.row); inTok += r.inTok; outTok += r.outTok; retried++; }
    else { failed++; rowByConcept.set(c.id, { concept_id: c.id, definitie: '', formule_latex: [], conditii: '', exemplu: '', confidence: 'low', source_pages: pages, note: 'parse_fail' }); }
  }

  // 5. Insert.
  const rows = [...rowByConcept.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('concept_content_proposals').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Insert (grade ${grade}) [${i}]: ${error.message}`);
  }

  // 6. Verificare DB + raport.
  const { count } = await supabase.from('concept_content_proposals').select('*', { count: 'exact', head: true }).in('concept_id', ids);
  const conf: Record<string, number> = { high: 0, medium: 0, low: 0 };
  for (const r of rows) conf[r.confidence]++;
  const rep: GradeReport = {
    grade, concepts: concepts.length, inserted: count ?? 0,
    withDef: rows.filter((r) => r.definitie).length,
    withFormulas: rows.filter((r) => r.formule_latex.length > 0).length,
    withExample: rows.filter((r) => r.exemplu).length,
    failed, retried, conf, inTok, outTok,
  };
  return rep;
}

// ── Main ─────────────────────────────────────────────────────────────────────
function parseGrades(spec: string | undefined): number[] {
  if (!spec) return [12];
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
  const { values } = parseArgs({ options: { grades: { type: 'string' }, 'from-page': { type: 'string' }, 'to-page': { type: 'string' }, 'only-failed': { type: 'boolean' } } });
  const grades = parseGrades(values.grades);
  if (grades.length === 0) { console.error('❌ Nicio clasă validă.'); process.exit(1); }
  const fromPage = values['from-page'] ? parseInt(values['from-page'], 10) : null;
  const toPage = values['to-page'] ? parseInt(values['to-page'], 10) : null;
  const onlyFailed = !!values['only-failed'];

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
  if (!supabaseUrl || !serviceKey) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = makeClient(supabaseUrl, serviceKey);

  console.log(`🎯 Extracție conținut (BATCH 50%) pentru clasele: [${grades.join(', ')}]` +
    (fromPage != null || toPage != null ? ` · felie pagini [${fromPage ?? '*'}, ${toPage ?? '*'}]` : '') + (onlyFailed ? ' · DOAR eșecuri' : ''));
  const reports: GradeReport[] = [];
  for (const g of grades) reports.push(await processGrade(anthropic, supabase, g, fromPage, toPage, onlyFailed));

  console.log('\n════════════ VERIFICARE (din DB) ════════════');
  let totIn = 0, totOut = 0;
  for (const r of reports) {
    totIn += r.inTok; totOut += r.outTok;
    const cost = ((r.inTok / 1e6) * PRICE_IN + (r.outTok / 1e6) * PRICE_OUT) * BATCH_DISCOUNT;
    console.log(`Clasa ${String(r.grade).padStart(2)} · proposals ${r.inserted}/${r.concepts} · def ${r.withDef} · formule ${r.withFormulas} · exemplu ${r.withExample} · ` +
      `conf[h${r.conf.high ?? 0}/m${r.conf.medium ?? 0}/l${r.conf.low ?? 0}] · retry ${r.retried} · eșuate ${r.failed} · ~$${cost.toFixed(4)}`);
  }
  const totalCost = ((totIn / 1e6) * PRICE_IN + (totOut / 1e6) * PRICE_OUT) * BATCH_DISCOUNT;
  console.log(`\nTokeni: in ${totIn} / out ${totOut}  ·  Cost total (batch 50%): ~$${totalCost.toFixed(4)}`);
  console.log('✅ Doar PROPUNERI (concept_content_proposals). `concepts`.body NU a fost atins.');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
