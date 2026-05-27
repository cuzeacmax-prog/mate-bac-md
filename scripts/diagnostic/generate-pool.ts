/**
 * generate-pool.ts — Generează pool de exerciții diagnostice cu Claude Haiku
 *
 * Rulează:  npm run diagnostic:generate-pool
 *
 * Ce face:
 * 1. Pentru fiecare topic din clasele 10-12, generează 5 exerciții per dificultate (1–5)
 * 2. Le inserează în tabelul `diagnostic_exercises` din Supabase
 * 3. Verifică unicitatea (skip dacă exercițiul există deja)
 *
 * Requires: ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
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
const DELAY_MS = 800; // evită rate limiting

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
    console.log(`\n📚 Clasa ${gradeLevel} (${topics.length} topics)`);

    for (const topic of topics) {
      for (const difficulty of DIFFICULTIES) {
        console.log(`  ⚙️  ${topic} difficulty=${difficulty}...`);

        try {
          const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            messages: [
              {
                role: 'user',
                content: buildPrompt(topic, difficulty, gradeLevel),
              },
            ],
          });

          const text = message.content[0].type === 'text' ? message.content[0].text : '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.warn(`    ⚠️  No JSON found in response`);
            errors++;
            continue;
          }

          const parsed: ApiResponse = JSON.parse(jsonMatch[0]);
          const exercises = parsed.exercises ?? [];

          for (const ex of exercises) {
            total++;

            // Check for duplicate (same prompt text)
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

            const { error } = await supabase.from('diagnostic_exercises').insert({
              topic_id: topic,
              grade_level: gradeLevel,
              difficulty,
              prompt: ex.prompt,
              options: ex.options,
              correct_letter: ex.correct_letter,
              explanation: ex.explanation,
              source: 'haiku_generated',
            });

            if (error) {
              console.error(`    ❌ Insert error:`, error.message);
              errors++;
            } else {
              inserted++;
            }
          }

          // Rate limit delay
          await new Promise((r) => setTimeout(r, DELAY_MS));
        } catch (err) {
          console.error(`    ❌ Generation error:`, err instanceof Error ? err.message : err);
          errors++;
        }
      }
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Total generated:  ${total}`);
  console.log(`   Inserted:         ${inserted}`);
  console.log(`   Skipped (dup):    ${skipped}`);
  console.log(`   Errors:           ${errors}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
