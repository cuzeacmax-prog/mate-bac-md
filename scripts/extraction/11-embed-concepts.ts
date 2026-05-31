/**
 * 11-embed-concepts.ts — ETAPA 10: embeddings pentru concepte (Gemini, 1536 dim, NORMALIZATE).
 *
 * Rulează:  npm run extract:embed
 *           npm run extract:embed -- --missing-only   (doar cele fără embedding — reluare după cap)
 *
 * Model: gemini-embedding-001, output_dimensionality=1536, task_type=RETRIEVAL_DOCUMENT.
 * CRITIC: la 1536 dim modelul NU normalizează → normalizăm noi (L2) înainte de stocare.
 * Sursă: concepts cu body non-gol și needs_reextraction=false. Idempotent. Free tier → backoff pe 429.
 *
 * NU atinge alte coloane/tabele.
 * Requires: GOOGLE_GENERATIVE_AI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedDocument, EMBEDDING_DIMENSIONS, ACTIVE_PROVIDER, type EmbedResult } from '../../src/lib/embeddings';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DONE_CACHE = path.join(__dirname, '_concept_embed_done.json');
const MAX_CHARS = 6000;          // text-ul de embeddat sub limita de tokeni a modelului
const CONCURRENCY = 8;
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 2000;
const PRICE_PER_MTOK = 0.02;     // text-embedding-3-small: $0.02 / 1M tokeni

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function makeClient(url: string, key: string) { return createClient(url, key); }

function l2normalize(v: number[]): number[] {
  let s = 0; for (const x of v) s += x * x;
  const n = Math.sqrt(s);
  return n === 0 ? v : v.map((x) => x / n);
}
const l2norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

async function embedWithRetry(text: string, label: string): Promise<EmbedResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await embedDocument(text);
    } catch (err: unknown) {
      lastErr = err;
      const msg = (err as Error)?.message ?? String(err);
      const retriable = /429|RESOURCE_EXHAUSTED|quota|rate|503|500|UNAVAILABLE|deadline|ECONNRESET|fetch failed/i.test(msg);
      if (!retriable || attempt === MAX_RETRIES) break;
      const backoff = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 1000);
      console.warn(`    ↻ ${label}: retry ${attempt + 1}/${MAX_RETRIES} (${msg.slice(0, 50)}) după ${(backoff / 1000).toFixed(0)}s`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

async function main() {
  const missingOnly = process.argv.includes('--missing-only');
  const resume = process.argv.includes('--resume');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (ACTIVE_PROVIDER === 'gemini' && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error('Lipsește GOOGLE_GENERATIVE_AI_API_KEY.');
  if (ACTIVE_PROVIDER === 'openai' && !process.env.OPENAI_API_KEY) throw new Error('Lipsește OPENAI_API_KEY.');
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = makeClient(url, key);
  console.log(`🧠 Provider embeddings ACTIV: ${ACTIVE_PROVIDER} (${EMBEDDING_DIMENSIONS} dims).`);

  // 1. Concepte cu body, fără needs_reextraction. La schimbarea de provider: RE-EMBED TOT (nu missing-only).
  console.log(`📥 Citesc conceptele de embeddat${missingOnly ? ' (doar fără embedding)' : ' (TOATE — spațiu consistent)'} …`);
  interface Row { id: string; name: string; body: string; embedding: unknown }
  const rows: Row[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('concepts').select('id, name, body, embedding')
      .eq('needs_reextraction', false).not('body', 'is', null).neq('body', '').range(f, f + 999);
    if (error) throw new Error(`Citire concepts: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
  }
  const doneCache: Set<string> = resume && fs.existsSync(DONE_CACHE)
    ? new Set(JSON.parse(fs.readFileSync(DONE_CACHE, 'utf-8')) as string[]) : new Set();
  let todo = missingOnly ? rows.filter((r) => r.embedding == null) : rows;
  if (resume) todo = todo.filter((r) => !doneCache.has(r.id));
  console.log(`   → ${rows.length} concepte cu body; de embeddat: ${todo.length}${resume ? ` (cache: ${doneCache.size})` : ''}.`);
  if (todo.length === 0) { console.log('   (nimic de făcut)'); }

  // 2. Embed + normalizează + scrie (concurrency + backoff).
  const limit = pLimit(CONCURRENCY);
  let done = 0, fails = 0, totalTokens = 0;
  const normSamples: number[] = [];
  const t0 = Date.now();
  const flushCache = () => fs.writeFileSync(DONE_CACHE, JSON.stringify([...doneCache]));
  await Promise.all(todo.map((r) => limit(async () => {
    try {
      const text = `${r.name}\n\n${r.body}`.slice(0, MAX_CHARS);
      const { embedding, tokens } = await embedWithRetry(text, r.name.slice(0, 30));
      if (embedding.length !== EMBEDDING_DIMENSIONS) throw new Error(`dim ${embedding.length} ≠ ${EMBEDDING_DIMENSIONS}`);
      totalTokens += tokens;
      const vec = l2normalize(embedding);
      if (normSamples.length < 5) normSamples.push(l2norm(vec));
      const { error } = await supabase.from('concepts').update({ embedding: vec }).eq('id', r.id);
      if (error) throw new Error(`update: ${error.message}`);
      doneCache.add(r.id);
      done++;
      if (done % 100 === 0) {
        const rate = done / Math.max(1e-6, (Date.now() - t0) / 60000);
        process.stdout.write(`\r  embeddate ${done}/${todo.length} (${rate.toFixed(0)}/min) `);
        flushCache();
      }
    } catch (err) {
      fails++;
      if (fails <= 8) console.error(`\n  ❌ ${r.name.slice(0, 40)}: ${(err as Error)?.message ?? err}`);
    }
  })));
  flushCache();
  const cost = (totalTokens / 1e6) * PRICE_PER_MTOK;
  console.log(`\n✓ Embeddate acum: ${done} · eșuate: ${fails} · tokeni ${totalTokens} · cost ~$${cost.toFixed(4)} (${ACTIVE_PROVIDER})`);
  if (normSamples.length) console.log(`  Norme post-normalizare (eșantion la generare): ${normSamples.map((n) => n.toFixed(4)).join(', ')}  (≈ 1.0)`);

  // 3. VERIFICARE din DB reală.
  const { count: withEmb } = await supabase.from('concepts').select('*', { count: 'exact', head: true }).not('embedding', 'is', null);
  const { count: bodyTotal } = await supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('needs_reextraction', false).not('body', 'is', null).neq('body', '');
  // Eșantion: dimensiune + normă citite înapoi din DB.
  const { data: sample } = await supabase.from('concepts').select('name, embedding').not('embedding', 'is', null).limit(3);
  console.log('\n──────── VERIFICARE (din DB reală) ────────');
  console.log(`Concepte cu embedding non-null: ${withEmb}   (din ${bodyTotal} cu body)`);
  for (const s of (sample ?? []) as { name: string; embedding: unknown }[]) {
    const v = typeof s.embedding === 'string' ? (JSON.parse(s.embedding) as number[]) : (s.embedding as number[]);
    console.log(`  • "${s.name.slice(0, 40)}": dim=${v.length} · normă=${l2norm(v).toFixed(5)}`);
  }
  console.log('\n✅ Doar concepts.embedding actualizat. Alte coloane/tabele: neatinse.');
  if (fails > 0) process.exitCode = 1;
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
