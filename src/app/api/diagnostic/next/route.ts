import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { nextDifficulty } from '@/lib/diagnostic/adaptive';
import type { DiagnosticAttempt } from '@/lib/diagnostic/adaptive';

// ── Fallback exercises when DB pool is empty ─────────────────────────────────
const FALLBACK: Record<number, Array<{
  id: string; topic_id: string; difficulty: number;
  prompt: string; distractors: Record<string, string>; correct_letter: string;
}>> = {
  10: [
    { id: 'f10-1', topic_id: 'algebra_ecuatii', difficulty: 2,
      prompt: 'Rezolvați ecuația: x² − 5x + 6 = 0',
      distractors: { a: 'x = 1, x = 6', b: 'x = 2, x = 3', c: 'x = −2, x = −3', d: 'x = 0, x = 5' },
      correct_letter: 'b' },
    { id: 'f10-2', topic_id: 'logaritmi', difficulty: 3,
      prompt: 'log₂(8) = ?',
      distractors: { a: '2', b: '4', c: '3', d: '16' },
      correct_letter: 'c' },
    { id: 'f10-3', topic_id: 'functii', difficulty: 2,
      prompt: 'f(x) = 2x + 1. f(3) = ?',
      distractors: { a: '5', b: '7', c: '8', d: '6' },
      correct_letter: 'b' },
    { id: 'f10-4', topic_id: 'trigonometrie_baza', difficulty: 3,
      prompt: 'sin(30°) = ?',
      distractors: { a: '1', b: '√3/2', c: '1/2', d: '√2/2' },
      correct_letter: 'c' },
    { id: 'f10-5', topic_id: 'algebra_inecuatii', difficulty: 2,
      prompt: '2x − 4 > 0 ⟹ x ∈ ?',
      distractors: { a: '(−∞, 2)', b: '[2, +∞)', c: '(2, +∞)', d: '(−∞, −2)' },
      correct_letter: 'c' },
    { id: 'f10-6', topic_id: 'exponentiale', difficulty: 4,
      prompt: '2ˣ = 16 ⟹ x = ?',
      distractors: { a: '2', b: '8', c: '3', d: '4' },
      correct_letter: 'd' },
    { id: 'f10-7', topic_id: 'siruri', difficulty: 3,
      prompt: 'Șir geometric: a₁=2, q=3. a₄ = ?',
      distractors: { a: '18', b: '54', c: '24', d: '36' },
      correct_letter: 'b' },
    { id: 'f10-8', topic_id: 'algebra_ecuatii', difficulty: 4,
      prompt: 'Discriminantul ecuației x² + 2x + 5 = 0 este:',
      distractors: { a: '24', b: '−16', c: '16', d: '−24' },
      correct_letter: 'b' },
  ],
  11: [
    { id: 'f11-1', topic_id: 'derivate', difficulty: 3,
      prompt: "Derivata f(x) = x³ este:",
      distractors: { a: '3x', b: 'x²', c: '3x²', d: '3x³' },
      correct_letter: 'c' },
    { id: 'f11-2', topic_id: 'limite', difficulty: 3,
      prompt: 'lim(x→0) sin(x)/x = ?',
      distractors: { a: '0', b: '1', c: '∞', d: '−1' },
      correct_letter: 'b' },
    { id: 'f11-3', topic_id: 'derivate', difficulty: 2,
      prompt: "Derivata f(x) = ln(x) este:",
      distractors: { a: '1/x', b: 'x', c: 'e^x', d: '−1/x²' },
      correct_letter: 'a' },
    { id: 'f11-4', topic_id: 'limite', difficulty: 4,
      prompt: 'lim(x→∞) (x² + 1)/(2x²) = ?',
      distractors: { a: '0', b: '2', c: '1', d: '1/2' },
      correct_letter: 'd' },
    { id: 'f11-5', topic_id: 'derivate_aplicatii', difficulty: 3,
      prompt: "f(x) = x² − 4x + 3. Punctul de minim este x = ?",
      distractors: { a: '1', b: '3', c: '2', d: '−2' },
      correct_letter: 'c' },
    { id: 'f11-6', topic_id: 'ecuatii_log_exp', difficulty: 4,
      prompt: 'eˣ = 1 ⟹ x = ?',
      distractors: { a: 'e', b: '−1', c: '1', d: '0' },
      correct_letter: 'd' },
    { id: 'f11-7', topic_id: 'polinoame', difficulty: 3,
      prompt: "P(x) = x³ − 1. P(1) = ?",
      distractors: { a: '1', b: '−1', c: '2', d: '0' },
      correct_letter: 'd' },
    { id: 'f11-8', topic_id: 'siruri_avansate', difficulty: 4,
      prompt: 'Suma primilor n termeni ai șirului aritm. cu a₁=1, d=2 este:',
      distractors: { a: 'n²', b: 'n(n+1)/2', c: '2n', d: 'n²+n' },
      correct_letter: 'a' },
  ],
  12: [
    { id: 'f12-1', topic_id: 'integrale', difficulty: 3,
      prompt: '∫₀¹ x dx = ?',
      distractors: { a: '1', b: '1/2', c: '2', d: '0' },
      correct_letter: 'b' },
    { id: 'f12-2', topic_id: 'primitive', difficulty: 2,
      prompt: 'O primitivă a f(x) = 2x este:',
      distractors: { a: '2', b: 'x² + 1', c: 'x²', d: '2x²' },
      correct_letter: 'c' },
    { id: 'f12-3', topic_id: 'arii_volume', difficulty: 4,
      prompt: 'Aria domeniului cuprins între y = x și y = x² (0≤x≤1) este:',
      distractors: { a: '1/6', b: '1/3', c: '1/2', d: '1/4' },
      correct_letter: 'a' },
    { id: 'f12-4', topic_id: 'matrici_determinanti', difficulty: 3,
      prompt: 'det([[1,2],[3,4]]) = ?',
      distractors: { a: '10', b: '5', c: '−2', d: '2' },
      correct_letter: 'c' },
    { id: 'f12-5', topic_id: 'numere_complexe', difficulty: 3,
      prompt: 'i² = ?',
      distractors: { a: '1', b: 'i', c: '−i', d: '−1' },
      correct_letter: 'd' },
    { id: 'f12-6', topic_id: 'probabilitati', difficulty: 3,
      prompt: 'P(A∪B) = P(A)+P(B) când evenimentele sunt:',
      distractors: { a: 'dependente', b: 'incompatibile', c: 'complementare', d: 'egale' },
      correct_letter: 'b' },
    { id: 'f12-7', topic_id: 'combinatorica', difficulty: 3,
      prompt: 'C(5,2) = ?',
      distractors: { a: '20', b: '5', c: '10', d: '15' },
      correct_letter: 'c' },
    { id: 'f12-8', topic_id: 'geometrie_3d', difficulty: 4,
      prompt: 'Volumul unui cub cu latura a este:',
      distractors: { a: 'a²', b: '6a²', c: 'a³', d: '4a³' },
      correct_letter: 'c' },
  ],
};

export async function POST(req: Request) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId, history, gradeLevel } = await req.json() as {
    sessionId: string;
    history: DiagnosticAttempt[];
    gradeLevel: number;
  };

  const targetDifficulty = nextDifficulty(history);
  const usedIds = history.map((h) => h.exercise_id);

  // Try DB pool first
  const db = createServiceClient();
  const query = db
    .from('diagnostic_exercises')
    .select('id, topic_id, difficulty, prompt, distractors, correct_letter')
    .eq('grade_level', gradeLevel)
    .eq('difficulty', targetDifficulty);

  const { data: dbExercises } = await query;

  // Filter out used IDs
  const available = (dbExercises ?? []).filter((e) => !usedIds.includes(e.id));

  if (available.length > 0) {
    const exercise = available[Math.floor(Math.random() * available.length)];
    return Response.json({
      exercise: {
        id: exercise.id,
        topic_id: exercise.topic_id,
        difficulty: exercise.difficulty,
        prompt: exercise.prompt,
        options: exercise.distractors,
        // correct_letter NOT exposed to client
      },
    });
  }

  // Fallback to hardcoded exercises
  const grade = [10, 11, 12].includes(gradeLevel) ? gradeLevel as 10 | 11 | 12 : 12;
  const fallback = FALLBACK[grade].filter((e) => !usedIds.includes(e.id));

  if (fallback.length === 0) {
    return Response.json({ error: 'No exercises available', finished: true }, { status: 200 });
  }

  // Prefer exercises at target difficulty, fallback to any
  const atTarget = fallback.filter((e) => e.difficulty === targetDifficulty);
  const pool = atTarget.length > 0 ? atTarget : fallback;
  const exercise = pool[Math.floor(Math.random() * pool.length)];

  return Response.json({
    exercise: {
      id: exercise.id,
      topic_id: exercise.topic_id,
      difficulty: exercise.difficulty,
      prompt: exercise.prompt,
      options: exercise.distractors,
    },
  });
}
