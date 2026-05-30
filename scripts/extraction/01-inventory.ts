/**
 * 01-inventory.ts — ETAPA 2, Trecerea 1: INVENTARUL (vision, doar pe disc)
 *
 * Rulează:  npm run extract:inventory -- --pdf <cale> --grade <n> [--pages <lista>]
 *
 * Ce face:
 *   Construiește o HARTĂ a manualului (NU extrage conținut, NU atinge baza de date).
 *   1. Randează fiecare pagină PDF → PNG (~130 DPI) cu MuPDF (mupdf.js, WASM oficial Artifex),
 *      fără binare de sistem (fără poppler / imagemagick / ghostscript) și cu decodor
 *      JPEG2000 compilat în librărie. Merge pe Windows și decodează imaginile JPEG2000
 *      din manuale (unde pdfjs eșua cu "JpxError: OpenJPEG failed to initialize", lăsând
 *      pagini cu ilustrații goale).
 *   2. Pentru fiecare pagină, un apel vision (Claude Sonnet 4.6) care întoarce STRICT JSON
 *      cu structura din INVENTORY_SCHEMA de mai jos.
 *   3. Salvează rezultatul ca scripts/extraction/output/clasa-<NN>-inventory.json cu trei
 *      secțiuni: "pages", "concept_inventory" (deduplicat ÎN COD) și "stats".
 *
 * Stratul de text al manualelor e CORUPT (diacritice sparte), de aceea citim din IMAGINE.
 *
 * ROBUSTEȚE (rulare lungă, ~136 apeluri):
 *   - Rezumabil: progres salvat după FIECARE pagină (JSONL); la re-rulare sare paginile gata.
 *   - Retry cu backoff exponențial pe erori de rețea / rate-limit + throttling între apeluri.
 *   - JSON neparsabil pe o pagină → salvează răspunsul brut, marchează confidence "low" +
 *     notes "parse_failed", NU oprește rularea.
 *   - Loghează tokenii (input/output) per pagină și cumulativ.
 *
 * Requires: ANTHROPIC_API_KEY  (nimic din Supabase — nu se scrie în DB)
 *
 * Model vision: claude-sonnet-4-6 (Opus doar a scris codul).
 */

import Anthropic from '@anthropic-ai/sdk';
import * as mupdf from 'mupdf';
import pLimit from 'p-limit';
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Config ──────────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-6';
const DEFAULT_DPI = 130;          // ~130 DPI cerut
const MUPDF_BASE_DPI = 72;        // MuPDF: matricea scale 1.0 == 72 DPI
const MAX_TOKENS = 2000;
const DEFAULT_CONCURRENCY = 5;    // pagini procesate în paralel (worker pool, --concurrency)
const MAX_RETRIES = 6;            // retry pe rețea / rate-limit
const BASE_BACKOFF_MS = 1500;     // backoff exponențial: 1.5s, 3s, 6s, ...
// (Throttle-ul fix dintre apeluri a fost eliminat: redundant cu backoff-ul pe 429.)

// ── Batch API (extract:all implicit) ─────────────────────────────────────────
// Limite curente (docs Anthropic): 100.000 cereri SAU 256 MB / batch, ce vine primul.
// O carte (~136 pagini × ~340 KB base64 ≈ 46 MB) încape lejer într-un singur batch;
// chunking-ul de mai jos e doar plasă de siguranță dacă o carte ar depăși pragurile.
const BATCH_MAX_REQUESTS = 100_000;            // limită API: cereri/batch
const BATCH_MAX_BYTES = 200 * 1024 * 1024;     // margine sub 256 MB
const BATCH_POLL_INTERVAL_MS = 15_000;         // poll status la 15s
const BATCH_MAX_WAIT_MS = 24 * 60 * 60 * 1000; // API expiră batch-ul la 24h
// Prețuri standard claude-sonnet-4-6 (USD / 1M tokeni); Batch API = 50%.
const PRICE_INPUT_PER_MTOK = 3;
const PRICE_OUTPUT_PER_MTOK = 15;
const BATCH_DISCOUNT = 0.5;

/** Cost USD pentru tokenii dați. `batch=true` aplică reducerea de 50%. */
export function costUSD(inputTokens: number, outputTokens: number, batch: boolean): number {
  const full = (inputTokens / 1e6) * PRICE_INPUT_PER_MTOK + (outputTokens / 1e6) * PRICE_OUTPUT_PER_MTOK;
  return batch ? full * BATCH_DISCOUNT : full;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUT_DIR = path.join(__dirname, 'output');
const RAW_DIR = path.join(OUTPUT_DIR, 'raw');

// ── Tipuri ───────────────────────────────────────────────────────────────────
type PageKind =
  | 'lectie' | 'exercitii' | 'recapitulare' | 'divider' | 'coperta' | 'necunoscut';
type Confidence = 'high' | 'medium' | 'low';

/** Exact structura cerută de la model. */
interface InventoryRecord {
  printed_page: string | null;
  module: string | null;
  subtopic: string | null;
  page_kind: PageKind;
  concepts_introduced: string[];
  worked_examples_count: number;     // probleme/exemple REZOLVATE în text → material de predare
  proposed_exercises_count: number;  // exerciții PROPUSE elevului → banca de exerciții
  exercise_count: number;            // = worked_examples_count + proposed_exercises_count
  exercise_types: string[];
  confidence: Confidence;
  notes: string;
}

/** Înregistrarea per pagină salvată pe disc (record + metadate de proces). */
interface PageEntry extends InventoryRecord {
  pdf_page: number;             // index 1-based în PDF (ordinea fizică)
  input_tokens: number;
  output_tokens: number;
}

// ── Promptul vision (în română) ───────────────────────────────────────────────
const SYSTEM_PROMPT =
  'Ești un cartograf de manuale școlare. Primești IMAGINEA unei pagini dintr-un manual ' +
  'de matematică din Republica Moldova și întorci DOAR o hartă structurală a paginii, ' +
  'în format JSON strict. NU extragi conținut, NU rezolvi nimic. Răspunzi EXCLUSIV cu ' +
  'obiectul JSON, fără proză, fără markdown, fără ```.';

function buildUserPrompt(pdfPage: number): string {
  return `Aceasta este pagina ${pdfPage} (index fizic în PDF) a manualului.

Întoarce STRICT un singur obiect JSON, EXACT cu această structură și aceste chei:
{
  "printed_page": "<numărul tipărit pe pagină sau null>",
  "module": "<textul antetului 'Modulul N. ...' sau null>",
  "subtopic": "<titlul secțiunii vizibil pe pagină (ex. '§3. Aria subgraficului') sau subtema din bullet '• ...', sau null>",
  "page_kind": "lectie" | "exercitii" | "recapitulare" | "divider" | "coperta" | "necunoscut",
  "concepts_introduced": ["<noțiuni matematice GENUIN NOI, în formă canonică scurtă>"],
  "worked_examples_count": <număr întreg: probleme/exemple REZOLVATE în text>,
  "proposed_exercises_count": <număr întreg: exerciții PROPUSE elevului>,
  "exercise_count": <număr întreg = worked_examples_count + proposed_exercises_count>,
  "exercise_types": ["<etichete scurte: calcul direct, completare tabel, gaseste-greseala, problema vizuala, comparare cu casuta, etc>"],
  "confidence": "high" | "medium" | "low",
  "notes": "<orice e ambiguu sau de remarcat>"
}

REGULI OBLIGATORII:

1. concepts_introduced — listează DOAR ETICHETELE noțiunilor, NU conținutul/definiția lor.
   Aceasta este o HARTĂ, nu o extracție. Aplică strict următoarele filtre anti-zgomot:
   a) Include DOAR noțiuni matematice GENUIN NOI, definite sau introduse pe ACEASTĂ pagină.
   b) EXCLUDE anteturile structurale ale manualului ca atare: "Consecință", "Observație",
      "Teoremă", "Definiție", "Exemplu", "Remarcă", "Propoziție" — sunt etichete editoriale,
      NU concepte. (Dacă o teoremă/definiție introduce o noțiune nouă cu nume propriu,
      listează NOȚIUNEA în sine, nu cuvântul "Teoremă"/"Definiție".)
   c) EXCLUDE termeni folosiți în treacăt care sunt prerechizite din clase anterioare
      (ex. "graficul funcției", "funcție negativă") și fraze generice fără nume propriu
      (ex. "punct arbitrar", "interval elementar" când sunt doar pași de construcție).
   d) Folosește forma CANONICĂ scurtă a numelui (ex. "subgrafic", nu "subgraficul funcției f";
      "corp de rotație", nu "corpul obținut prin rotirea subgraficului..."). NU lista același
      concept de două ori pe aceeași pagină în formulări diferite.

2. module + subtopic — completează AMBELE când sunt vizibile pe pagină: numărul/antetul
   modulului ('Modulul N. ...') ȘI titlul secțiunii ('§N ...'). NU lăsa subtopic null dacă
   pagina arată un titlu de secțiune.

3. worked_examples_count vs proposed_exercises_count — distinge:
   • worked_examples_count = problemele/exemplele REZOLVATE în text (cu soluție afișată,
     ex. marcate "Exemplu", "Model", "Problemă rezolvată"). Devin material de predare.
   • proposed_exercises_count = exercițiile PROPUSE elevului spre rezolvare (fără soluție).
     Devin banca de exerciții.
   exercise_count = worked_examples_count + proposed_exercises_count.

4. NU interpreta enunțurile exercițiilor ca adevăruri matematice. Unele exerciții conțin
   afirmații INTENȚIONAT GREȘITE pe care elevul trebuie să le corecteze (ex. "15 ∗ 3 = 12"
   unde elevul pune semnul corect). Acelea sunt EXERCIȚII, nu fapte — marchează la
   exercise_types eticheta "gaseste-greseala". Nu te alarma și nu le "corecta".

5. Păstrează terminologia română-moldovenească EXACT cum e TIPĂRITĂ pe pagină (cu diacritice;
   scrie "pînă" dacă așa scrie pe pagină, nu "până"). Nu normaliza, nu traduce, nu moderniza.

6. O pagină fără conținut matematic (copertă, ilustrație de modul, divider) primește
   page_kind corespunzător și concepts_introduced [], DAR tot trebuie înregistrată.

7. worked_examples_count, proposed_exercises_count și exercise_count sunt întregi (0 dacă nu e
   cazul). exercise_types poate fi [].

8. Dacă o valoare lipsește, folosește null (pentru string-uri) sau [] (pentru liste).

Răspunde DOAR cu obiectul JSON.`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Pauză. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Document randabil — interfață minimă, stabilă, peste MuPDF.
 * `length` = numărul de pagini; `getPage(pdfPage)` randează pagina (1-based)
 * la PNG și întoarce un Buffer. MuPDF decodează JPEG2000 nativ (compilat în
 * librărie), spre deosebire de pdfjs care eșua cu OpenJPEG WASM.
 */
export interface RenderedDoc {
  length: number;
  getPage(pdfPage: number): Buffer; // 1-based, întoarce PNG Buffer
}

/** Deschide un PDF pentru randare PNG la `dpi` dat, folosind MuPDF (pur WASM, fără binare). */
export async function openPdfForRender(pdfPath: string, dpi: number): Promise<RenderedDoc> {
  const data = await fs.readFile(pdfPath);
  const doc = mupdf.Document.openDocument(new Uint8Array(data), 'application/pdf');
  const scale = dpi / MUPDF_BASE_DPI;
  const matrix = mupdf.Matrix.scale(scale, scale);
  return {
    length: doc.countPages(),
    getPage(pdfPage: number): Buffer {
      const page = doc.loadPage(pdfPage - 1); // 1-based → 0-based (MuPDF)
      try {
        const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
        try {
          return Buffer.from(pixmap.asPNG());
        } finally {
          pixmap.destroy();
        }
      } finally {
        page.destroy();
      }
    },
  };
}

/** Parsează argumentul --pages: listă "4,31,91", interval "10-15", sau mixt "1-5,10". */
function parsePages(spec: string | undefined, total: number): number[] {
  if (!spec || spec.trim() === '') {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  for (const tokenRaw of spec.split(',')) {
    const token = tokenRaw.trim();
    if (token === '') continue;
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let p = lo; p <= hi; p++) set.add(p);
    } else if (/^\d+$/.test(token)) {
      set.add(parseInt(token, 10));
    } else {
      throw new Error(`Token invalid în --pages: "${token}"`);
    }
  }
  const pages = [...set].filter((p) => p >= 1 && p <= total).sort((x, y) => x - y);
  if (pages.length === 0) throw new Error(`--pages nu conține nicio pagină validă (1..${total}).`);
  return pages;
}

/** Cheie de deduplicare a conceptelor (păstrează diacriticele; doar normalizează spațiile/caps). */
function conceptKey(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Extrage primul obiect JSON dintr-un text (tolerează ``` sau proză accidentală). */
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}

/** Validează + normalizează recordul venit de la model într-un InventoryRecord sigur. */
function coerceRecord(raw: unknown): InventoryRecord {
  const o = (raw ?? {}) as Record<string, unknown>;
  const validKinds: PageKind[] = ['lectie', 'exercitii', 'recapitulare', 'divider', 'coperta', 'necunoscut'];
  const validConf: Confidence[] = ['high', 'medium', 'low'];

  const asStrOrNull = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() !== '' ? v : v === null ? null : v == null ? null : String(v);
  const asStrArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => (x as string).trim()) : [];

  const kind = validKinds.includes(o.page_kind as PageKind) ? (o.page_kind as PageKind) : 'necunoscut';
  const conf = validConf.includes(o.confidence as Confidence) ? (o.confidence as Confidence) : 'low';
  const asCount = (v: unknown): number => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0);
  const worked = asCount(o.worked_examples_count);
  const proposed = asCount(o.proposed_exercises_count);
  // exercise_count = suma celor două. Dacă modelul a dat doar totalul (split 0/0), îl păstrăm ca fallback.
  const exCount = worked + proposed > 0 ? worked + proposed : asCount(o.exercise_count);

  return {
    printed_page: asStrOrNull(o.printed_page),
    module: asStrOrNull(o.module),
    subtopic: asStrOrNull(o.subtopic),
    page_kind: kind,
    concepts_introduced: asStrArray(o.concepts_introduced),
    worked_examples_count: worked,
    proposed_exercises_count: proposed,
    exercise_count: exCount,
    exercise_types: asStrArray(o.exercise_types),
    confidence: conf,
    notes: typeof o.notes === 'string' ? o.notes : '',
  };
}

/** Apel vision cu retry + backoff exponențial. Întoarce textul brut + tokenii. */
async function callVision(
  anthropic: Anthropic,
  pngBase64: string,
  pdfPage: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pngBase64 } },
              { type: 'text', text: buildUserPrompt(pdfPage) },
            ],
          },
        ],
      });
      const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      return {
        text,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retriable = status === undefined || status === 408 || status === 409 ||
        status === 429 || status === 529 || (typeof status === 'number' && status >= 500);
      if (!retriable || attempt === MAX_RETRIES) break;
      const backoff = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 500);
      console.warn(`    ↻ retry ${attempt + 1}/${MAX_RETRIES} (status=${status ?? 'net'}) după ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// ── Progres (JSONL, append după fiecare pagină) ──────────────────────────────────
function progressPath(grade: number): string {
  return path.join(OUTPUT_DIR, `clasa-${String(grade).padStart(2, '0')}-progress.jsonl`);
}

/** Citește progresul existent → map pdf_page → PageEntry (pentru resume + asamblare). */
async function readProgress(grade: number): Promise<Map<number, PageEntry>> {
  const map = new Map<number, PageEntry>();
  let content: string;
  try {
    content = await fs.readFile(progressPath(grade), 'utf8');
  } catch {
    return map; // încă nu există
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed) as PageEntry;
      if (typeof entry.pdf_page === 'number') map.set(entry.pdf_page, entry); // ultima câștigă
    } catch {
      // linie coruptă în progres — o ignorăm
    }
  }
  return map;
}

async function appendProgress(grade: number, entry: PageEntry): Promise<void> {
  await fs.appendFile(progressPath(grade), JSON.stringify(entry) + '\n', 'utf8');
}

// ── Asamblarea fișierului final ─────────────────────────────────────────────────
function buildConceptInventory(pages: PageEntry[]) {
  // dedup ÎN COD, ordonat după prima apariție (pdf_page)
  const byKey = new Map<string, {
    name: string; first_seen_pdf_page: number; module: string | null; subtopic: string | null; occurrences: number;
  }>();
  for (const page of pages) {
    for (const concept of page.concepts_introduced) {
      const key = conceptKey(concept);
      const existing = byKey.get(key);
      if (existing) {
        existing.occurrences += 1;
        if (page.pdf_page < existing.first_seen_pdf_page) {
          existing.first_seen_pdf_page = page.pdf_page;
          existing.module = page.module;
          existing.subtopic = page.subtopic;
          existing.name = concept; // numele de la prima apariție
        }
      } else {
        byKey.set(key, {
          name: concept,
          first_seen_pdf_page: page.pdf_page,
          module: page.module,
          subtopic: page.subtopic,
          occurrences: 1,
        });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.first_seen_pdf_page - b.first_seen_pdf_page);
}

async function writeFinalOutput(grade: number, pageCount: number, entries: Map<number, PageEntry>) {
  const pages = [...entries.values()].sort((a, b) => a.pdf_page - b.pdf_page);
  const concept_inventory = buildConceptInventory(pages);

  const stats = {
    page_count: pageCount,
    pages_processed: pages.length,
    total_exercises: pages.reduce((s, p) => s + p.exercise_count, 0),
    low_confidence_pages: pages.filter((p) => p.confidence === 'low').map((p) => p.pdf_page),
    parse_failures: pages.filter((p) => p.notes.includes('parse_failed')).map((p) => p.pdf_page),
  };

  const out = {
    grade,
    pdf_page_count: pageCount,
    generated_at: new Date().toISOString(),
    model: MODEL,
    dpi: DEFAULT_DPI,
    pages,
    concept_inventory,
    stats,
  };

  const outPath = path.join(OUTPUT_DIR, `clasa-${String(grade).padStart(2, '0')}-inventory.json`);
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  return { outPath, stats, pages, conceptCount: concept_inventory.length };
}

// ── Logica de inventar (reutilizabilă: o cheamă și CLI-ul, și lotul) ───────────

/** Opțiuni pentru o rulare de inventar pe O carte. */
export interface RunInventoryOptions {
  pdf: string;                 // calea către PDF
  grade: number;               // clasa (1..12)
  pages?: string;              // spec --pages ("4,31" | "10-15"); gol/undefined = toate
  dpi?: number;                // implicit DEFAULT_DPI
  concurrency?: number;        // pagini în paralel (implicit DEFAULT_CONCURRENCY)
  anthropic?: Anthropic;       // client reutilizabil (lotul îl partajează între cărți)
}

/** Rezumatul unei rulări pe O carte (folosit de lot pentru _summary.json). */
export interface RunInventoryResult {
  grade: number;
  outPath: string;
  pageCount: number;
  pages_processed: number;
  processed_now: number;
  total_concepts: number;
  low_confidence_count: number;
  parse_failures_count: number;
  input_tokens: number;
  output_tokens: number;
}

/**
 * Rulează inventarul vision pe O carte (toate paginile sau cele din `pages`).
 * Aceeași logică folosită de CLI și de runner-ul de lot — NU se duplică.
 * Resume la nivel de pagină (din progresul JSONL). Aruncă doar pe erori fatale
 * (PDF inexistent, lipsă API key); erorile per-pagină sunt izolate intern.
 */
export async function runInventory(opts: RunInventoryOptions): Promise<RunInventoryResult> {
  const { pdf: pdfPathArg, grade } = opts;
  const dpi = opts.dpi ?? DEFAULT_DPI;
  const concurrency = Math.max(1, Math.trunc(opts.concurrency ?? DEFAULT_CONCURRENCY));

  let anthropic = opts.anthropic;
  if (!anthropic) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
    anthropic = new Anthropic({ apiKey: anthropicKey });
  }
  // Client stabil (non-null) pentru closure-urile din pool-ul de concurrency.
  const client: Anthropic = anthropic;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(RAW_DIR, { recursive: true });

  // Randare PDF → imagini (MuPDF WASM, fără binare de sistem; decodează JPEG2000 nativ)
  const scale = dpi / MUPDF_BASE_DPI;
  console.log(`📄 Deschid PDF: ${pdfPathArg}  (scale ${scale.toFixed(3)} ≈ ${dpi} DPI, MuPDF)`);
  const doc = await openPdfForRender(pdfPathArg, dpi);
  const pageCount = doc.length;
  console.log(`   → ${pageCount} pagini în PDF.`);

  const targetPages = parsePages(opts.pages, pageCount);
  console.log(`🎯 Clasa ${grade} · de procesat: ${targetPages.length} pagini ` +
    `[${targetPages.slice(0, 12).join(', ')}${targetPages.length > 12 ? ', …' : ''}]`);

  // Resume
  const done = await readProgress(grade);
  const todo = targetPages.filter((p) => !done.has(p));
  const skipping = targetPages.length - todo.length;
  if (skipping > 0) console.log(`⏭️  ${skipping} pagini deja în progres — le sar.`);

  let totalIn = 0;
  let totalOut = 0;
  let processedNow = 0;
  const tStart = Date.now();
  const NN = String(grade).padStart(2, '0');

  console.log(`⚙️  Concurrency: ${concurrency} pagini în paralel · ` +
    `throttle fix dezactivat (doar backoff exponențial pe 429/rate-limit).`);

  // Scrieri în progres serializate: append-uri concurente pot interleava linii lungi.
  // Le lanțuim într-o coadă promisă → fiecare linie JSONL se scrie atomic, în ordinea finalizării.
  let writeChain: Promise<void> = Promise.resolve();
  const appendProgressSafe = (entry: PageEntry): Promise<void> => {
    writeChain = writeChain.then(() => appendProgress(grade, entry));
    return writeChain;
  };

  const limit = pLimit(concurrency);

  /** Procesează O pagină end-to-end (randare → vision → parse → progres). Erorile sunt izolate. */
  async function processPage(pdfPage: number): Promise<void> {
    let entry: PageEntry;
    try {
      const png = doc.getPage(pdfPage); // Buffer PNG, 1-based (MuPDF, sincron — JS e single-thread)
      const b64 = png.toString('base64');

      const { text, inputTokens, outputTokens } = await callVision(client, b64, pdfPage);
      totalIn += inputTokens;
      totalOut += outputTokens;

      let record: InventoryRecord;
      const jsonStr = extractJson(text);
      if (!jsonStr) {
        await fs.writeFile(path.join(RAW_DIR, `clasa-${NN}-page-${pdfPage}.txt`), text, 'utf8');
        record = { ...coerceRecord({}), confidence: 'low', notes: 'parse_failed: niciun JSON găsit' };
      } else {
        try {
          record = coerceRecord(JSON.parse(jsonStr));
        } catch {
          await fs.writeFile(path.join(RAW_DIR, `clasa-${NN}-page-${pdfPage}.txt`), text, 'utf8');
          record = { ...coerceRecord({}), confidence: 'low', notes: 'parse_failed: JSON invalid' };
        }
      }

      entry = { pdf_page: pdfPage, ...record, input_tokens: inputTokens, output_tokens: outputTokens };
    } catch (err) {
      // Eroare definitivă (după retry) pe această pagină — NU oprim restul paginilor.
      entry = {
        pdf_page: pdfPage,
        ...coerceRecord({}),
        confidence: 'low',
        notes: `parse_failed: apel eșuat — ${(err as Error)?.message ?? 'necunoscut'}`,
        input_tokens: 0,
        output_tokens: 0,
      };
    }

    await appendProgressSafe(entry); // scriere serializată, după FIECARE pagină finalizată
    done.set(pdfPage, entry);
    processedNow++;

    // Un singur console.log per pagină (atomic la concurrency) + rata efectivă curentă.
    const rate = processedNow / Math.max(1e-6, (Date.now() - tStart) / 60000); // pagini/min
    const tag = entry.notes.includes('parse_failed')
      ? `⚠️  ${entry.notes}`
      : `✓ ${entry.page_kind} · ${entry.concepts_introduced.length} concepte · ` +
        `${entry.exercise_count} ex · conf=${entry.confidence}`;
    console.log(`  📄 p.${pdfPage}/${pageCount} ${tag}  ` +
      `[in ${entry.input_tokens} / out ${entry.output_tokens} tok]  ` +
      `(${processedNow}/${todo.length} · ${rate.toFixed(1)} pag/min)`);
  }

  // Worker pool: cel mult `concurrency` pagini simultan (NU toate deodată).
  await Promise.all(todo.map((pdfPage) => limit(() => processPage(pdfPage))));
  await writeChain; // toate append-urile scrise înainte de asamblarea finală

  // Asamblare fișier final (include și paginile din rulări anterioare aflate în scope)
  const inScope = new Map<number, PageEntry>();
  for (const p of targetPages) {
    const e = done.get(p);
    if (e) inScope.set(p, e);
  }
  const { outPath, stats, conceptCount } = await writeFinalOutput(grade, pageCount, inScope);

  const elapsedMin = (Date.now() - tStart) / 60000;
  const effRate = processedNow / Math.max(1e-6, elapsedMin);

  console.log('\n──────── REZUMAT ────────');
  console.log(`Concurrency:             ${concurrency} pagini în paralel`);
  console.log(`Pagini procesate acum:   ${processedNow} în ${elapsedMin.toFixed(1)} min` +
    (processedNow > 0 ? `  →  ${effRate.toFixed(1)} pag/min` : ''));
  console.log(`Pagini în inventar:      ${stats.pages_processed} / ${pageCount}`);
  console.log(`Concepte (deduplicate):  ${conceptCount}`);
  console.log(`Total exerciții:         ${stats.total_exercises}`);
  console.log(`Pagini low-confidence:   [${stats.low_confidence_pages.join(', ')}]`);
  console.log(`Parse failures:          [${stats.parse_failures.join(', ')}]`);
  console.log(`Tokeni (rularea asta):   in ${totalIn} / out ${totalOut} (total ${totalIn + totalOut})`);
  console.log(`Cost (sync, preț plin):  $${costUSD(totalIn, totalOut, false).toFixed(4)}`);
  console.log(`Fișier inventar:         ${outPath}`);

  return {
    grade,
    outPath,
    pageCount,
    pages_processed: stats.pages_processed,
    processed_now: processedNow,
    total_concepts: conceptCount,
    low_confidence_count: stats.low_confidence_pages.length,
    parse_failures_count: stats.parse_failures.length,
    input_tokens: totalIn,
    output_tokens: totalOut,
  };
}

// ── Inventar via Batch API (asincron, 50% reducere) ──────────────────────────
type BatchRequest = Anthropic.Messages.BatchCreateParams.Request;

/** custom_id stabil pentru maparea rezultat → pagină: "g{grade}_p{pdf_page}". */
function buildCustomId(grade: number, pdfPage: number): string {
  return `g${grade}_p${pdfPage}`;
}
function parseCustomId(id: string): { grade: number; pdfPage: number } | null {
  const m = id.match(/^g(\d+)_p(\d+)$/);
  if (!m) return null;
  return { grade: parseInt(m[1], 10), pdfPage: parseInt(m[2], 10) };
}

/** O cerere de batch per pagină: ACELAȘI model/prompt/imagine ca în modul sync. */
function buildBatchRequest(grade: number, pdfPage: number, pngB64: string): BatchRequest {
  return {
    custom_id: buildCustomId(grade, pdfPage),
    params: {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pngB64 } },
            { type: 'text', text: buildUserPrompt(pdfPage) },
          ],
        },
      ],
    },
  };
}

/** Împarte cererile în sub-batch-uri sub limitele API (cereri + bytes). De regulă: un singur chunk. */
function chunkRequests<T extends { bytes: number }>(items: T[]): T[][] {
  const chunks: T[][] = [];
  let cur: T[] = [];
  let curBytes = 0;
  for (const it of items) {
    if (cur.length > 0 && (cur.length + 1 > BATCH_MAX_REQUESTS || curBytes + it.bytes > BATCH_MAX_BYTES)) {
      chunks.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(it);
    curBytes += it.bytes;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Poll status până la `ended` (sau eroare la 24h). Loghează tally-ul de cereri. */
async function pollBatchUntilDone(
  anthropic: Anthropic,
  batchId: string,
  label: string,
): Promise<Anthropic.Messages.MessageBatch> {
  const start = Date.now();
  for (;;) {
    const batch = await anthropic.messages.batches.retrieve(batchId);
    if (batch.processing_status === 'ended') return batch;
    const c = batch.request_counts;
    const mins = ((Date.now() - start) / 60000).toFixed(1);
    console.log(`    ⏳ ${label}: ${batch.processing_status} · proc=${c.processing} ok=${c.succeeded} ` +
      `err=${c.errored} exp=${c.expired} (${mins} min)`);
    if (Date.now() - start > BATCH_MAX_WAIT_MS) {
      throw new Error(`Batch ${batchId} a depășit 24h fără finalizare.`);
    }
    await sleep(BATCH_POLL_INTERVAL_MS);
  }
}

/**
 * Rulează inventarul pe O carte prin Message Batches API (50% reducere).
 * ACELAȘI prompt/model/imagini ca modul sync; doar transportul diferă.
 * Resume: re-trimite DOAR paginile lipsă sau marcate parse_failed.
 * Erori per-cerere izolate (errored/expired/canceled → pagină parse_failed).
 */
export async function runInventoryBatch(opts: RunInventoryOptions): Promise<RunInventoryResult> {
  const { pdf: pdfPathArg, grade } = opts;
  const dpi = opts.dpi ?? DEFAULT_DPI;

  let anthropic = opts.anthropic;
  if (!anthropic) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
    anthropic = new Anthropic({ apiKey: anthropicKey });
  }
  const client: Anthropic = anthropic;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(RAW_DIR, { recursive: true });

  const scale = dpi / MUPDF_BASE_DPI;
  console.log(`📄 Deschid PDF: ${pdfPathArg}  (scale ${scale.toFixed(3)} ≈ ${dpi} DPI, MuPDF)`);
  const doc = await openPdfForRender(pdfPathArg, dpi);
  const pageCount = doc.length;
  console.log(`   → ${pageCount} pagini în PDF.`);

  const targetPages = parsePages(opts.pages, pageCount);

  // Resume: re-trimite paginile lipsă SAU eșuate (parse_failed) din rulări anterioare.
  const done = await readProgress(grade);
  const needsRedo = (e?: PageEntry) => !e || e.notes.includes('parse_failed');
  const todo = targetPages.filter((p) => needsRedo(done.get(p)));
  const skipping = targetPages.length - todo.length;
  console.log(`🎯 Clasa ${grade} (BATCH) · de trimis: ${todo.length} pagini` +
    (skipping > 0 ? ` · ${skipping} deja OK în progres — le sar.` : ''));

  const NN = String(grade).padStart(2, '0');
  let totalIn = 0;
  let totalOut = 0;
  let processedNow = 0;
  const tStart = Date.now();

  // Scrieri progres serializate (rezultatele pot veni concurent din stream).
  let writeChain: Promise<void> = Promise.resolve();
  const appendProgressSafe = (entry: PageEntry): Promise<void> => {
    writeChain = writeChain.then(() => appendProgress(grade, entry));
    return writeChain;
  };

  if (todo.length > 0) {
    // 1. Randează toate paginile de trimis și construiește cererile.
    console.log(`🖼️  Randez ${todo.length} pagini (MuPDF) și construiesc cererile…`);
    const items = todo.map((p) => {
      const b64 = doc.getPage(p).toString('base64');
      const req = buildBatchRequest(grade, p, b64);
      return { page: p, req, bytes: b64.length + 4096 /* prompt+overhead aprox */ };
    });

    // 2. UN batch per carte (chunking doar dacă depășește limitele).
    const chunks = chunkRequests(items);
    const totalMB = (items.reduce((s, it) => s + it.bytes, 0) / 1024 / 1024).toFixed(1);
    console.log(`📦 ${items.length} cereri (~${totalMB} MB) → ${chunks.length} batch(uri).`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const label = `cl.${grade} batch ${i + 1}/${chunks.length}`;
      const created = await client.messages.batches.create({ requests: chunk.map((c) => c.req) });
      console.log(`   ▶ ${label} trimis: ${created.id} (${chunk.length} cereri).`);

      const ended = await pollBatchUntilDone(client, created.id, label);
      console.log(`   ✓ ${label} ended: ok=${ended.request_counts.succeeded} ` +
        `err=${ended.request_counts.errored} exp=${ended.request_counts.expired}. Descarc rezultatele…`);

      // 3+4. Parsează rezultatele (ordine arbitrară → mapez după custom_id).
      const results = await client.messages.batches.results(created.id);
      for await (const item of results) {
        const parsed = parseCustomId(item.custom_id);
        if (!parsed) {
          console.warn(`    ⚠️  custom_id necunoscut, îl sar: ${item.custom_id}`);
          continue;
        }
        const pdfPage = parsed.pdfPage;
        let entry: PageEntry;

        if (item.result.type === 'succeeded') {
          const msg = item.result.message;
          totalIn += msg.usage.input_tokens;
          totalOut += msg.usage.output_tokens;
          const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');

          let record: InventoryRecord;
          const jsonStr = extractJson(text);
          if (!jsonStr) {
            await fs.writeFile(path.join(RAW_DIR, `clasa-${NN}-page-${pdfPage}.txt`), text, 'utf8');
            record = { ...coerceRecord({}), confidence: 'low', notes: 'parse_failed: niciun JSON găsit' };
          } else {
            try {
              record = coerceRecord(JSON.parse(jsonStr));
            } catch {
              await fs.writeFile(path.join(RAW_DIR, `clasa-${NN}-page-${pdfPage}.txt`), text, 'utf8');
              record = { ...coerceRecord({}), confidence: 'low', notes: 'parse_failed: JSON invalid' };
            }
          }
          entry = {
            pdf_page: pdfPage,
            ...record,
            input_tokens: msg.usage.input_tokens,
            output_tokens: msg.usage.output_tokens,
          };
        } else {
          // errored / expired / canceled → pagină parse_failed, NU oprim cartea.
          const why =
            item.result.type === 'errored'
              ? `errored — ${item.result.error?.error?.message ?? 'eroare necunoscută'}`
              : item.result.type;
          entry = {
            pdf_page: pdfPage,
            ...coerceRecord({}),
            confidence: 'low',
            notes: `parse_failed: batch ${why}`,
            input_tokens: 0,
            output_tokens: 0,
          };
        }

        await appendProgressSafe(entry);
        done.set(pdfPage, entry);
        processedNow++;
        const tag = entry.notes.includes('parse_failed')
          ? `⚠️  ${entry.notes}`
          : `✓ ${entry.page_kind} · ${entry.concepts_introduced.length} concepte · ` +
            `${entry.exercise_count} ex · conf=${entry.confidence}`;
        console.log(`    📄 p.${pdfPage}/${pageCount} ${tag}  [in ${entry.input_tokens} / out ${entry.output_tokens} tok]`);
      }
    }
    await writeChain;
  }

  // Asamblare finală — ACEEAȘI structură (pages / concept_inventory / stats).
  const inScope = new Map<number, PageEntry>();
  for (const p of targetPages) {
    const e = done.get(p);
    if (e) inScope.set(p, e);
  }
  const { outPath, stats, conceptCount } = await writeFinalOutput(grade, pageCount, inScope);

  const elapsedMin = (Date.now() - tStart) / 60000;
  const cost = costUSD(totalIn, totalOut, true);

  console.log('\n──────── REZUMAT (BATCH) ────────');
  console.log(`Pagini trimise acum:     ${processedNow} în ${elapsedMin.toFixed(1)} min`);
  console.log(`Pagini în inventar:      ${stats.pages_processed} / ${pageCount}`);
  console.log(`Concepte (deduplicate):  ${conceptCount}`);
  console.log(`Total exerciții:         ${stats.total_exercises}`);
  console.log(`Pagini low-confidence:   [${stats.low_confidence_pages.join(', ')}]`);
  console.log(`Parse failures:          [${stats.parse_failures.join(', ')}]`);
  console.log(`Tokeni (rularea asta):   in ${totalIn} / out ${totalOut} (total ${totalIn + totalOut})`);
  console.log(`Cost (batch 50%):        $${cost.toFixed(4)}`);
  console.log(`Fișier inventar:         ${outPath}`);

  return {
    grade,
    outPath,
    pageCount,
    pages_processed: stats.pages_processed,
    processed_now: processedNow,
    total_concepts: conceptCount,
    low_confidence_count: stats.low_confidence_pages.length,
    parse_failures_count: stats.parse_failures.length,
    input_tokens: totalIn,
    output_tokens: totalOut,
  };
}

// ── CLI (o singură carte) ──────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      pdf: { type: 'string' },
      grade: { type: 'string' },
      pages: { type: 'string' },
      dpi: { type: 'string' },
      concurrency: { type: 'string' },
      batch: { type: 'boolean' }, // o singură carte prin Batch API (implicit: sync)
    },
  });

  const pdfPathArg = values.pdf;
  const gradeArg = values.grade;
  if (!pdfPathArg || !gradeArg) {
    console.error('Utilizare: npm run extract:inventory -- --pdf <cale> --grade <1-12> [--pages "4,31,91"|"10-15"] [--dpi 130] [--concurrency 5] [--batch]');
    process.exit(1);
  }
  const grade = parseInt(gradeArg, 10);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
    console.error(`❌ --grade trebuie să fie un întreg 1-12 (primit: "${gradeArg}")`);
    process.exit(1);
  }
  const dpi = values.dpi ? parseInt(values.dpi, 10) : DEFAULT_DPI;
  const concurrency = values.concurrency ? parseInt(values.concurrency, 10) : DEFAULT_CONCURRENCY;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    console.error(`❌ --concurrency trebuie să fie un întreg ≥ 1 (primit: "${values.concurrency}")`);
    process.exit(1);
  }

  try {
    const run = values.batch ? runInventoryBatch : runInventory;
    await run({ pdf: pdfPathArg, grade, pages: values.pages, dpi, concurrency });
  } catch (err) {
    console.error(`❌ ${(err as Error)?.message ?? err}`);
    process.exit(1);
  }
}

// Rulează main() DOAR când fișierul e invocat direct ca script, nu când e importat (lotul).
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error('\n💥 Eroare fatală:', err);
    process.exit(1);
  });
}
