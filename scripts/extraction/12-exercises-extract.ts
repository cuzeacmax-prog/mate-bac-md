/**
 * 12-exercises-extract.ts — ETAPA 11: import BRUT exerciții din culegere (vision, scanat).
 *
 * Rulează:  npm run extract:exercises -- --pages "40-50"
 *           (sau: tsx --env-file=.env.local scripts/extraction/12-exercises-extract.ts --pages 40-50)
 *
 * Culegerea e SCANATĂ (fără strat text) → rasterizăm cu MuPDF la 150 DPI și citim cu vision.
 * Per pagină: claude-sonnet-4-6 cu TOOL USE transcrie FIDEL fiecare exercițiu (enunț + LaTeX),
 * subpărți (a,b,c,d), module/§ din antet, has_figure. NU rezolvă, NU inventează. given_answer=null.
 * Scrie în exercise_raw. Idempotent: șterge rândurile sursei pentru paginile procesate înainte.
 *
 * NU atinge concepts / concept_edges.
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
const THROTTLE_MS = 800;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const VALID_CONF = ['high', 'medium', 'low'] as const;
type Confidence = (typeof VALID_CONF)[number];
const asConf = (v: unknown): Confidence => (VALID_CONF.includes(v as Confidence) ? (v as Confidence) : 'low');
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);

function makeClient(url: string, key: string) { return createClient(url, key); }

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

// ── Tool use ─────────────────────────────────────────────────────────────────
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
      module: { type: 'string', description: 'Antetul de modul vizibil pe pagină (ex. "Modulul 3...") sau gol.' },
      section: { type: 'string', description: 'Antetul de secțiune/§ vizibil pe pagină sau gol.' },
      exercises: {
        type: 'array',
        description: 'Toate exercițiile numerotate de pe pagină, în ordine.',
        items: {
          type: 'object',
          properties: {
            exercise_number: { type: 'string', description: 'Numărul exercițiului exact ca pe pagină (ex. "12", "3.4").' },
            statement: { type: 'string', description: 'Enunțul transcris FIDEL, cu LaTeX pentru matematică. Fără subpuncte aici dacă sunt separate.' },
            subparts: { type: 'array', items: { type: 'string' }, description: 'Subpunctele a), b), c) ca listă, dacă există; altfel [].' },
            has_figure: { type: 'boolean', description: 'true DOAR dacă exercițiul are o FIGURĂ DESENATĂ pe pagină.' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Cât de sigură e transcrierea (scan).' },
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
  'din antet. NU rezolva, NU inventa, NU completa răspunsuri. Apelează record_exercises.';

interface ModelExercise { exercise_number?: string; statement?: string; subparts?: unknown; has_figure?: boolean; confidence?: string }
interface ToolInput { module?: string; section?: string; exercises?: ModelExercise[] }

async function callVision(anthropic: Anthropic, b64: string): Promise<{ input: ToolInput; inTok: number; outTok: number }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const msg = await anthropic.messages.create({
        model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
        tools: [EXERCISES_TOOL], tool_choice: { type: 'tool', name: 'record_exercises' },
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
          { type: 'text', text: USER_PROMPT },
        ] }],
      });
      const tu = msg.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
      return { input: (tu?.input ?? {}) as ToolInput, inTok: msg.usage.input_tokens, outTok: msg.usage.output_tokens };
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
  const { values } = parseArgs({ options: { pages: { type: 'string' } } });
  if (!values.pages) { console.error('Utilizare: npm run extract:exercises -- --pages "40-50"'); process.exit(1); }
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
  console.log(`   → ${pageCount} pagini. De procesat: [${pages.join(', ')}] (${SOURCE}).`);

  // Idempotent: șterge rândurile sursei pentru aceste pagini.
  for (let i = 0; i < pages.length; i += 100) {
    await supabase.from('exercise_raw').delete().eq('source', SOURCE).in('pdf_page', pages.slice(i, i + 100));
  }

  const rows: ExerciseRow[] = [];
  let totalIn = 0, totalOut = 0;
  for (const p of pages) {
    if (p < 1 || p > pageCount) { console.warn(`  ⚠️ pagina ${p} în afara PDF (1..${pageCount}) — sar.`); continue; }
    process.stdout.write(`  📄 pagina ${p}/${pageCount} … `);
    const b64 = doc.getPage(p).toString('base64');
    const { input, inTok, outTok } = await callVision(anthropic, b64);
    totalIn += inTok; totalOut += outTok;
    const mod = asStr(input.module) || null;
    const sec = asStr(input.section) || null;
    const exs = Array.isArray(input.exercises) ? input.exercises : [];
    for (const e of exs) {
      const num = asStr(e.exercise_number);
      const stmt = asStr(e.statement);
      if (!num && !stmt) continue;
      rows.push({
        source: SOURCE, pdf_page: p, exercise_number: num, module: mod, section: sec,
        statement: stmt, subparts: asStrArr(e.subparts), has_figure: e.has_figure === true,
        given_answer: null, confidence: asConf(e.confidence),
      });
    }
    console.log(`✓ ${exs.length} exerciții  [in ${inTok} / out ${outTok} tok]`);
    if (p !== pages[pages.length - 1]) await sleep(THROTTLE_MS);
  }

  // Insert.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('exercise_raw').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Insert exercise_raw [${i}]: ${error.message}`);
  }

  // VERIFICARE din DB.
  const { count } = await supabase.from('exercise_raw').select('*', { count: 'exact', head: true }).eq('source', SOURCE).in('pdf_page', pages);
  const { data: sample } = await supabase.from('exercise_raw')
    .select('pdf_page, exercise_number, module, section, statement, subparts, has_figure')
    .eq('source', SOURCE).in('pdf_page', pages).order('pdf_page').order('exercise_number').limit(3);
  const withSub = rows.filter((r) => r.subparts.length > 0).length;
  const withFig = rows.filter((r) => r.has_figure).length;
  const cost = (totalIn / 1e6) * 3 + (totalOut / 1e6) * 15;

  console.log('\n──────── VERIFICARE (din DB reală) ────────');
  console.log(`Exerciții inserate (${SOURCE}, pg ${values.pages}): ${count}`);
  console.log(`Cu subparts: ${withSub}  ·  has_figure=true: ${withFig}`);
  console.log(`Tokeni: in ${totalIn} / out ${totalOut}  ·  ~$${cost.toFixed(4)}`);
  console.log('\nEșantion (3 enunțuri complete):');
  for (const s of (sample ?? []) as { pdf_page: number; exercise_number: string; module: string | null; section: string | null; statement: string; subparts: string[]; has_figure: boolean }[]) {
    console.log(`\n  [p.${s.pdf_page} · nr.${s.exercise_number} · ${s.module ?? '—'} / ${s.section ?? '—'} · fig=${s.has_figure}]`);
    console.log(`  ${s.statement}`);
    if (Array.isArray(s.subparts) && s.subparts.length) for (const sp of s.subparts) console.log(`     • ${sp}`);
  }
  console.log('\n✅ Doar exercise_raw. concepts / concept_edges: neatinse.');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
