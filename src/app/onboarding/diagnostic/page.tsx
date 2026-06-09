'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MathText } from '@/components/MathText';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { shouldStop } from '@/lib/diagnostic/adaptive';
import { track, Events } from '@/lib/analytics/posthog-client';

type AnswerState = 'idle' | 'correct' | 'wrong';

interface Exercise {
  id: string;
  topic_id: string;
  difficulty: number;
  prompt: string;
  options: Record<string, string>;
}

const LETTERS = ['a', 'b', 'c', 'd'] as const;
const MAX_Q = 8;

export default function DiagnosticPage() {
  const router = useRouter();
  const store = useOnboardingStore();

  const [sessionId, setSessionId] = useState<string | null>(store.diagnosticSessionId);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [correctLetter, setCorrectLetter] = useState<string | null>(null);
  // Pornirea cronometrării întrebării se setează la încărcarea exercițiului (nu la render).
  const [questionStart, setQuestionStart] = useState<number>(0);
  const [finishing, setFinishing] = useState(false);

  const history = store.diagnosticHistory;
  const gradeLevel = store.gradeLevel ?? 12;

  const handleFinish = useCallback((prediction: number | null, weaknesses: string[] | null) => {
    setFinishing(true);
    if (prediction) store.setInitialBacPrediction(prediction);
    if (weaknesses?.length) store.setWeaknesses(weaknesses);
    track(Events.DIAGNOSTIC_COMPLETED, {
      questions: history.length + 1,
      prediction,
    });
    setTimeout(() => router.push('/onboarding/reveal'), 600);
  }, [history.length, router, store]);

  const fetchNextExercise = useCallback(async (sid: string) => {
    setLoading(true);
    setAnswerState('idle');
    setCorrectLetter(null);

    // ETAPA 59: serverul citește istoricul și clasa din diagnostic_sessions;
    // clientul trimite doar sessionId.
    const res = await fetch('/api/diagnostic/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    });
    const data = await res.json();

    if (data.finished || !data.exercise) {
      handleFinish(null, null);
      return;
    }

    setExercise(data.exercise);
    setQuestionStart(Date.now());
    setLoading(false);
  }, [handleFinish]);

  // ── Init session ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      if (sessionId) {
        await fetchNextExercise(sessionId);
        return;
      }
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/onboarding/auth');
        return;
      }
      const res = await fetch('/api/diagnostic/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeLevel,
          targetBacScore: store.targetBacScore,
        }),
      });
      const data = await res.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
        store.setDiagnosticSessionId(data.sessionId);
        store.startDiagnosticTimer();
        await fetchNextExercise(data.sessionId);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = useCallback(async (letter: string) => {
    if (answerState !== 'idle' || !exercise || !sessionId) return;

    const timeSpent = Math.round((Date.now() - questionStart) / 1000);

    const res = await fetch('/api/diagnostic/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        exerciseId: exercise.id,
        selectedLetter: letter,
        timeSpentSeconds: timeSpent,
      }),
    });
    const data = await res.json();

    setCorrectLetter(data.correctLetter);
    setAnswerState(data.isCorrect ? 'correct' : 'wrong');

    store.addDiagnosticAttempt({
      exercise_id: exercise.id,
      difficulty: exercise.difficulty,
      topic_id: exercise.topic_id,
      is_correct: data.isCorrect,
      time_spent_seconds: timeSpent,
      selected_letter: letter,
      correct_letter: data.correctLetter,
    });

    if (data.isFinished) {
      handleFinish(data.initialBacPrediction, data.weaknesses);
      return;
    }

    // Auto-advance after 900ms
    setTimeout(() => {
      fetchNextExercise(sessionId);
    }, 900);
  }, [answerState, exercise, sessionId, questionStart, store, fetchNextExercise, handleFinish]);

  const progress = Math.min(history.length / MAX_Q, 1);

  if (finishing) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Se calculează predicția...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-8 max-w-lg mx-auto w-full gap-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Întrebarea {history.length + 1}</span>
          <span>~{MAX_Q - history.length} rămase</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col justify-center gap-6">
        {loading ? (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : exercise ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={exercise.id}
              className="space-y-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              {/* Prompt */}
              <div className="rounded-2xl bg-muted/50 p-5">
                <p className="text-base font-medium leading-relaxed"><MathText text={exercise.prompt} /></p>
                {exercise.difficulty >= 4 && (
                  <span className="mt-2 inline-block rounded-full bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5">
                    Dificil
                  </span>
                )}
              </div>

              {/* Answer buttons */}
              <div className="grid grid-cols-1 gap-3">
                {LETTERS.map((letter) => {
                  const optionText = exercise.options[letter];
                  if (!optionText) return null;

                  let variant: string = 'border-border bg-card hover:border-primary/60 hover:bg-primary/5';
                  if (answerState !== 'idle') {
                    if (letter === correctLetter) {
                      variant = 'border-green-400 bg-green-50 text-green-800';
                    } else if (letter !== correctLetter && answerState === 'wrong') {
                      variant = 'border-red-300 bg-red-50 text-red-700 opacity-70';
                    }
                  }

                  return (
                    <motion.button
                      key={letter}
                      onClick={() => handleAnswer(letter)}
                      disabled={answerState !== 'idle'}
                      className={`w-full rounded-2xl border-2 p-4 text-left flex items-center gap-3 transition-all duration-150 ${variant} disabled:cursor-default`}
                      whileTap={answerState === 'idle' ? { scale: 0.98 } : {}}
                    >
                      <span className="rounded-full bg-muted/80 px-2.5 py-1 text-sm font-bold shrink-0 uppercase">
                        {letter}
                      </span>
                      <span className="text-sm font-medium"><MathText text={optionText} /></span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {answerState !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`rounded-xl px-4 py-3 text-center font-medium text-sm ${
                      answerState === 'correct'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {answerState === 'correct'
                      ? '✓ Corect! Se trece la următoarea...'
                      : `Răspuns corect: ${correctLetter?.toUpperCase()}. Se trece mai departe...`}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>
    </div>
  );
}
