'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberReveal } from '@/components/onboarding/NumberReveal';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { resolveGoal, predictionLabel } from '@/lib/profile/goal';
import { track, Events } from '@/lib/analytics/posthog-client';

const LOADING_MESSAGES = [
  'Analizăm răspunsurile tale...',
  'Comparăm cu 500+ elevi din Moldova...',
  'Calculăm predicția personalizată...',
];

export default function RevealPage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const prediction = store.initialBacPrediction ?? 5.8;
  const targetScore = store.targetBacScore ?? 9;
  const goal = resolveGoal(store.goal);

  const [phase, setPhase] = useState<'loading' | 'reveal' | 'done'>('loading');
  const [msgIdx, setMsgIdx] = useState(0);
  const [revealComplete, setRevealComplete] = useState(false);

  // Loading messages rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 900);
    const timer = setTimeout(() => {
      clearInterval(interval);
      setPhase('reveal');
      track(Events.BAC_PREDICTION_REVEALED, { prediction });
    }, 3000);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [prediction]);

  // Show CTA after number animation
  useEffect(() => {
    if (revealComplete) {
      setTimeout(() => setPhase('done'), 400);
    }
  }, [revealComplete]);

  const diff = targetScore - prediction;
  const improvement = diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full">
      <AnimatePresence mode="wait">
        {/* LOADING */}
        {phase === 'loading' && (
          <motion.div
            key="loading"
            className="text-center space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-5xl animate-bounce">🔬</div>
            <h2 className="text-xl font-bold">Se calculează predicția ta...</h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={msgIdx}
                className="text-muted-foreground text-sm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                {LOADING_MESSAGES[msgIdx]}
              </motion.p>
            </AnimatePresence>
            {/* Pulsing dots */}
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* REVEAL + DONE */}
        {(phase === 'reveal' || phase === 'done') && (
          <motion.div
            key="reveal"
            className="w-full text-center space-y-8"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Main score */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">
                {predictionLabel(goal)}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-8xl font-black text-primary tabular-nums">
                  {phase === 'reveal' ? (
                    <NumberReveal
                      from={2.0}
                      to={prediction}
                      duration={2.2}
                      onComplete={() => setRevealComplete(true)}
                    />
                  ) : (
                    prediction.toFixed(1)
                  )}
                </span>
              </div>
              <div className="flex justify-center">
                <span className="rounded-full bg-primary/10 text-primary text-sm font-medium px-3 py-1">
                  din 10
                </span>
              </div>
            </div>

            {/* Potential improvement */}
            <AnimatePresence>
              {phase === 'done' && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 space-y-1"
                >
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <ArrowUp className="h-5 w-5 font-bold" />
                    <span className="text-2xl font-black">{improvement}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Potențial de creștere cu{' '}
                    <span className="font-semibold text-foreground">Profesorul Max</span>{' '}
                    în 3 luni
                  </p>
                  <p className="font-bold text-lg">Obiectiv: {targetScore.toFixed(1)}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA */}
            <AnimatePresence>
              {phase === 'done' && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="space-y-3"
                >
                  <Button
                    size="lg"
                    className="w-full h-14 text-base font-semibold"
                    onClick={() => router.push('/onboarding/plan')}
                  >
                    Vezi planul tău personalizat →
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
