// IMPORTANT: NU rula manual peste noapte. Doar utilizatorul prezent.
// Rulează cu: npm run batch:test (test 2 ex.) sau npm run batch:full (200 ex., ~$15-20 cost)
//
// BATCH_LIMIT=0 (default) = ZERO executare. Setează explicit pentru a rula.

import { createServiceClient } from '../../src/lib/supabase/service';
import { generateExerciseFromTriangle } from '../../src/lib/library/exerciseGenerator';
import { generateEmbedding } from '../../src/lib/embeddings/gemini';
import {
  generateTriangleVariations,
  generateCircleVariations,
  generateParallelogramVariations,
  generateTrapezoidVariations,
  generatePolygonVariations,
  generateCubeVariations,
  generatePrismVariations,
  generatePyramidVariations,
  generateCylinderVariations,
  generateConeVariations,
  generateSphereVariations,
} from './variation-matrices';
import { generateTriangleAdvanced } from '../../src/lib/geometry/triangleAdvanced';
import { generateCircleAdvanced } from '../../src/lib/geometry/circleAdvanced';
import { generateParallelogramAdvanced, generateTrapezoidAdvanced } from '../../src/lib/geometry/quadrilateral';
import { generateRegularPolygonAdvanced } from '../../src/lib/geometry/polygon';
import { generateCubeAdvanced, generateRectangularPrismAdvanced } from '../../src/lib/geometry/solid3d';
import { generateRegularPyramidAdvanced } from '../../src/lib/geometry/pyramid';
import { generateCylinderAdvanced, generateConeAdvanced, generateSphereAdvanced } from '../../src/lib/geometry/rotational';
import { compileTikz } from '../../src/lib/tikz/compile';

const LIMIT = process.env.BATCH_LIMIT ? parseInt(process.env.BATCH_LIMIT, 10) : 0;

if (LIMIT === 0) {
  console.log('\n⚠️  BATCH_LIMIT=0 (default) — nicio variație procesată.');
  console.log('   Setează BATCH_LIMIT=2 pentru test sau BATCH_LIMIT=200 pentru full run.');
  console.log('   Folosește: npm run batch:test sau npm run batch:full\n');
  process.exit(0);
}

// ─── Shape entry types ────────────────────────────────────────────────────────

type ShapeEntry = {
  shape: string;
  subtopic: string;
  params: unknown;
  generate: (p: unknown) => { tikz: string; computed: Record<string, unknown> };
};

function buildVariations(): ShapeEntry[] {
  const entries: ShapeEntry[] = [];

  for (const v of generateTriangleVariations()) {
    entries.push({
      shape: 'triangle',
      subtopic: 'triunghi',
      params: v,
      generate: (p) => {
        const r = generateTriangleAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generateCircleVariations()) {
    entries.push({
      shape: 'circle',
      subtopic: 'cerc',
      params: v,
      generate: (p) => {
        const r = generateCircleAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generateParallelogramVariations()) {
    entries.push({
      shape: 'parallelogram',
      subtopic: 'paralelogram',
      params: v,
      generate: (p) => {
        const r = generateParallelogramAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generateTrapezoidVariations()) {
    entries.push({
      shape: 'trapezoid',
      subtopic: 'trapez',
      params: v,
      generate: (p) => {
        const r = generateTrapezoidAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generatePolygonVariations()) {
    entries.push({
      shape: 'regular_polygon',
      subtopic: 'poligon_regulat',
      params: v,
      generate: (p) => {
        const r = generateRegularPolygonAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generateCubeVariations()) {
    entries.push({
      shape: 'cube',
      subtopic: 'cub',
      params: v,
      generate: (p) => {
        const r = generateCubeAdvanced(p as Parameters<typeof generateCubeAdvanced>[0]);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generatePrismVariations()) {
    entries.push({
      shape: 'prism',
      subtopic: 'paralelipiped',
      params: v,
      generate: (p) => {
        const r = generateRectangularPrismAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generatePyramidVariations()) {
    entries.push({
      shape: 'pyramid',
      subtopic: 'piramida',
      params: v,
      generate: (p) => {
        const r = generateRegularPyramidAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generateCylinderVariations()) {
    entries.push({
      shape: 'cylinder',
      subtopic: 'cilindru',
      params: v,
      generate: (p) => {
        const r = generateCylinderAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generateConeVariations()) {
    entries.push({
      shape: 'cone',
      subtopic: 'con',
      params: v,
      generate: (p) => {
        const r = generateConeAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  for (const v of generateSphereVariations()) {
    entries.push({
      shape: 'sphere',
      subtopic: 'sfera',
      params: v,
      generate: (p) => {
        const r = generateSphereAdvanced(p as typeof v);
        return { tikz: r.tikz, computed: r.computed as Record<string, unknown> };
      },
    });
  }

  return entries;
}

async function main() {
  const allVariations = buildVariations();
  const variations = allVariations.slice(0, LIMIT);

  console.log(`\n🚀 Batch generator pornit. Limit: ${LIMIT} / ${allVariations.length} variații totale.\n`);
  console.log(`📋 Procesăm ${variations.length} variații.\n`);

  const supabase = createServiceClient();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < variations.length; i++) {
    const entry = variations[i];
    const start = Date.now();
    console.log(`[${i + 1}/${variations.length}] Procesare variație ${entry.shape}...`);

    try {
      // Step 1: Generate geometry
      console.log('  ⚙️  Calculator geometric...');
      const geo = entry.generate(entry.params);

      // Step 2: Compile TikZ → SVG
      console.log('  🎨 Compilare TikZ → SVG...');
      const compiled = await compileTikz(geo.tikz);

      // Step 3: Generate statement + solution via Sonnet
      console.log('  🤖 Generare enunț + soluție (Sonnet)...');
      const exercise = await generateExerciseFromTriangle({
        shape: entry.shape,
        params: entry.params,
        computed: geo.computed,
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
        subtopic: entry.subtopic,
        difficulty: exercise.difficulty,
        grade_level: exercise.grade_level,
        tags: exercise.tags,
        tikz_source: geo.tikz,
        svg_static: compiled.svg,
        embedding,
        needs_review: true,
        source: 'batch_generator_v2',
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
