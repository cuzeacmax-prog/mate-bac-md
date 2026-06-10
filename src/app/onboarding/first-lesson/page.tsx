'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MathText } from '@/components/MathText';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { track, Events } from '@/lib/analytics/posthog-client';

type Phase = 'intro' | 'practice' | 'feedback' | 'done';

// Lesson content keyed by primary weakness topic
const LESSONS: Record<string, {
  concept: string;
  example: string;
  question: string;
  options: { a: string; b: string; c: string; d: string };
  correct: 'a' | 'b' | 'c' | 'd';
  explanation: string;
}> = {
  integrale: {
    concept: 'O integrală definită ∫ₐᵇ f(x)dx reprezintă aria de sub graficul funcției f între punctele a și b. Formula cheie: dacă F este o primitivă a lui f, atunci ∫ₐᵇ f(x)dx = F(b) − F(a).',
    example: 'Calculăm ∫₀² 2x dx:\n1. Primitiva lui 2x este x²\n2. F(2) − F(0) = 4 − 0 = 4',
    question: 'Calculați ∫₀¹ 3x² dx = ?',
    options: { a: '3', b: '1', c: '2', d: '3/2' },
    correct: 'b',
    explanation: 'Primitiva lui 3x² este x³. Aplicăm: F(1) − F(0) = 1³ − 0³ = 1. ✓',
  },
  derivate: {
    concept: "Derivata f'(x) exprimă viteza de schimbare a funcției f în punctul x. Regula de bază: dacă f(x) = xⁿ, atunci f'(x) = n·xⁿ⁻¹.",
    example: "f(x) = x⁴\nf'(x) = 4x³ (reducem exponentul cu 1, coeficient = exponent)",
    question: "f(x) = x⁵. f'(x) = ?",
    options: { a: 'x⁴', b: '5x⁴', c: '5x⁵', d: '4x⁴' },
    correct: 'b',
    explanation: "f'(x) = 5·x⁴ (regula xⁿ → n·xⁿ⁻¹). ✓",
  },
  algebra_ecuatii: {
    concept: 'La ecuația de gradul 2 ax² + bx + c = 0, folosim discriminantul: Δ = b² − 4ac. Dacă Δ > 0: două soluții reale distincte, Δ = 0: o soluție, Δ < 0: nicio soluție reală.',
    example: 'x² − 5x + 6 = 0\nΔ = 25 − 24 = 1 > 0\nx₁ = (5+1)/2 = 3, x₂ = (5−1)/2 = 2',
    question: 'Discriminantul ecuației x² + 4x + 4 = 0 este:',
    options: { a: '32', b: '0', c: '8', d: '16' },
    correct: 'b',
    explanation: 'Δ = b² − 4ac = 16 − 16 = 0. O singură soluție: x = −2. ✓',
  },
  default: {
    concept: 'Derivata funcției f(x) = xⁿ este f\'(x) = n·xⁿ⁻¹. Aceasta este una din cele mai importante formule BAC.',
    example: 'f(x) = x³\nf\'(x) = 3x²\nLa x = 2: f\'(2) = 12',
    question: 'f(x) = x². Tangenta în x = 1 are panta:',
    options: { a: '1', b: '2', c: '4', d: '0' },
    correct: 'b',
    explanation: "f'(x) = 2x. La x = 1: f'(1) = 2. Panta tangentei = derivata în acel punct. ✓",
  },
};

export default function FirstLessonPage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [selected, setSelected] = useState<string | null>(null);

  const topicKey = store.weaknesses[0] ?? 'default';
  const lesson = LESSONS[topicKey] ?? LESSONS['default'];
  const isCorrect = selected === lesson.correct;

  function handleAnswer(letter: string) {
    if (selected) return;
    setSelected(letter);
    setPhase('feedback');
  }

  function handleFinish() {
    track(Events.FIRST_LESSON_COMPLETED, {
      topic: topicKey,
      correct: selected === lesson.correct,
    });
    router.push('/onboarding/trial');
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-8 max-w-lg mx-auto w-full gap-6">
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary uppercase tracking-wider">
            Profesorul Max · Prima lecție
          </p>
          <h2 className="text-xl font-bold">
            {topicKey === 'integrale' ? 'Integrale definite'
              : topicKey === 'derivate' ? 'Derivate'
              : topicKey === 'algebra_ecuatii' ? 'Ecuații de gradul 2'
              : 'Derivate — Formula de bază'}
          </h2>
        </div>

        <AnimatePresence mode="wait">
          {/* INTRO — concept + example */}
          {(phase === 'intro' || phase === 'practice') && (
            <motion.div
              key="intro"
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Concept */}
              <div className="glass-2 rounded-2xl p-5">
                <p className="text-xs font-semibold text-primary uppercase mb-2">Conceptul</p>
                <p className="text-sm leading-relaxed"><MathText text={lesson.concept} /></p>
              </div>

              {/* Example */}
              <div className="rounded-2xl bg-muted/50 p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Exemplu rezolvat</p>
                <pre className="text-sm leading-relaxed font-mono whitespace-pre-wrap text-foreground">
                  {lesson.example}
                </pre>
              </div>

              {phase === 'intro' && (
                <Button
                  size="lg"
                  className="w-full h-14"
                  onClick={() => setPhase('practice')}
                >
                  Hai să exersez →
                </Button>
              )}

              {/* Practice question */}
              {phase === 'practice' && (
                <motion.div
                  className="space-y-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
                    <p className="text-sm font-semibold text-primary mb-1">Exercițiu</p>
                    <p className="font-medium"><MathText text={lesson.question} /></p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(['a', 'b', 'c', 'd'] as const).map((letter) => (
                      <button
                        key={letter}
                        onClick={() => handleAnswer(letter)}
                        className="rounded-2xl border-2 border-border bg-card hover:border-primary/60 p-4 text-center font-semibold transition-all active:scale-95"
                      >
                        <span className="text-xs text-muted-foreground uppercase block mb-1">{letter}</span>
                        <span className="text-sm"><MathText text={lesson.options[letter]} /></span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* FEEDBACK */}
          {(phase === 'feedback' || phase === 'done') && (
            <motion.div
              key="feedback"
              className="space-y-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Result banner */}
              <div className={`rounded-2xl p-5 text-center border ${
                isCorrect ? 'bg-success-bg border-success/40' : 'bg-secondary border-border'
              }`}>
                <div className="text-4xl mb-2">{isCorrect ? '🎉' : '💡'}</div>
                <p className={`font-bold text-lg ${isCorrect ? 'text-success-foreground' : 'text-secondary-foreground'}`}>
                  {isCorrect ? 'Corect! Ai înțeles conceptul.' : 'Aproape! Hai să vedem unde.'}
                </p>
              </div>

              {/* Explanation */}
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Explicație</p>
                <p className="text-sm leading-relaxed"><MathText text={lesson.explanation} /></p>
              </div>

              {/* Streak */}
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-center gap-4">
                <div className="text-3xl">🔥</div>
                <div>
                  <p className="font-bold">Streak: 1 zi</p>
                  <p className="text-xs text-muted-foreground">Primele 7 zile = gratuit complet</p>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full h-14 font-semibold"
                onClick={handleFinish}
              >
                Continuă →
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
