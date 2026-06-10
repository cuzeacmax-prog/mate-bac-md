/**
 * mistake.ts — ETAPA 70 FAZA C: MAȘINA DE STĂRI LA GREȘEALĂ (logica pe server).
 *
 * Stare explicită, nu improvizația modelului:
 *   greșeala 1 → indiciu țintit (din contractul quiz-ului) + reîncearcă;
 *   greșeala 2 → micro-recapitulare (ultimul bloc step/formula dinaintea
 *     quiz-ului, NU toată teoria) + rezolvarea pas-cu-pas + exercițiu SIMILAR
 *     din pool-ul servibil (același concept) pentru RĂSCUMPĂRARE;
 *   mastery URCĂ doar: corect din prima (plin), corect după indiciu
 *     (ÎNJUMĂTĂȚIT — FAZA D), sau reușita pe similar (plin).
 *   EMA SCADE la fiecare greșeală (mecanismul ETAPA 60/63 existent).
 *   Fără exercițiu similar → marcat onest (similar:null), lecția continuă.
 *
 * Logica e aici (nu în rută) ca să fie verificabilă scriptat (acceptanța 70C).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getConceptAnchor } from '@/lib/concepts/anchor';
import { recordConceptEvidence, HELPED_WEIGHT } from '@/lib/mastery/evidence';
import { evaluateAttempt } from '@/lib/evaluare/evaluate';
import { hashSeed, pickDeterministic } from '@/lib/daily/daily';
import type { LessonBlock, QuizBlock } from '@/lib/lesson/blocks';

export interface SimilarExercise {
  exercise_id: string;
  statement: string;
  has_figure: boolean;
}

export interface QuizAnswerResult {
  correct: boolean;
  attempt: number;
  /** direcția+ponderea pasului EMA — transparent pentru client și acceptanță */
  masteryMoved: 'up-full' | 'up-halved' | 'down';
  corecta?: string;
  indiciu?: string;
  microRecap?: LessonBlock | null;
  rezolvare?: string[] | null;
  similar?: SimilarExercise | null;
}

interface LessonDoc {
  lesson?: boolean;
  concept?: string;
  blocks?: LessonBlock[];
}

/** lecția persistată + verificarea proprietarului; null dacă nu e a userului */
export async function loadLesson(
  service: SupabaseClient,
  userId: string,
  messageId: string
): Promise<{ lesson: LessonDoc; conversationId: string } | null> {
  const { data: msg } = await service
    .from('messages')
    .select('content, conversation_id, conversations(user_id)')
    .eq('id', messageId)
    .maybeSingle();
  const owner = (msg?.conversations as unknown as { user_id: string } | null)?.user_id;
  if (!msg || owner !== userId) return null;
  try {
    const lesson = JSON.parse(msg.content as string) as LessonDoc;
    if (!lesson.lesson || !Array.isArray(lesson.blocks)) return null;
    return { lesson, conversationId: msg.conversation_id as string };
  } catch {
    return null;
  }
}

/** exercițiu similar servibil pe același concept, ales determinist */
export async function getSimilarExercise(
  service: SupabaseClient,
  conceptSlug: string,
  seedStr: string
): Promise<SimilarExercise | null> {
  const anchor = await getConceptAnchor(service, conceptSlug);
  if (!anchor || anchor.exercises.length === 0) return null;
  const picked = pickDeterministic(anchor.exercises, 1, hashSeed(seedStr))[0];
  return picked
    ? { exercise_id: picked.id, statement: picked.statement, has_figure: picked.has_figure }
    : null;
}

/** micro-recapitulare: ULTIMUL bloc step/formula dinaintea quiz-ului dat */
export function pickMicroRecap(blocks: LessonBlock[], quizIndex1Based: number): LessonBlock | null {
  let seen = 0;
  let lastTheory: LessonBlock | null = null;
  for (const b of blocks) {
    if (b.tip === 'step' || b.tip === 'formula') lastTheory = b;
    if (b.tip === 'quiz') {
      seen++;
      if (seen === quizIndex1Based) return lastTheory;
    }
  }
  return lastTheory;
}

/**
 * Procesează un răspuns A-D la quiz-ul lecției, cu mașina de stări.
 * attempt-ul e numărat pe SERVER din exercise_attempts (nu de client).
 */
export async function processQuizAnswer(
  service: SupabaseClient,
  userId: string,
  messageId: string,
  quizId: string,
  answer: 'a' | 'b' | 'c' | 'd'
): Promise<{ status: number; body: QuizAnswerResult | { error: string } }> {
  const loaded = await loadLesson(service, userId, messageId);
  if (!loaded) return { status: 404, body: { error: 'Lecția nu există sau nu îți aparține' } };
  const { lesson, conversationId } = loaded;

  const quizzes = (lesson.blocks ?? []).filter((b): b is QuizBlock => b.tip === 'quiz');
  const quizIndex = Number(quizId.replace(/^q/, ''));
  const quiz = quizzes[quizIndex - 1];
  if (!quiz) return { status: 404, body: { error: `Quiz inexistent: ${quizId}` } };

  // numărul încercării — adevărul e pe server
  const attemptKey = `quiz:${messageId}:${quizId}`;
  const { count: prior } = await service
    .from('exercise_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('exercise_id', attemptKey);
  const attempt = (prior ?? 0) + 1;

  const correct = quiz.corecta === answer;
  // reușita după indiciu = ajutor → pas EMA înjumătățit (FAZA D)
  const helped = correct && attempt > 1;
  const weight = helped ? HELPED_WEIGHT : 1;
  const masteryMoved: QuizAnswerResult['masteryMoved'] = correct ? (helped ? 'up-halved' : 'up-full') : 'down';

  if (lesson.concept) {
    try {
      await recordConceptEvidence(service, userId, [lesson.concept], correct, 'chat', weight);
    } catch (err) {
      console.error('[lesson/mistake] evidence failed:', err instanceof Error ? err.message : err);
    }
  }
  const { error: attErr } = await service.from('exercise_attempts').insert({
    user_id: userId,
    exercise_id: attemptKey,
    is_correct: correct,
    user_answer: answer,
    correct_answer: quiz.corecta,
    session_type: 'chat_ancorat',
    metadata: {
      conversation_id: conversationId,
      method: 'determinist',
      confidence: 1,
      lesson_quiz: true,
      attempt,
      helped,
    },
  });
  if (attErr) console.error('[lesson/mistake] attempt insert failed:', attErr.message);

  if (correct) {
    return { status: 200, body: { correct: true, attempt, masteryMoved, corecta: quiz.corecta } };
  }

  // ── greșeala 1: indiciu țintit, FĂRĂ corecta — elevul reîncearcă ───────────
  if (attempt === 1) {
    return {
      status: 200,
      body: {
        correct: false,
        attempt,
        masteryMoved,
        indiciu: quiz.indiciu ?? 'Recitește pasul dinainte — direcția e acolo.',
      },
    };
  }

  // ── greșeala 2+: micro-recap + rezolvarea + similar pentru răscumpărare ────
  const microRecap = pickMicroRecap(lesson.blocks ?? [], quizIndex);
  const similar = lesson.concept
    ? await getSimilarExercise(service, lesson.concept, `${messageId}:${quizId}`)
    : null;
  return {
    status: 200,
    body: {
      correct: false,
      attempt,
      masteryMoved,
      corecta: quiz.corecta,
      microRecap,
      rezolvare: quiz.rezolvare ?? [`Răspunsul corect este „${quiz.corecta}".`],
      similar, // null = marcat onest, lecția continuă
    },
  };
}

export interface RedemptionResult {
  correct: boolean | null;
  motiv: string;
  /** mastery urcă PLIN la reușita pe similar; scade la greșeală; none = fără verdict */
  masteryMoved: 'up-full' | 'down' | 'none';
}

/** răspunsul elevului pe exercițiul SIMILAR — evaluat prin nivelurile ETAPEI 63 */
export async function processRedemption(
  service: SupabaseClient,
  userId: string,
  messageId: string,
  quizId: string,
  exerciseId: string,
  answer: string
): Promise<{ status: number; body: RedemptionResult | { error: string } }> {
  const loaded = await loadLesson(service, userId, messageId);
  if (!loaded) return { status: 404, body: { error: 'Lecția nu există sau nu îți aparține' } };
  const { lesson, conversationId } = loaded;
  if (!lesson.concept) return { status: 400, body: { error: 'Lecția nu are concept' } };

  // anti-falsificare: exercițiul trebuie să fie EXACT similarul ales determinist
  const expected = await getSimilarExercise(service, lesson.concept, `${messageId}:${quizId}`);
  if (!expected || expected.exercise_id !== exerciseId) {
    return { status: 400, body: { error: 'Exercițiul nu corespunde răscumpărării' } };
  }

  const evaluation = await evaluateAttempt(service, {
    userId,
    conversationId: `${conversationId}:redeem:${quizId}`,
    message: answer,
    exercise: { id: expected.exercise_id, statement: expected.statement },
    sessionType: 'chat_ancorat',
    assumeAttempt: true,
  });
  if (!evaluation) {
    return { status: 200, body: { correct: null, motiv: 'evaluarea nu a produs un verdict', masteryMoved: 'none' } };
  }

  let masteryMoved: RedemptionResult['masteryMoved'] = 'none';
  if (evaluation.correct !== null) {
    try {
      // răscumpărarea reușită urcă mastery PLIN (similarul e rezolvat singur);
      // greșeala pe similar scade EMA (consistent cu restul sistemului)
      await recordConceptEvidence(service, userId, [lesson.concept], evaluation.correct, 'chat');
      masteryMoved = evaluation.correct ? 'up-full' : 'down';
    } catch (err) {
      console.error('[lesson/mistake] redemption evidence failed:', err instanceof Error ? err.message : err);
    }
  }
  return {
    status: 200,
    body: { correct: evaluation.correct, motiv: evaluation.motiv, masteryMoved },
  };
}
