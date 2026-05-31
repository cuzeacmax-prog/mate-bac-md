/**
 * 17-place-exercises.ts — ETAPA 17: plasează exercițiile la NODURI (concepte) prin embedding.
 *
 * Rulează:
 *   npm run place:exercises                 # toate exercițiile (până la cota Gemini)
 *   npm run place:exercises -- --limit 20   # probă
 *   npm run place:exercises -- --resume     # refolosește embedding-urile din cache (zero re-plată)
 *
 * Pentru fiecare exercise_raw: embed enunțul ca RETRIEVAL_QUERY (Gemini, L2-normalizat manual la 1536,
 * IDENTIC cu conceptele) → pgvector cosine → cele mai apropiate 3 concepte → PROPUNERI (nu adevăr) în
 * exercise_concept_link (similarity, rank). Idempotent. La epuizarea cotei se oprește CURAT.
 *
 * NU atinge concepts/concept_edges/exercise_raw/exercise_verification. Doar exercise_concept_link.
 * Requires: GOOGLE_GENERATIVE_AI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedQuery, EMBEDDING_DIMENSIONS, ACTIVE_PROVIDER } from '../../src/lib/embeddings';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(__dirname, '_ex_embeddings.json');
const MAX_CHARS = 6000;
const CONCURRENCY = 8;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;
const TOP_K = 3;
const PRICE_PER_MTOK = 0.02; // text-embedding-3-small

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isQuota = (m: string) => /429|RESOURCE_EXHAUSTED|quota/i.test(m);
function l2normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n === 0 ? v : v.map((x) => x / n);
}

async function main() {
  const { values } = parseArgs({ options: { resume: { type: 'boolean' }, limit: { type: 'string' } } });
  const limitN = values.limit ? parseInt(values.limit, 10) : undefined;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (ACTIVE_PROVIDER === 'openai' && !process.env.OPENAI_API_KEY) throw new Error('Lipsește OPENAI_API_KEY.');
  if (ACTIVE_PROVIDER === 'gemini' && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error('Lipsește GOOGLE_GENERATIVE_AI_API_KEY.');
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = createClient(url, key);
  console.log(`🧠 Provider embeddings ACTIV: ${ACTIVE_PROVIDER} (${EMBEDDING_DIMENSIONS} dims).`);

  // 1. Exercițiile.
  interface Ex { id: string; exercise_number: string; module: string | null; statement: string }
  const exercises: Ex[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('exercise_raw')
      .select('id, exercise_number, module, statement').order('pdf_page').order('exercise_number').range(f, f + 999);
    if (error) throw new Error(`exercise_raw: ${error.message}`);
    if (!data || data.length === 0) break;
    exercises.push(...(data as Ex[]));
    if (data.length < 1000) break;
  }
  const todo = limitN !== undefined ? exercises.slice(0, limitN) : exercises;
  console.log(`🎯 ${exercises.length} exerciții (de procesat: ${todo.length}).`);

  // 2. Cache de embedding-uri (zero re-plată la --resume).
  const cache: Record<string, number[]> = values.resume && fs.existsSync(CACHE)
    ? JSON.parse(fs.readFileSync(CACHE, 'utf-8')) : {};
  const haveCache = Object.keys(cache).length;
  const toEmbed = todo.filter((e) => !cache[e.id]);
  console.log(`📦 cache: ${haveCache} embedding-uri · de embeddat acum: ${toEmbed.length} (RETRIEVAL_QUERY).`);

  // 3. Embed până la cotă/eroare dură.
  const limit = pLimit(CONCURRENCY);
  let embedded = 0, totalTokens = 0, quotaHit = false;
  await Promise.all(toEmbed.map((e) => limit(async () => {
    if (quotaHit) return;
    const text = `${e.module ? e.module + '. ' : ''}${e.statement}`.slice(0, MAX_CHARS);
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (quotaHit) return;
      try {
        const { embedding, tokens } = await embedQuery(text);
        if (embedding.length !== EMBEDDING_DIMENSIONS) throw new Error(`dim ${embedding.length}`);
        cache[e.id] = l2normalize(embedding);
        totalTokens += tokens;
        if (++embedded % 100 === 0) { process.stdout.write(`\r  embeddate ${embedded}/${toEmbed.length} `); fs.writeFileSync(CACHE, JSON.stringify(cache)); }
        return;
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        if (isQuota(msg)) { quotaHit = true; return; } // cotă atinsă → oprire curată
        if (attempt === MAX_RETRIES) return;
        await sleep(BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 1000));
      }
    }
  })));
  const embCost = (totalTokens / 1e6) * PRICE_PER_MTOK;
  console.log(`\n✓ embeddate acum: ${embedded} · tokeni ${totalTokens} · cost ~$${embCost.toFixed(4)} (${ACTIVE_PROVIDER})${quotaHit ? '  ⛔ cotă atinsă — oprire curată' : ''}`);
  fs.writeFileSync(CACHE, JSON.stringify(cache));

  // 4. Match top-3 pentru fiecare exercițiu care ARE embedding.
  const withVec = todo.filter((e) => cache[e.id]);
  interface LinkRow { exercise_id: string; concept_id: string; similarity: number; rank: number }
  const links: LinkRow[] = [];
  const mlimit = pLimit(CONCURRENCY);
  let matched = 0;
  await Promise.all(withVec.map((e) => mlimit(async () => {
    const { data, error } = await supabase.rpc('match_concepts_for_exercise', {
      query_embedding: JSON.stringify(cache[e.id]), match_count: TOP_K,
    });
    if (error) { console.error(`  ⚠ match ${e.exercise_number}: ${error.message}`); return; }
    (data as Array<{ concept_id: string; similarity: number }>).forEach((row, i) => {
      links.push({ exercise_id: e.id, concept_id: row.concept_id, similarity: row.similarity, rank: i + 1 });
    });
    matched++;
  })));
  console.log(`🔗 potrivite ${matched} exerciții → ${links.length} propuneri (top-${TOP_K}).`);

  // 5. Idempotent: șterge propunerile exercițiilor atinse, apoi insert.
  const ids = withVec.map((e) => e.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from('exercise_concept_link').delete().in('exercise_id', ids.slice(i, i + 100));
    if (error) throw new Error(`Ștergere: ${error.message}`);
  }
  for (let i = 0; i < links.length; i += 500) {
    const { error } = await supabase.from('exercise_concept_link').insert(links.slice(i, i + 500));
    if (error) throw new Error(`Insert [${i}]: ${error.message}`);
  }

  // 6. VERIFICARE din DB + eșantion.
  const { count: linkCount } = await supabase.from('exercise_concept_link').select('*', { count: 'exact', head: true });
  const { count: exPlaced } = await supabase.from('exercise_concept_link').select('exercise_id', { count: 'exact', head: true }).eq('rank', 1);
  console.log('\n──────── VERIFICARE PLASARE (din DB reală) ────────');
  console.log(`Propuneri în exercise_concept_link: ${linkCount}  ·  exerciții plasate (rank=1): ${exPlaced}`);
  console.log(`Embedding-uri exerciții în cache: ${Object.keys(cache).length} / ${exercises.length}`);

  const { data: sample } = await supabase.from('exercise_concept_link')
    .select('similarity, rank, exercise_raw!inner(exercise_number, statement), concepts!inner(name)')
    .order('exercise_id').order('rank').limit(15);
  console.log('\nEșantion (enunț → top-3 concepte propuse):');
  let lastEx = '';
  for (const s of (sample ?? []) as unknown as Array<{ similarity: number; rank: number; exercise_raw: { exercise_number: string; statement: string }; concepts: { name: string } }>) {
    const ex = s.exercise_raw;
    if (ex.exercise_number !== lastEx) { console.log(`\n  nr.${ex.exercise_number}: ${ex.statement.slice(0, 90)}`); lastEx = ex.exercise_number; }
    console.log(`    ${s.rank}. ${s.concepts.name.slice(0, 50)}  (sim ${s.similarity.toFixed(3)})`);
  }
  console.log('\n✅ Doar exercise_concept_link + embeddings noi (cache). Restul: neatins.');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
