/**
 * 13-answers-extract.ts — ETAPA 11b: extrage CHEIA DE RĂSPUNSURI (SOLUȚII) din culegere.
 *
 * Rulează:  npm run extract:answers -- --pages "143-171"
 *
 * Paginile de SOLUȚII (final) sunt scanate → MuPDF 150 DPI + vision TOOL USE. Transcrie FIDEL
 * fiecare răspuns final, grupat pe TEST/§/Modul + problem_number. NU face match cu exercise_raw
 * (doar captură). Idempotent: TRUNCATE exercise_answers pentru source înainte.
 * NU atinge concepts / concept_edges / exercise_raw.
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
const BATCH_MAX_WAIT_MS = 24 * 60 * 60 * 1000;
const PRICE_IN = 3, PRICE_OUT = 15, BATCH_DISCOUNT = 0.5;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const VALID_CONF = ['high', 'medium', 'low'] as const;
type Confidence = (typeof VALID_CONF)[number];
const asConf = (v: unknown): Confidence => (VALID_CONF.includes(v as Confidence) ? (v as Confidence) : 'low');
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
function makeClient(url: string, key: string) { return createClient(url, key); }
type BatchRequest = Anthropic.Messages.BatchCreateParams.Request;

interface AnswerRow { source: string; pdf_page: number; test_or_section: string | null; problem_number: string; answer_text: string; confidence: Confidence }

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
  'Ești un transcriptor al CHEII DE RĂSPUNSURI (SOLUȚII) dintr-o culegere de matematică (BAC MD). ' +
  'Primești IMAGINEA unei pagini SCANATE din secțiunea de soluții și transcrii FIDEL fiecare ' +
  'răspuns/soluție, cu LaTeX pentru matematică. NU rezolvi tu, NU inventezi — doar transcrii ce e ' +
  'pe pagină. Înregistrezi rezultatul EXCLUSIV prin tool-ul record_answers.';

const ANSWERS_TOOL: Anthropic.Messages.Tool = {
  name: 'record_answers',
  description: 'Înregistrează răspunsurile/soluțiile transcrise de pe pagina de chei.',
  input_schema: {
    type: 'object',
    properties: {
      test_or_section: { type: 'string', description: 'Gruparea vizibilă pe pagină (ex. "Modulul VII", "§2. Piramida", "Testul 3") sau gol.' },
      answers: {
        type: 'array',
        description: 'Toate răspunsurile numerotate de pe pagină, în ordine. [] dacă e divider/gol.',
        items: {
          type: 'object',
          properties: {
            problem_number: { type: 'string', description: 'Numărul problemei exact ca pe pagină.' },
            answer_text: { type: 'string', description: 'Răspunsul/soluția finală transcris FIDEL, cu LaTeX (ex. "A=13{,}5 \\text{ cm}^2", "S=\\{1,2\\}").' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['problem_number', 'answer_text', 'confidence'],
        },
      },
    },
    required: ['answers'],
  },
};

const USER_PROMPT =
  'Aceasta e o pagină din CHEIA DE RĂSPUNSURI (SOLUȚII). Transcrie FIDEL fiecare răspuns numerotat: ' +
  'numărul problemei + textul răspunsului/soluției (LaTeX pentru matematică, păstrează diacriticele). ' +
  'Identifică gruparea (Modul/§/Test) din antet. NU rezolva tu, NU inventa. Apelează record_answers ' +
  '(chiar și cu answers:[] dacă pagina e divider/goală).';

interface ModelAnswer { problem_number?: string; answer_text?: string; confidence?: string }
interface ToolInput { test_or_section?: string; answers?: ModelAnswer[] }

function buildRequest(page: number, b64: string): BatchRequest {
  return {
    custom_id: `p${page}`,
    params: {
      model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
      tools: [ANSWERS_TOOL], tool_choice: { type: 'tool', name: 'record_answers' },
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
        { type: 'text', text: USER_PROMPT },
      ] }],
    },
  };
}

function rowsFromInput(input: ToolInput, page: number): AnswerRow[] {
  const sec = asStr(input.test_or_section) || null;
  const out: AnswerRow[] = [];
  for (const a of Array.isArray(input.answers) ? input.answers : []) {
    const num = asStr(a.problem_number);
    const txt = asStr(a.answer_text);
    if (!num && !txt) continue;
    out.push({ source: SOURCE, pdf_page: page, test_or_section: sec, problem_number: num, answer_text: txt, confidence: asConf(a.confidence) });
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
  if (!values.pages) { console.error('Utilizare: npm run extract:answers -- --pages "143-171"'); process.exit(1); }
  const pages = parsePages(values.pages);
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = makeClient(url, key);

  console.log(`📄 Deschid ${PDF_PATH} la ${DPI} DPI (chei) …`);
  const doc = await openPdfForRender(PDF_PATH, DPI);
  const todo = pages.filter((p) => p >= 1 && p <= doc.length);
  console.log(`   → de procesat: ${todo.length} pagini [${todo[0]}..${todo[todo.length - 1]}] (BATCH 50%).`);

  console.log(`🧹 Șterg exercise_answers pentru source='${SOURCE}' …`);
  const { error: delErr } = await supabase.from('exercise_answers').delete().eq('source', SOURCE);
  if (delErr) throw new Error(`Ștergere: ${delErr.message}`);

  console.log('🖼️  Randez + construiesc cererile …');
  const sourcePage = new Map<string, number>();
  const batchIds: string[] = [];
  let curReqs: BatchRequest[] = [];
  let curBytes = 0;
  const submit = async () => {
    if (curReqs.length === 0) return;
    const created = await anthropic.messages.batches.create({ requests: curReqs });
    batchIds.push(created.id);
    console.log(`   ▶ batch ${batchIds.length}: ${created.id} (${curReqs.length} pagini, ~${(curBytes / 1024 / 1024).toFixed(0)} MB)`);
    curReqs = []; curBytes = 0;
  };
  for (const p of todo) {
    const b64 = doc.getPage(p).toString('base64');
    sourcePage.set(`p${p}`, p);
    const bytes = b64.length + 2048;
    if (curReqs.length > 0 && curBytes + bytes > BATCH_MAX_BYTES) await submit();
    curReqs.push(buildRequest(p, b64));
    curBytes += bytes;
  }
  await submit();
  console.log(`📦 ${todo.length} pagini → ${batchIds.length} batch(uri).`);

  const rows: AnswerRow[] = [];
  let totalIn = 0, totalOut = 0, failed = 0;
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
        if (tu) rows.push(...rowsFromInput(tu.input as ToolInput, page));
      } else { failed++; }
    }
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('exercise_answers').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Insert exercise_answers [${i}]: ${error.message}`);
  }

  const { count } = await supabase.from('exercise_answers').select('*', { count: 'exact', head: true }).eq('source', SOURCE);
  const { data: sample } = await supabase.from('exercise_answers').select('pdf_page, test_or_section, problem_number, answer_text').eq('source', SOURCE).order('pdf_page').order('problem_number').limit(3);
  const cost = ((totalIn / 1e6) * PRICE_IN + (totalOut / 1e6) * PRICE_OUT) * BATCH_DISCOUNT;

  console.log('\n──────── VERIFICARE RĂSPUNSURI (din DB reală) ────────');
  console.log(`Rânduri în exercise_answers (${SOURCE}): ${count}  ·  cereri eșuate: ${failed}`);
  console.log(`Tokeni: in ${totalIn} / out ${totalOut}  ·  Cost (batch 50%): ~$${cost.toFixed(4)}`);
  console.log('\nEșantion (3 răspunsuri):');
  for (const s of (sample ?? []) as { pdf_page: number; test_or_section: string | null; problem_number: string; answer_text: string }[]) {
    console.log(`  [p.${s.pdf_page} · ${s.test_or_section ?? '—'} · nr.${s.problem_number}] ${s.answer_text}`);
  }
  console.log('\n✅ Doar exercise_answers. concepts / concept_edges / exercise_raw: neatinse.');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
