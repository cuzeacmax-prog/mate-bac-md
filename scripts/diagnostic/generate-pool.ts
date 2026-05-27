/**
 * generate-pool.ts — Generează pool de exerciții diagnostice cu Claude Haiku
 *
 * Rulează:  npm run diagnostic:generate-pool
 *
 * Ce face:
 * 1. Pentru fiecare topic din clasele 10-12, generează 3 exerciții per dificultate (1–5)
 * 2. Le inserează în tabelul `diagnostic_exercises` din Supabase
 * 3. Verifică unicitatea (skip dacă exercițiul există deja)
 *
 * Requires: ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 *
 * Schema diagnostic_exercises:
 *   id, grade_level, topic_id, difficulty, prompt,
 *   correct_answer TEXT NOT NULL,
 *   distractors JSONB NOT NULL,    ← {"a":"...", "b":"...", "c":"...", "d":"..."}
 *   correct_letter CHAR(1),
 *   explanation TEXT,
 *   source_scenario_id UUID
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────────────
const TOPICS_BY_GRADE: Record<number, string[]> = {
  10: [
    'algebra_ecuatii',
    'algebra_inecuatii',
    'siruri',
    'functii',
    'trigonometrie_baza',
    'logaritmi',
    'exponentiale',
  ],
  11: [
    'limite',
    'derivate',
    'derivate_aplicatii',
    'polinoame',
    'ecuatii_log_exp',
    'inecuatii_log_exp',
    'siruri_avansate',
  ],
  12: [
    'primitive',
    'integrale',
    'arii_volume',
    'geometrie_3d',
    'numere_complexe',
    'matrici_determinanti',
    'combinatorica',
    'probabilitati',
  ],
};

const DIFFICULTIES = [1, 2, 3, 4, 5];
const EXERCISES_PER_COMBO = 3; // 3 exerciții per (topic × difficulty)
const DELAY_MS = 600;          // evită rate limiting Haiku

// ── Prompt template ──────────────────────────────────────────────────────────
function buildPrompt(topic: string, difficulty: number, gradeLevel: number): string {
  const diffLabel =
    difficulty === 1 ? 'foarte ușor (definire concept de bază)' :
    difficulty === 2 ? 'ușor (aplicare formulă directă)' :
    difficulty === 3 ? 'mediu (2-3 pași de calcul)' :
    difficulty === 4 ? 'dificil (combinare mai multor concepte)' :
    'foarte dificil (problemă complexă tip BAC)';

  return `Generează ${EXERCISES_PER_COMBO} exerciții de matematică pentru BAC MD (Republica Moldova), clasa ${gradeLevel}, capitolul "${topic}", dificultate ${difficulty}/5 (${diffLabel}).

REGULI STRICTE:
1. Fiecare exercițiu are EXACT 4 variante de răspuns (a, b, c, d)
2. EXACT un răspuns corect
3. Variantele incorecte sunt plauzibile (erori tipice ale elevilor)
4. Enunțul e clar, concis, fără ambiguitate
5. Notație BAC MD: Δ, S = {...}, DVA, u.p., u.c.
6. Formula matematică cu simboluri Unicode: x², √, ∫, etc. (NU LaTeX)

RĂSPUNDE EXCLUSIV JSON (fără text suplimentar):
{
  "exercises": [
    {
      "prompt": "Enunțul exercițiului",
      "options": { "a": "...", "b": "...", "c": "...", "d": "..." },
      "correct_letter": "a",
      "explanation": "De ce răspunsul corect e corect (1-2 propoziții)"
    }
  ]
}`;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface GeneratedExercise {
  prompt: string;
  options: Record<string, string>;
  correct_letter: string;
  explanation: string;
}

interface ApiResponse {
  exercises: GeneratedExercise[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the correct answer text from options using correct_letter */
function extractCorrectAnswer(options: Record<string, string>, correctLetter: string): string {
  return options[correctLetter] ?? options['a'] ?? 'N/A';
}

/** Validate AI response — returns null if invalid */
function validateExercise(ex: GeneratedExercise): string | null {
  if (!ex.prompt || typeof ex.prompt !== 'string') return 'missing prompt';
  if (!ex.correct_letter || !['a', 'b', 'c', 'd'].includes(ex.correct_letter)) return 'invalid correct_letter';
  if (!ex.options || typeof ex.options !== 'object') return 'missing options';
  if (!ex.options[ex.correct_letter]) return `correct_letter ${ex.correct_letter} not in options`;
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !serviceKey || !anthropicKey) {
    console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  let total = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const [gradeStr, topics] of Object.entries(TOPICS_BY_GRADE)) {
    const gradeLevel = parseInt(gradeStr, 10);
    console.log(`\n📚 Clasa ${gradeLevel} (${topics.length} topics × ${DIFFICULTIES.length} dif × ${EXERCISES_PER_COMBO} ex)`);

    for (const topic of topics) {
      for (const difficulty of DIFFICULTIES) {
        process.stdout.write(`  ⚙️  ${topic} d=${difficulty}... `);

        try {
          const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            messages: [{ role: 'user', content: buildPrompt(topic, difficulty, gradeLevel) }],
          });

          const text = message.content[0].type === 'text' ? message.content[0].text : '';

          // Extract JSON — handle markdown code blocks too
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
          if (!jsonMatch) {
            console.log('⚠️  no JSON');
            errors++;
            continue;
          }

          let parsed: ApiResponse;
          try {
            parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
          } catch {
            console.log('⚠️  JSON parse error');
            errors++;
            continue;
          }

          const exercises = parsed.exercises ?? [];
          let batchInserted = 0;

          for (const ex of exercises) {
            total++;

            // Validate
            const validationError = validateExercise(ex);
            if (validationError) {
              errors++;
              continue;
            }

            // Dedup check
            const { count } = await supabase
              .from('diagnostic_exercises')
              .select('*', { count: 'exact', head: true })
              .eq('topic_id', topic)
              .eq('difficulty', difficulty)
              .eq('prompt', ex.prompt);

            if ((count ?? 0) > 0) {
              skipped++;
              continue;
            }

            // INSERT with correct column names (schema-aligned)
            const { error } = await supabase.from('diagnostic_exercises').insert({
              topic_id: topic,
              grade_level: gradeLevel,
              difficulty,
              prompt: ex.prompt,
              correct_answer: extractCorrectAnswer(ex.options, ex.correct_letter), // NOT NULL in schema
              distractors: ex.options,       // JSONB column (NOT `options`)
              correct_letter: ex.correct_letter,
              explanation: ex.explanation ?? null,
              source_scenario_id: null,      // no source column; source_scenario_id is UUID ref
            });

            if (error) {
              console.error(`\n    ❌ Insert error: ${error.message}`);
              errors++;
            } else {
              inserted++;
              batchInserted++;
            }
          }

          console.log(`✅ +${batchInserted}`);

          // Rate limit delay
          await new Promise((r) => setTimeout(r, DELAY_MS));
        } catch (err) {
          console.log(`❌ ${err instanceof Error ? err.message.substring(0, 80) : err}`);
          errors++;
        }
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Done!`);
  console.log(`   Total attempted: ${total}`);
  console.log(`   Inserted:        ${inserted}`);
  console.log(`   Skipped (dup):   ${skipped}`);
  console.log(`   Errors:          ${errors}`);

  // ── DB verification ───────────────────────────────────────────────────────
  console.log('\n📊 Verificare în DB:');

  const { count: totalCount } = await supabase
    .from('diagnostic_exercises')
    .select('*', { count: 'exact', head: true });

  console.log(`   Total diagnostic_exercises: ${totalCount}`);

  for (const grade of [10, 11, 12]) {
    const { count: gCount } = await supabase
      .from('diagnostic_exercises')
      .select('*', { count: 'exact', head: true })
      .eq('grade_level', grade);
    console.log(`   Grade ${grade}: ${gCount}`);
  }

  if ((totalCount ?? 0) < 50) {
    console.log('\n⚠️  Pool mic — re-rulează scriptul sau verifică erorile mai sus');
  } else {
    console.log('\n✅ Pool suficient pentru diagnostic adaptiv');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
