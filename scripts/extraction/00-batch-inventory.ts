/**
 * 00-batch-inventory.ts — ETAPA 2.2: RUNNER DE LOT (inventar pe toate manualele)
 *
 * Rulează:  npm run extract:all  [-- --dpi 130]
 *
 * Ce face:
 *   Orchestrează inventarul (01-inventory.ts) pe TOATE cărțile din docs/manuale-source/.
 *   1. Scanează după fișiere clasa-NN.pdf (NN = 01..12, zero-padded) și deduce grade din nume.
 *   2. Pentru fiecare carte, în ordine crescătoare de grade, cheamă runInventory({pdf, grade})
 *      pe TOATE paginile — ACEEAȘI logică folosită de CLI (NU se duplică).
 *   3. Resume: la nivel de pagină (deja în 01-inventory.ts, via progresul JSONL) ȘI la nivel de
 *      carte — o carte deja COMPLETĂ (toate paginile în progres) e sărită fără apeluri vision.
 *   4. Izolarea erorilor: dacă o carte eșuează (PDF corupt etc.), loghează și TRECE la următoarea.
 *   5. Cost: tokeni input/output per carte + cumulat pe tot lotul; total la final.
 *   6. Scrie scripts/extraction/output/_summary.json — un rând per carte cu metricile cheie.
 *
 * NU scrie nimic în Supabase. Doar fișiere sub scripts/extraction/output/.
 *
 * Requires: ANTHROPIC_API_KEY  (rulează cu --env-file=.env.local)
 */

import Anthropic from '@anthropic-ai/sdk';
import { pdf } from 'pdf-to-img';
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runInventory, OUTPUT_DIR, type RunInventoryResult } from './01-inventory';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// docs/manuale-source/ relativ la rădăcina proiectului (scripts/extraction/.. /..)
const MANUALE_DIR = path.resolve(__dirname, '..', '..', 'docs', 'manuale-source');
const SUMMARY_PATH = path.join(OUTPUT_DIR, '_summary.json');

const DEFAULT_DPI = 130;
const PDFJS_BASE_DPI = 72;

interface BookFile {
  grade: number;
  fileName: string;
  fullPath: string;
}

/** Un rând în _summary.json (per carte). */
interface SummaryRow {
  grade: number;
  file: string;
  status: 'ok' | 'skipped' | 'failed';
  pages_processed: number;
  page_count: number;
  total_concepts: number;
  low_confidence_pages: number;   // count
  parse_failures: number;         // count
  input_tokens: number;
  output_tokens: number;
  error?: string;
}

/** Scanează MANUALE_DIR după clasa-NN.pdf și întoarce cărțile, ordonate crescător după grade. */
async function discoverBooks(): Promise<BookFile[]> {
  let names: string[];
  try {
    names = await fs.readdir(MANUALE_DIR);
  } catch (err) {
    throw new Error(`Nu pot citi ${MANUALE_DIR}: ${(err as Error)?.message ?? err}`);
  }
  const books: BookFile[] = [];
  for (const name of names) {
    const m = name.match(/^clasa-(\d{2})\.pdf$/i);
    if (!m) continue;
    const grade = parseInt(m[1], 10);
    if (grade < 1 || grade > 12) continue;
    books.push({ grade, fileName: name, fullPath: path.join(MANUALE_DIR, name) });
  }
  return books.sort((a, b) => a.grade - b.grade);
}

/**
 * Verifică dacă o carte e DEJA completă în progres (toate paginile procesate),
 * ca să o sărim fără a deschide deloc apeluri vision. Citim numărul de pagini din PDF
 * (ieftin — randarea propriu-zisă a paginilor nu se face) și comparăm cu progresul JSONL.
 */
async function isBookComplete(book: BookFile, dpi: number): Promise<{ complete: boolean; pageCount: number }> {
  const scale = dpi / PDFJS_BASE_DPI;
  const doc = await pdf(book.fullPath, { scale });
  const pageCount = doc.length;

  const progressPath = path.join(OUTPUT_DIR, `clasa-${String(book.grade).padStart(2, '0')}-progress.jsonl`);
  let content: string;
  try {
    content = await fs.readFile(progressPath, 'utf8');
  } catch {
    return { complete: false, pageCount }; // încă niciun progres
  }
  const seen = new Set<number>();
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const e = JSON.parse(t) as { pdf_page?: number };
      if (typeof e.pdf_page === 'number') seen.add(e.pdf_page);
    } catch {
      // linie coruptă — ignorăm
    }
  }
  return { complete: seen.size >= pageCount, pageCount };
}

async function main() {
  const { values } = parseArgs({ options: { dpi: { type: 'string' } } });
  const dpi = values.dpi ? parseInt(values.dpi, 10) : DEFAULT_DPI;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.error('❌ Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
    process.exit(1);
  }
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const books = await discoverBooks();
  if (books.length === 0) {
    console.error(`❌ Nicio carte clasa-NN.pdf găsită în ${MANUALE_DIR}.`);
    process.exit(1);
  }

  console.log(`📚 LOT INVENTAR — ${books.length} cărți: [${books.map((b) => b.grade).join(', ')}]`);
  console.log(`   Sursă: ${MANUALE_DIR}`);
  console.log(`   DPI:   ${dpi}\n`);

  const rows: SummaryRow[] = [];
  let lotIn = 0;
  let lotOut = 0;
  const t0 = Date.now();

  for (const book of books) {
    console.log(`\n════════ Clasa ${book.grade} · ${book.fileName} ════════`);
    try {
      // Resume la nivel de CARTE: dacă e completă, o sărim fără apeluri vision.
      const { complete, pageCount } = await isBookComplete(book, dpi);
      if (complete) {
        console.log(`⏭️  Carte completă (${pageCount} pagini deja în progres) — o sar.`);
        rows.push({
          grade: book.grade,
          file: book.fileName,
          status: 'skipped',
          pages_processed: pageCount,
          page_count: pageCount,
          total_concepts: 0,
          low_confidence_pages: 0,
          parse_failures: 0,
          input_tokens: 0,
          output_tokens: 0,
        });
        continue;
      }

      const res: RunInventoryResult = await runInventory({
        pdf: book.fullPath,
        grade: book.grade,
        anthropic, // client partajat pe tot lotul
        dpi,
      });

      lotIn += res.input_tokens;
      lotOut += res.output_tokens;

      rows.push({
        grade: res.grade,
        file: book.fileName,
        status: 'ok',
        pages_processed: res.pages_processed,
        page_count: res.pageCount,
        total_concepts: res.total_concepts,
        low_confidence_pages: res.low_confidence_count,
        parse_failures: res.parse_failures_count,
        input_tokens: res.input_tokens,
        output_tokens: res.output_tokens,
      });
    } catch (err) {
      // Izolarea erorilor: o carte căzută NU oprește lotul.
      const msg = (err as Error)?.message ?? String(err);
      console.error(`💥 Clasa ${book.grade} a eșuat — TREC mai departe: ${msg}`);
      rows.push({
        grade: book.grade,
        file: book.fileName,
        status: 'failed',
        pages_processed: 0,
        page_count: 0,
        total_concepts: 0,
        low_confidence_pages: 0,
        parse_failures: 0,
        input_tokens: 0,
        output_tokens: 0,
        error: msg,
      });
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    source_dir: MANUALE_DIR,
    dpi,
    books_total: books.length,
    books_ok: rows.filter((r) => r.status === 'ok').length,
    books_skipped: rows.filter((r) => r.status === 'skipped').length,
    books_failed: rows.filter((r) => r.status === 'failed').length,
    lot_input_tokens: lotIn,
    lot_output_tokens: lotOut,
    lot_total_tokens: lotIn + lotOut,
    elapsed_ms: Date.now() - t0,
    books: rows,
  };
  await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf8');

  console.log('\n════════════ REZUMAT LOT ════════════');
  for (const r of rows) {
    const tag = r.status === 'ok' ? '✓' : r.status === 'skipped' ? '⏭️ ' : '❌';
    console.log(
      `${tag} Clasa ${String(r.grade).padStart(2, ' ')} · ${r.status.padEnd(7)} · ` +
      `pagini ${r.pages_processed}/${r.page_count} · concepte ${r.total_concepts} · ` +
      `low-conf ${r.low_confidence_pages} · parse-fail ${r.parse_failures} · ` +
      `tok in ${r.input_tokens}/out ${r.output_tokens}` +
      (r.error ? ` · ERR: ${r.error}` : ''),
    );
  }
  console.log('─────────────────────────────────────');
  console.log(`Cărți: ${summary.books_ok} ok · ${summary.books_skipped} sărite · ${summary.books_failed} eșuate`);
  console.log(`Tokeni LOT:  in ${lotIn} / out ${lotOut} (total ${lotIn + lotOut})`);
  console.log(`Durată:      ${(summary.elapsed_ms / 1000).toFixed(1)}s`);
  console.log(`Rezumat:     ${SUMMARY_PATH}`);
}

main().catch((err) => {
  console.error('\n💥 Eroare fatală lot:', err);
  process.exit(1);
});
