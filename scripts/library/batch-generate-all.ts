// IMPORTANT: NU rula manual peste noapte. Doar utilizatorul prezent.
// RuleazÄƒ cu: npm run batch:test (test 2 ex.) sau npm run batch:full (200 ex., ~$15-20 cost)
//
// BATCH_LIMIT=0 (default) = ZERO executare. SeteazÄƒ explicit pentru a rula.

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServiceClient } from '../../src/lib/supabase/service';
import { generateExerciseFromTriangle } from './exerciseGenerator';
import { generateEmbedding, EMBEDDING_DIMENSIONS } from '../../src/lib/embeddings/gemini';
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
  console.log('\nâš ï¸  BATCH_LIMIT=0 (default) â€” nicio variaÈ›ie procesatÄƒ.');
  console.log('   SeteazÄƒ BATCH_LIMIT=2 pentru test sau BATCH_LIMIT=200 pentru full run.');
  console.log('   FoloseÈ™te: npm run batch:test sau npm run batch:full\n');
  process.exit(0);
}

const PROGRESS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'batch-progress.json');
const MAX_RETRIES = 3;
const RATE_LIMIT_MS = 800;

// â”€â”€â”€ Progress persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ProgressFile {
  completed_hashes: string[];
  last_run: string;
  total_success: number;
  total_failed: number;
}

function loadProgress(): ProgressFile {
  const defaults: ProgressFile = { completed_hashes: [], last_run: '', total_success: 0, total_failed: 0 };
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) as Partial<ProgressFile>;
      return {
        completed_hashes: Array.isArray(raw.completed_hashes) ? raw.completed_hashes : [],
        last_run: typeof raw.last_run === 'string' ? raw.last_run : '',
        total_success: Number.isFinite(raw.total_success) ? raw.total_success! : 0,
        total_failed: Number.isFinite(raw.total_failed) ? raw.total_failed! : 0,
      };
    } catch { /* ignore */ }
  }
  return defaults;
}

function saveProgress(p: ProgressFile) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2), 'utf8');
}

function paramsHash(shape: string, params: unknown): string {
  return crypto.createHash('sha1').update(`${shape}:${JSON.stringify(params)}`).digest('hex').slice(0, 12);
}

// â”€â”€â”€ Retry with exponential backoff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: Error = new Error('unknown');
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`    â™»ï¸  Retry ${attempt}/${MAX_RETRIES} ${label} Ã®n ${delay}msâ€¦`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// â”€â”€â”€ Shape entry types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ShapeEntry = {
  shape: string;
  subtopic: string;
  params: unknown;
  hash: string;
  generate: (p: unknown) => { tikz: string; computed: Record<string, unknown> };
};

function buildVariations(): ShapeEntry[] {
  const entries: ShapeEntry[] = [];

  const add = (shape: string, subtopic: string, params: unknown, fn: (p: unknown) => { tikz: string; computed: Record<string, unknown> }) => {
    entries.push({ shape, subtopic, params, hash: paramsHash(shape, params), generate: fn });
  };

  for (const v of generateTriangleVariations()) {
    add('triangle', 'triunghi', v, (p) => { const r = generateTriangleAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateCircleVariations()) {
    add('circle', 'cerc', v, (p) => { const r = generateCircleAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateParallelogramVariations()) {
    add('parallelogram', 'paralelogram', v, (p) => { const r = generateParallelogramAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateTrapezoidVariations()) {
    add('trapezoid', 'trapez', v, (p) => { const r = generateTrapezoidAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generatePolygonVariations()) {
    add('regular_polygon', 'poligon_regulat', v, (p) => { const r = generateRegularPolygonAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateCubeVariations()) {
    add('cube', 'cub', v, (p) => { const r = generateCubeAdvanced(p as Parameters<typeof generateCubeAdvanced>[0]); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generatePrismVariations()) {
    add('prism', 'paralelipiped', v, (p) => { const r = generateRectangularPrismAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generatePyramidVariations()) {
    add('pyramid', 'piramida', v, (p) => { const r = generateRegularPyramidAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateCylinderVariations()) {
    add('cylinder', 'cilindru', v, (p) => { const r = generateCylinderAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateConeVariations()) {
    add('cone', 'con', v, (p) => { const r = generateConeAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateSphereVariations()) {
    add('sphere', 'sfera', v, (p) => { const r = generateSphereAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }

  return entries;
}

async function main() {
  const progress = loadProgress();
  const completedSet = new Set(progress.completed_hashes);

  const allVariations = buildVariations();
  const pending = allVariations.filter((v) => !completedSet.has(v.hash)).slice(0, LIMIT);

  const skipped = allVariations.length - allVariations.filter((v) => !completedSet.has(v.hash)).length;

  console.log(`\nðŸš€ Batch generator pornit. Limit: ${LIMIT} / ${allVariations.length} variaÈ›ii totale.`);
  if (skipped > 0) console.log(`â™»ï¸  Resume: ${skipped} variaÈ›ii deja procesate (din progress.json), omise.`);
  console.log(`ðŸ“‹ De procesat: ${pending.length} variaÈ›ii.\n`);

  const supabase = createServiceClient();
  let success = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i];
    const itemStart = Date.now();
    console.log(`[${i + 1}/${pending.length}] Procesare ${entry.shape} (hash: ${entry.hash})â€¦`);

    try {
      console.log('  âš™ï¸  Calculator geometricâ€¦');
      const geo = entry.generate(entry.params);

      console.log('  ðŸŽ¨ Compilare TikZ â†’ SVGâ€¦');
      const compiled = await withRetry(() => compileTikz(geo.tikz), 'compileTikz');

      console.log('  ðŸ¤– Generare enunÈ› + soluÈ›ie (Sonnet)â€¦');
      const exercise = await withRetry(() =>
        generateExerciseFromTriangle({ shape: entry.shape, params: entry.params, computed: geo.computed }),
        'generateExercise'
      );

      console.log(`  ðŸ§  Generare embedding (Gemini ${EMBEDDING_DIMENSIONS}d)â€¦`);
      const embeddingText = `${exercise.statement} ${exercise.tags.join(' ')}`;
      const embedding = await withRetry(() => generateEmbedding(embeddingText), 'generateEmbedding');

      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`);
      }

      console.log('  ðŸ’¾ Insert Ã®n DBâ€¦');
      const { error } = await withRetry(async () => {
        const res = await supabase.from('solved_exercises').insert({
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
        return res;
      }, 'db:insert');

      if (error) throw new Error(`DB insert error: ${error.message}`);

      progress.completed_hashes.push(entry.hash);
      progress.total_success++;
      saveProgress({ ...progress, last_run: new Date().toISOString() });

      const elapsed = ((Date.now() - itemStart) / 1000).toFixed(1);
      console.log(`  âœ… Success Ã®n ${elapsed}s\n`);
      success++;

      // Rate limiting
      if (i < pending.length - 1) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  âŒ Failed: ${msg}\n`);
      progress.total_failed++;
      saveProgress({ ...progress, last_run: new Date().toISOString() });
      failed++;
    }
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('ðŸ Batch complet:');
  console.log(`   âœ… Success: ${success}`);
  console.log(`   âŒ Failed: ${failed}`);
  console.log(`   â±ï¸  Timp total: ${totalSec}s`);
  console.log(`   ðŸ“Š Total cumulat: ${progress.total_success} succes, ${progress.total_failed} eÈ™uate\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
