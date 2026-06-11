/**
 * ETAPA 75 FAZA E — embeddings PERSISTATE pentru toate exercițiile (1268).
 *
 * Spațiul vectorial = gemini-embedding-001, 1536 dims (ACELAȘI cu interogările
 * din chat — generateEmbeddingForQuery; regula critică: nu amesteca provideri).
 * Idempotent: doar rândurile cu embedding NULL se procesează.
 *
 *   npx tsx --env-file=.env.local scripts/etapa75/embed-exercises.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { generateEmbedding } from '../../src/lib/embeddings/gemini';

async function main() {
  const svc = createServiceClient();
  // SERVIBILELE întâi — pool-ul care contează pentru „biblioteca răspunde prima";
  // cota zilnică free-tier (1000/zi) poate tăia restul, reluăm idempotent.
  const { data: servable } = await svc.from('exercise_servable').select('exercise_id');
  const servableSet = new Set((servable ?? []).map((s) => s.exercise_id as string));
  let done = 0, failed = 0;
  for (;;) {
    const { data: rowsRaw, error } = await svc
      .from('exercise_raw')
      .select('id, statement')
      .is('embedding', null)
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = (rowsRaw ?? []).sort(
      (a, b) => Number(servableSet.has(b.id as string)) - Number(servableSet.has(a.id as string))
    );
    if (!rows || rows.length === 0) break;
    for (const r of rows) {
      // pacing + retry cu backoff — API-ul de embeddings are rate limit
      let ok = false;
      for (let attempt = 0; attempt < 4 && !ok; attempt++) {
        try {
          if (attempt > 0) await new Promise((res) => setTimeout(res, 2000 * 2 ** attempt));
          const emb = await generateEmbedding((r.statement as string).slice(0, 4000));
          const { error: upErr } = await svc
            .from('exercise_raw')
            .update({ embedding: emb })
            .eq('id', r.id);
          if (upErr) throw new Error(upErr.message);
          ok = true;
          done++;
        } catch (err) {
          if (attempt === 3) {
            failed++;
            console.error(`  ✗ ${r.id}: ${err instanceof Error ? err.message.slice(0, 100) : err}`);
            if (failed > 30) throw new Error('prea multe eșecuri — opresc');
          }
        }
      }
      await new Promise((res) => setTimeout(res, 150));
    }
    console.log(`  …${done} embeddings persistate`);
  }
  const { count } = await svc
    .from('exercise_raw')
    .select('id', { count: 'exact', head: true })
    .not('embedding', 'is', null);
  console.log(`\n✅ FAZA E: ${count} exerciții cu embedding persistat (${done} noi, ${failed} eșuate).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
