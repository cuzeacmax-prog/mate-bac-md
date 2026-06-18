import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  shouldStop,
  calculateInitialBACPrediction,
  identifyWeaknesses,
} from '@/lib/diagnostic/adaptive';
import type { DiagnosticAttempt } from '@/lib/diagnostic/adaptive';
import { getConceptSlugsForTopic } from '@/lib/diagnostic/topic-concept-map';
import { recordConceptEvidence } from '@/lib/mastery/evidence';
import { compareAnswers } from '@/lib/evaluare/compare';

// Correct letters for fallback exercises (keyed by id)
const FALLBACK_ANSWERS: Record<string, { correct_letter: string; difficulty: number; topic_id: string }> = {
  'f10-1': { correct_letter: 'b', difficulty: 2, topic_id: 'algebra_ecuatii' },
  'f10-2': { correct_letter: 'c', difficulty: 3, topic_id: 'logaritmi' },
  'f10-3': { correct_letter: 'b', difficulty: 2, topic_id: 'functii' },
  'f10-4': { correct_letter: 'c', difficulty: 3, topic_id: 'trigonometrie_baza' },
  'f10-5': { correct_letter: 'c', difficulty: 2, topic_id: 'algebra_inecuatii' },
  'f10-6': { correct_letter: 'd', difficulty: 4, topic_id: 'exponentiale' },
  'f10-7': { correct_letter: 'b', difficulty: 3, topic_id: 'siruri' },
  'f10-8': { correct_letter: 'b', difficulty: 4, topic_id: 'algebra_ecuatii' },
  'f11-1': { correct_letter: 'c', difficulty: 3, topic_id: 'derivate' },
  'f11-2': { correct_letter: 'b', difficulty: 3, topic_id: 'limite' },
  'f11-3': { correct_letter: 'a', difficulty: 2, topic_id: 'derivate' },
  'f11-4': { correct_letter: 'd', difficulty: 4, topic_id: 'limite' },
  'f11-5': { correct_letter: 'c', difficulty: 3, topic_id: 'derivate_aplicatii' },
  'f11-6': { correct_letter: 'd', difficulty: 4, topic_id: 'ecuatii_log_exp' },
  'f11-7': { correct_letter: 'd', difficulty: 3, topic_id: 'polinoame' },
  'f11-8': { correct_letter: 'a', difficulty: 4, topic_id: 'siruri_avansate' },
  'f12-1': { correct_letter: 'b', difficulty: 3, topic_id: 'integrale' },
  'f12-2': { correct_letter: 'c', difficulty: 2, topic_id: 'primitive' },
  'f12-3': { correct_letter: 'a', difficulty: 4, topic_id: 'arii_volume' },
  'f12-4': { correct_letter: 'c', difficulty: 3, topic_id: 'matrici_determinanti' },
  'f12-5': { correct_letter: 'd', difficulty: 3, topic_id: 'numere_complexe' },
  'f12-6': { correct_letter: 'b', difficulty: 3, topic_id: 'probabilitati' },
  'f12-7': { correct_letter: 'c', difficulty: 3, topic_id: 'combinatorica' },
  'f12-8': { correct_letter: 'c', difficulty: 4, topic_id: 'geometrie_3d' },
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId, exerciseId, selectedLetter, freeAnswer, timeSpentSeconds } = await req.json();

  // Get correct answer — try DB first, then fallback map
  const db = createServiceClient();
  let correctLetter: string;
  let difficulty: number;
  let topicId: string;
  let itemKind = 'mcq';
  let correctAnswer = '';

  if (exerciseId.startsWith('f')) {
    // Fallback exercise (mereu mcq)
    const fb = FALLBACK_ANSWERS[exerciseId];
    if (!fb) return Response.json({ error: 'Unknown exercise' }, { status: 404 });
    correctLetter = fb.correct_letter;
    difficulty = fb.difficulty;
    topicId = fb.topic_id;
  } else {
    const { data: exercise, error } = await db
      .from('diagnostic_exercises')
      .select('correct_letter, difficulty, topic_id, item_kind, correct_answer')
      .eq('id', exerciseId)
      .single();
    if (error || !exercise) return Response.json({ error: 'Exercise not found' }, { status: 404 });
    correctLetter = exercise.correct_letter;
    difficulty = exercise.difficulty;
    topicId = exercise.topic_id;
    itemKind = exercise.item_kind ?? 'mcq';
    correctAnswer = exercise.correct_answer ?? '';
  }

  // ETAPA 79 FAZA C: itemii v2 (free) se notează DETERMINIST cu compareAnswers
  // (răspunsul oficial ↔ răspunsul liber al elevului). Necomparabil = incorect.
  let isCorrect: boolean;
  if (itemKind === 'free') {
    const v = compareAnswers(correctAnswer, typeof freeAnswer === 'string' ? freeAnswer : '');
    isCorrect = v.comparable && v.correct;
  } else {
    isCorrect = correctLetter === selectedLetter;
  }

  // Fetch session
  const { data: session } = await supabase
    .from('diagnostic_sessions')
    .select('exercises_log, total_questions, correct_count')
    .eq('id', sessionId)
    .single();

  const newAttempt: DiagnosticAttempt = {
    exercise_id: exerciseId,
    difficulty,
    topic_id: topicId,
    is_correct: isCorrect,
    time_spent_seconds: timeSpentSeconds ?? 30,
    selected_letter: itemKind === 'free' ? String(freeAnswer ?? '').slice(0, 40) : selectedLetter,
    correct_letter: itemKind === 'free' ? 'x' : correctLetter,
  };

  const currentLog: DiagnosticAttempt[] = (session?.exercises_log as DiagnosticAttempt[] | null) ?? [];
  const updatedLog = [...currentLog, newAttempt];
  const newTotal = (session?.total_questions ?? 0) + 1;
  const newCorrect = (session?.correct_count ?? 0) + (isCorrect ? 1 : 0);

  const isFinished = shouldStop(updatedLog);
  let initialBacPrediction: number | null = null;
  let weaknesses: string[] = [];

  if (isFinished) {
    initialBacPrediction = calculateInitialBACPrediction(updatedLog);
    weaknesses = identifyWeaknesses(updatedLog);
  }

  // Update session
  await supabase
    .from('diagnostic_sessions')
    .update({
      exercises_log: updatedLog as unknown as import('@/types/supabase').Json,
      total_questions: newTotal,
      correct_count: newCorrect,
      ...(isFinished && {
        completed_at: new Date().toISOString(),
        initial_bac_prediction: initialBacPrediction,
        weaknesses,
      }),
    })
    .eq('id', sessionId);

  // ETAPA 60 (PAS 2): evidență în concept_mastery pe conceptele mapate ale
  // topicului (EMA α=0.3, vezi lib/mastery/evidence.ts). Topice nemapate → no-op.
  const conceptSlugs = getConceptSlugsForTopic(topicId);
  if (conceptSlugs.length > 0) {
    const { written, skipped } = await recordConceptEvidence(db, user.id, conceptSlugs, isCorrect, 'diagnostic');
    if (skipped.length > 0) {
      console.error('[diagnostic/submit] slug-uri sărite (inexistente):', skipped.join(', '));
    }
    console.log(`[diagnostic/submit] concept_mastery: ${written} concepte actualizate (corect=${isCorrect})`);
  }

  // Log to exercise_attempts
  await supabase.from('exercise_attempts').insert({
    user_id: user.id,
    exercise_id: exerciseId.startsWith('f') ? null : exerciseId,
    topic_id: topicId,
    difficulty,
    is_correct: isCorrect,
    time_spent_seconds: timeSpentSeconds ?? 30,
    session_type: 'diagnostic',
  });

  return Response.json({
    isCorrect,
    correctLetter: itemKind === 'free' ? null : correctLetter,
    correctAnswer: itemKind === 'free' ? correctAnswer : null,
    isFinished,
    initialBacPrediction,
    weaknesses,
    questionsAnswered: newTotal,
  });
}
