/**
 * 12-exercises-extract.ts — ETAPA 11/11b: import BRUT exerciții din culegere (vision BATCH).
 *
 * Rulează:  npm run extract:exercises -- --pages "1-142"
 *           (sau: tsx --env-file=.env.local scripts/extraction/12-exercises-extract.ts --pages 1-142)
 *
 * Culegerea e SCANATĂ → rasterizăm cu MuPDF la 150 DPI și citim cu vision (BATCH API, 50%).
 * Per pagină: claude-sonnet-4-6 cu TOOL USE transcrie FIDEL fiecare exercițiu (enunț + LaTeX,
 * subpărți, module/§, has_figure). NU rezolvă, NU inventează. given_answer=null.
 * Idempotent: TRUNCATE exercise_raw pentru source înainte. NU atinge concepts / concept_edges.
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

const MODEL = 'claude-sonnet-4-6';
const DPI = 150;
const MAX_TOKENS = 8000;
const SOURCE = 'culegere_12_2';
const PDF_PATH = path.resolve(__dirname, '../../docs/manuale-source/culegere, 12 (2).pdf');
const POLL_INTERVAL_MS = 20_000;
const BATCH_MAX_BYTES = 180 * 1024 * 1024;
const BATCH_MAX_REQUESTS = 1000;
const BATCH_MAX_WAIT_MS = 24 * 60 * 60 * 1000;
const PRICE_IN = 3, PRICE_OUT = 15, BATCH_DISCOUNT = 0.5;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const VALID_CONF = ['high', 'medium', 'low'] as const;
type Confidence = (typeof VALID_CONF)[number];
const asConf = (v: unknown): Confidence => (VALID_CONF.includes(v as Confidence) ? (v as Confidence) : 'low');
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);

function makeClient(url: string, key: string) { return createClient(url, key); }
type BatchRequest = Anthropic.Messages.BatchCreateParams.Request;

interface ExerciseRow {
  source: string; pdf_page: number; exercise_number: string; module: string | null; section: string | null;
  statement: string; subparts: string[]; has_figure: boolean; given_answer: null; confidence: Confidence;
}

function parsePages(spec: string): number[] {
  const set = new Set<number>();
  for (const tokRaw of spec.split(',')) {
    const tok = tokRaw.trim(); if (!tok) continue;
    const m = tok.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { let a = +m[1], b = +m[2]; if (a > b) [a, b] = [b, a]; for (let p = a; p <= b; p++) set.add(p); }
    else if (/^\d+$/.test(tok)) set.add(+tok);
    else throw new Error(`Token --pages invalid: "${tok}"`);
  }
  return [...set].sort((a, b) => a - b);
}

const SYSTEM_PROMPT =
  'Ești un transcriptor de culegeri de matematică (BAC Republica Moldova). Primești IMAGINEA ' +
  'unei pagini SCANATE dintr-o culegere și transcrii FIDEL fiecare exercițiu de pe pagină — ' +
  'enunțul exact, cu LaTeX pentru matematică. NU rezolvi, NU inventezi, NU adaugi nimic ce nu ' +
  'e pe pagină. Înregistrezi rezultatul EXCLUSIV prin tool-ul record_exercises.';

const EXERCISES_TOOL: Anthropic.Messages.Tool = {
  name: 'record_exercises',
  description: 'Înregistrează toate exercițiile transcrise de pe pagină.',
  input_schema: {
    type: 'object',
    properties: {
      module: { type: 'string', description: 'Antetul de modul vizibil pe pagină (ex. "Modulul VII") sau gol.' },
      section: { type: 'string', description: 'Antetul de secțiune/§ vizibil pe pagină sau gol.' },
      exercises: {
        type: 'array',
        description: 'Toate exercițiile numerotate de pe pagină, în ordine. [] dacă pagina n-are exerciții.',
        items: {
          type: 'object',
          properties: {
            exercise_number: { type: 'string', description: 'Numărul exercițiului exact ca pe pagină.' },
            statement: { type: 'string', description: 'Enunțul transcris FIDEL, cu LaTeX pentru matematică.' },
            subparts: { type: 'array', items: { type: 'string' }, description: 'Subpunctele a/b/c/d ca listă, dacă există; altfel [].' },
            has_figure: { type: 'boolean', description: 'true DOAR dacă exercițiul are o FIGURĂ DESENATĂ pe pagină.' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['exercise_number', 'statement', 'subparts', 'has_figure', 'confidence'],
        },
      },
    },
    required: ['exercises'],
  },
};

const USER_PROMPT =
  'Transcrie FIDEL toate exercițiile numerotate de pe această pagină scanată. Pentru fiecare: ' +
  'numărul, enunțul exact (LaTeX pentru matematică, păstrează diacriticele), subpunctele a/b/c/d ' +
  'ca listă dacă există, și has_figure=true DOAR dacă are o figură desenată. Identifică module/§ ' +
  'din antet. NU rezolva, NU inventa, NU completa răspunsuri. Apelează record_exercises (chiar și ' +
  'cu exercises:[] dacă pagina n-are exerciții — cuprins, divider).';

interface ModelExercise { exercise_number?: string; statement?: string; subparts?: unknown; has_figure?: boolean; confidence?: string }
interface ToolInput { module?: string; section?: string; exercises?: ModelExercise[] }

function buildRequest(page: number, b64: string): BatchRequest {
  return {
    custom_id: `p${page}`,
    params: {
      model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
      tools: [EXERCISES_TOOL], tool_choice: { type: 'tool', name: 'record_exercises' },
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
        { type: 'text', text: USER_PROMPT },
      ] }],
    },
  };
}

function rowsFromInput(input: ToolInput, page: number): ExerciseRow[] {
  const mod = asStr(input.module) || null;
  const sec = asStr(input.section) || null;
  const out: ExerciseRow[] = [];
  for (const e of Array.isArray(input.exercises) ? input.exercises : []) {
    const num = asStr(e.exercise_number);
    const stmt = asStr(e.statement);
    if (!num && !stmt) continue;
    out.push({ source: SOURCE, pdf_page: page, exercise_number: num, module: mod, section: sec, statement: stmt, subparts: asStrArr(e.subparts), has_figure: e.has_figure === true, given_answer: null, confidence: asConf(e.confidence) });
  }
  return out;
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

async function main() {
  const { values } = parseArgs({ options: { pages: { type: 'string' } } });
  if (!values.pages) { console.error('Utilizare: npm run extract:exercises -- --pages "1-142"'); process.exit(1); }
  const pages = parsePages(values.pages);
  if (pages.length === 0) { console.error('❌ Niciun --pages valid.'); process.exit(1); }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = makeClient(url, key);

  console.log(`📄 Deschid ${PDF_PATH} la ${DPI} DPI (MuPDF, scanat) …`);
  const doc = await openPdfForRender(PDF_PATH, DPI);
  const pageCount = doc.length;
  const todo = pages.filter((p) => p >= 1 && p <= pageCount);
  console.log(`   → ${pageCount} pagini. De procesat: ${todo.length} [${todo[0]}..${todo[todo.length - 1]}] (${SOURCE}, BATCH 50%).`);

  // Idempotent: TRUNCATE sursa.
  console.log(`🧹 Șterg exercise_raw pentru source='${SOURCE}' …`);
  const { error: delErr } = await supabase.from('exercise_raw').delete().eq('source', SOURCE);
  if (delErr) throw new Error(`Ștergere: ${delErr.message}`);

  // Construiește + trimite batch-uri (chunked pe bytes).
  console.log('🖼️  Randez + construiesc cererile …');
  const sourcePage = new Map<string, number>();
  const batchIds: string[] = [];
  let curReqs: BatchRequest[] = [];
  let curBytes = 0;
  const submit = async () => {
    if (curReqs.length === 0) return;
    const created = await anthropic.messages.batches.create({ requests: curReqs });
    batchIds.push(created.id);
    console.log(`   ▶ batch ${batchIds.length} trimis: ${created.id} (${curReqs.length} pagini, ~${(curBytes / 1024 / 1024).toFixed(0)} MB)`);
    curReqs = []; curBytes = 0;
  };
  for (const p of todo) {
    const b64 = doc.getPage(p).toString('base64');
    sourcePage.set(`p${p}`, p);
    const bytes = b64.length + 2048;
    if (curReqs.length > 0 && (curBytes + bytes > BATCH_MAX_BYTES || curReqs.length + 1 > BATCH_MAX_REQUESTS)) await submit();
    curReqs.push(buildRequest(p, b64));
    curBytes += bytes;
  }
  await submit();
  console.log(`📦 ${todo.length} pagini → ${batchIds.length} batch(uri).`);

  // Poll + colectează.
  const rows: ExerciseRow[] = [];
  let totalIn = 0, totalOut = 0, failed = 0, emptyPages = 0;
  for (let i = 0; i < batchIds.length; i++) {
    const id = batchIds[i];
    const ended = await pollBatch(anthropic, id, `batch ${i + 1}/${batchIds.length}`);
    console.log(`   ✓ ${id} ended: ok=${ended.request_counts.succeeded} err=${ended.request_counts.errored}. Descarc …`);
    for await (const item of await anthropic.messages.batches.results(id)) {
      const page = sourcePage.get(item.custom_id) ?? 0;
      if (item.result.type === 'succeeded') {
        const msg = item.result.message;
        totalIn += msg.usage.input_tokens; totalOut += msg.usage.output_tokens;
        const tu = msg.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
        const r = tu ? rowsFromInput(tu.input as ToolInput, page) : [];
        if (r.length === 0) emptyPages++;
        rows.push(...r);
      } else { failed++; }
    }
  }

  // Insert.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('exercise_raw').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Insert exercise_raw [${i}]: ${error.message}`);
  }

  // VERIFICARE din DB.
  const { count } = await supabase.from('exercise_raw').select('*', { count: 'exact', head: true }).eq('source', SOURCE);
  const moduleDist: Record<string, number> = {};
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('exercise_raw').select('module').eq('source', SOURCE).range(f, f + 999);
    if (error) throw new Error(`module dist: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) { const m = (r.module as string | null) ?? '(null)'; moduleDist[m] = (moduleDist[m] ?? 0) + 1; }
    if (data.length < 1000) break;
  }
  const cost = ((totalIn / 1e6) * PRICE_IN + (totalOut / 1e6) * PRICE_OUT) * BATCH_DISCOUNT;

  console.log('\n──────── VERIFICARE EXERCIȚII (din DB reală) ────────');
  console.log(`Total exerciții (${SOURCE}): ${count}  ·  pagini fără exerciții: ${emptyPages}  ·  cereri eșuate: ${failed}`);
  console.log(`Cu subparts: ${rows.filter((r) => r.subparts.length > 0).length}  ·  has_figure=true: ${rows.filter((r) => r.has_figure).length}`);
  console.log('Distribuție pe module:');
  for (const [m, n] of Object.entries(moduleDist).sort((a, b) => b[1] - a[1])) console.log(`  ${m}: ${n}`);
  console.log(`Tokeni: in ${totalIn} / out ${totalOut}  ·  Cost (batch 50%): ~$${cost.toFixed(4)}`);
  console.log('\n✅ Doar exercise_raw. concepts / concept_edges: neatinse.');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
