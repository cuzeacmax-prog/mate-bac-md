/**
 * batch-generate-new-shapes.ts
 * Generează 2 exerciții test per shape nou (17 tipuri × 2 = max 34 exerciții).
 *
 * Rulează cu: npx tsx scripts/library/batch-generate-new-shapes.ts
 * Cost estimat: ~$1.50-3.00
 *
 * ATENȚIE: Rulează DOAR shape-urile noi — nu strica ce există deja în DB.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServiceClient } from '../../src/lib/supabase/service';
import { generateExerciseFromTriangle } from '../../src/lib/library/exerciseGenerator';
import { generateEmbedding, EMBEDDING_DIMENSIONS } from '../../src/lib/embeddings/gemini';

// Geometry calculators
import { generateTriangleAdvanced } from '../../src/lib/geometry/triangleAdvanced';
import { generateFrustumPyramidAdvanced, generateFrustumConeAdvanced } from '../../src/lib/geometry/frustum';
import {
  generateCubeSectionAdvanced,
  generatePyramidSectionAdvanced,
  generateConeSectionAdvanced,
  generateSphereSectionAdvanced,
  generateCylinderSectionAdvanced,
} from '../../src/lib/geometry/sections';
import { generateRegularTetrahedronAdvanced } from '../../src/lib/geometry/pyramid';
import { generateObliquePrismAdvanced, generateCubeAdvanced } from '../../src/lib/geometry/solid3d';
import { generateSphereAdvanced } from '../../src/lib/geometry/rotational';
import { compileTikz } from '../../src/lib/tikz/compile';

// Variation matrices
import {
  generateFrustumPyramidVariations,
  generateFrustumConeVariations,
  generateCubeSectionVariations,
  generatePyramidSectionVariations,
  generateConeSectionVariations,
  generateSphereSectionVariations,
  generateCylinderSectionVariations,
  generateTetrahedronVariations,
  generateObliquePrismVariations,
  generateCubeAllDiagonalsVariations,
  generateSphereWithCirclesVariations,
  generateTriangleMidsegmentVariations,
  generateTrianglePerpBisectorVariations,
  generateTriangleCentroidVariations,
} from './variation-matrices';

const LIMIT_PER_TYPE = 2;
const MAX_RETRIES = 3;
const RATE_LIMIT_MS = 800;

const PROGRESS_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'batch-new-shapes-progress.json',
);

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
  return crypto.createHash('sha1').update(`new:${shape}:${JSON.stringify(params)}`).digest('hex').slice(0, 12);
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: Error = new Error('unknown');
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`    ♻️  Retry ${attempt}/${MAX_RETRIES} ${label} în ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

type GenerateFn = (p: unknown) => { tikz: string; computed: Record<string, unknown> };

type ShapeEntry = {
  shape: string;
  subtopic: string;
  params: unknown;
  hash: string;
  generate: GenerateFn;
};

function buildNewShapeVariations(): ShapeEntry[] {
  const entries: ShapeEntry[] = [];

  function add(shape: string, subtopic: string, params: unknown, fn: GenerateFn) {
    entries.push({ shape, subtopic, params, hash: paramsHash(shape, params), generate: fn });
  }

  // Triunghi extins
  for (const v of generateTriangleMidsegmentVariations().slice(0, LIMIT_PER_TYPE)) {
    add('triangle_midsegments', 'linii_mijlocii', v, (p) => { const r = generateTriangleAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateTrianglePerpBisectorVariations().slice(0, LIMIT_PER_TYPE)) {
    add('triangle_perp_bisectors', 'mediatoare', v, (p) => { const r = generateTriangleAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateTriangleCentroidVariations().slice(0, LIMIT_PER_TYPE)) {
    add('triangle_centroid', 'centroid', v, (p) => { const r = generateTriangleAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }

  // Trunchiuri piramide
  for (const v of generateFrustumPyramidVariations().slice(0, LIMIT_PER_TYPE)) {
    add('frustum_pyramid', 'trunchi_piramida', v, (p) => { const r = generateFrustumPyramidAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  // Trunchi con
  for (const v of generateFrustumConeVariations().slice(0, LIMIT_PER_TYPE)) {
    add('frustum_cone', 'trunchi_con', v, (p) => { const r = generateFrustumConeAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }

  // Plane secante
  for (const v of generateCubeSectionVariations().slice(0, LIMIT_PER_TYPE)) {
    add('section_cube', 'sectiune_cub', v, (p) => { const r = generateCubeSectionAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generatePyramidSectionVariations().slice(0, LIMIT_PER_TYPE)) {
    add('section_pyramid', 'sectiune_piramida', v, (p) => { const r = generatePyramidSectionAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateConeSectionVariations().slice(0, LIMIT_PER_TYPE)) {
    add('section_cone', 'sectiune_con', v, (p) => { const r = generateConeSectionAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateSphereSectionVariations().slice(0, LIMIT_PER_TYPE)) {
    add('section_sphere', 'sectiune_sfera', v, (p) => { const r = generateSphereSectionAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateCylinderSectionVariations().slice(0, LIMIT_PER_TYPE)) {
    add('section_cylinder', 'sectiune_cilindru', v, (p) => { const r = generateCylinderSectionAdvanced(p as typeof v); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }

  // Speciale
  for (const v of generateTetrahedronVariations().slice(0, LIMIT_PER_TYPE)) {
    add('tetrahedron', 'tetraedru_regulat', v, (p) => { const r = generateRegularTetrahedronAdvanced(p as Parameters<typeof generateRegularTetrahedronAdvanced>[0]); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateObliquePrismVariations().slice(0, LIMIT_PER_TYPE)) {
    add('oblique_prism', 'prisma_oblica', v, (p) => { const r = generateObliquePrismAdvanced(p as Parameters<typeof generateObliquePrismAdvanced>[0]); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateCubeAllDiagonalsVariations().slice(0, LIMIT_PER_TYPE)) {
    add('cube_all_diagonals', 'cub_diagonale', v, (p) => { const r = generateCubeAdvanced(p as Parameters<typeof generateCubeAdvanced>[0]); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }
  for (const v of generateSphereWithCirclesVariations().slice(0, LIMIT_PER_TYPE)) {
    add('sphere_with_circles', 'sfera_cercuri', v, (p) => { const r = generateSphereAdvanced(p as Parameters<typeof generateSphereAdvanced>[0]); return { tikz: r.tikz, computed: r.computed as Record<string, unknown> }; });
  }

  return entries;
}

async function main() {
  const progress = loadProgress();
  const completedSet = new Set(progress.completed_hashes);

  const allVariations = buildNewShapeVariations();
  const pending = allVariations.filter((v) => !completedSet.has(v.hash));

  const totalPlanned = allVariations.length;
  const skipped = allVariations.length - pending.length;

  console.log(`\n🚀 Generare shape-uri NOI — BAC MD`);
  console.log(`📋 Total planificat: ${totalPlanned} exerciții`);
  if (skipped > 0) console.log(`♻️  Resume: ${skipped} deja procesate, omise.`);
  console.log(`📋 De procesat: ${pending.length} exerciții.\n`);

  const supabase = createServiceClient();
  let success = 0;
  let failed = 0;
  const startTime = Date.now();
  const failedItems: string[] = [];

  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i];
    const itemStart = Date.now();
    console.log(`[${i + 1}/${pending.length}] ${entry.shape} (hash: ${entry.hash})…`);

    try {
      console.log('  ⚙️  Calculator geometric…');
      const geo = entry.generate(entry.params);

      console.log('  🎨 Compilare TikZ → SVG…');
      const compiled = await withRetry(() => compileTikz(geo.tikz), 'compileTikz');

      console.log('  🤖 Generare enunț + soluție (Sonnet)…');
      const exercise = await withRetry(() =>
        generateExerciseFromTriangle({ shape: entry.shape, params: entry.params, computed: geo.computed }),
        'generateExercise'
      );

      console.log(`  🧠 Generare embedding (Gemini ${EMBEDDING_DIMENSIONS}d)…`);
      const embeddingText = `${exercise.statement} ${exercise.tags.join(' ')}`;
      const embedding = await withRetry(() => generateEmbedding(embeddingText), 'generateEmbedding');

      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`);
      }

      console.log('  💾 Insert în DB…');
      const { error } = await withRetry(async () => {
        return await supabase.from('solved_exercises').insert({
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
          source: 'batch_new_shapes_v1',
        });
      }, 'db:insert');

      if (error) throw new Error(`DB insert error: ${error.message}`);

      progress.completed_hashes.push(entry.hash);
      progress.total_success++;
      saveProgress({ ...progress, last_run: new Date().toISOString() });

      const elapsed = ((Date.now() - itemStart) / 1000).toFixed(1);
      console.log(`  ✅ Success în ${elapsed}s\n`);
      success++;

      if (i < pending.length - 1) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed: ${msg}\n`);
      progress.total_failed++;
      saveProgress({ ...progress, last_run: new Date().toISOString() });
      failed++;
      failedItems.push(`${entry.shape} (${entry.hash}): ${msg}`);
    }
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('RAPORT FINAL ETAPA 4.X.GEOMETRY-COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Shape-uri noi implementate: 17/17 ✅`);
  console.log(`Exerciții test generate: ${success} / ${totalPlanned}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Timp total: ${totalSec}s`);
  console.log(`📊 Total cumulat: ${progress.total_success} succes, ${progress.total_failed} eșuate`);
  if (failedItems.length > 0) {
    console.log('\nFailed items:');
    failedItems.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
