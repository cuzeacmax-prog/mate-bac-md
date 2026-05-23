import { createServiceClient } from '../../src/lib/supabase/service';
import { generateTriangleAdvanced } from '../../src/lib/geometry';
import { compileTikz } from '../../src/lib/tikz/compile';
import { generateExerciseFromTriangle } from '../../src/lib/library/exerciseGenerator';
import { generateEmbedding } from '../../src/lib/embeddings/gemini';
import { generateTriangleVariations } from './triangle-variations';

const LIMIT = process.env.BATCH_LIMIT ? parseInt(process.env.BATCH_LIMIT, 10) : 2;

async function main() {
  console.log(`\n🚀 Batch generator pornit. Limit: ${LIMIT} variații.\n`);

  const supabase = createServiceClient();
  const variations = generateTriangleVariations().slice(0, LIMIT);

  console.log(`📋 Procesăm ${variations.length} variații.\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < variations.length; i++) {
    const variation = variations[i];
    const start = Date.now();
    console.log(`[${i + 1}/${variations.length}] Procesare variație...`);

    try {
      // Step 1: Generate geometry
      console.log('  ⚙️  Calculator geometric...');
      const geo = generateTriangleAdvanced(variation);

      // Step 2: Compile TikZ → SVG
      console.log('  🎨 Compilare TikZ → SVG...');
      const compiled = await compileTikz(geo.tikz);

      // Step 3: Generate statement + solution via Sonnet
      console.log('  🤖 Generare enunț + soluție (Sonnet)...');
      const exercise = await generateExerciseFromTriangle({
        shape: 'triangle',
        params: variation,
        computed: geo.computed as Record<string, unknown>,
      });

      // Step 4: Generate embedding via Gemini
      console.log('  🧠 Generare embedding (Gemini 3072d)...');
      const embeddingText = `${exercise.statement} ${exercise.tags.join(' ')}`;
      const embedding = await generateEmbedding(embeddingText);

      if (embedding.length !== 3072) {
        throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected 3072`);
      }

      // Step 5: Insert into DB
      console.log('  💾 Insert în DB...');
      const { error } = await supabase.from('solved_exercises').insert({
        statement: exercise.statement,
        solution: exercise.solution,
        topic: exercise.topic,
        subtopic: exercise.subtopic,
        difficulty: exercise.difficulty,
        grade_level: exercise.grade_level,
        tags: exercise.tags,
        tikz_source: geo.tikz,
        svg_static: compiled.svg,
        embedding,
        needs_review: true,
        source: 'batch_generator_v1',
      });

      if (error) throw new Error(`DB insert error: ${error.message}`);

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ✅ Success în ${elapsed}s\n`);
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed: ${msg}\n`);
      failed++;
    }
  }

  console.log('🏁 Batch complet:');
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
