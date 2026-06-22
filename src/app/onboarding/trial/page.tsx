'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { track, Events } from '@/lib/analytics/posthog-client';

const TRIAL_FEATURES = [
  'Exerciții nelimitate generate AI',
  'Chat cu Profesorul Max — nelimitat',
  'Foto exercițiu + OCR',
  'Simulare BAC completă',
  'Dashboard progres avansat',
];

export default function TrialPage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const [loading, setLoading] = useState(false);

  async function completeOnboarding(activatedTrial: boolean) {
    setLoading(true);
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ETAPA 59: predicția/slăbiciunile NU se mai trimit din client —
        // serverul le citește din diagnostic_sessions.
        body: JSON.stringify({
          gradeLevel: store.gradeLevel,
          targetBacScore: store.targetBacScore,
          goal: store.goal,
          activatedTrial,
        }),
      });
    } catch {
      // non-blocking — proceed regardless
    }

    track(activatedTrial ? Events.TRIAL_ACTIVATED : Events.TRIAL_SKIPPED, {
      grade_level: store.gradeLevel,
      target: store.targetBacScore,
      goal: store.goal,
      prediction: store.initialBacPrediction,
    });

    store.reset();
    router.push('/app');
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto w-full">
      <motion.div
        className="w-full space-y-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Badge */}
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">7 zile gratuit</span>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Activează Trial Premium</h2>
          <p className="text-muted-foreground text-sm">
            Primele 7 zile sunt complet gratuite — fără card necesar.
            Anulezi oricând.
          </p>
        </div>

        {/* Features */}
        <div className="rounded-2xl bg-muted/50 border border-border p-5 text-left space-y-3">
          {TRIAL_FEATURES.map((feat) => (
            <div key={feat} className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium">{feat}</span>
            </div>
          ))}
        </div>

        {/* Streak note */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <p className="text-sm text-amber-800 font-medium text-left">
            Ai început streak-ul azi! Continuă mâine să nu-l pierzi.
          </p>
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold"
          onClick={() => completeOnboarding(true)}
          disabled={loading}
        >
          {loading ? 'Se activează...' : '🚀 Activează Trial — 7 zile gratuit'}
        </Button>

        {/* Skip */}
        <button
          onClick={() => completeOnboarding(false)}
          disabled={loading}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          Continui cu varianta gratuită
        </button>

        <p className="text-xs text-muted-foreground">
          30 mesaje AI/lună · Fără card · Fără obligații
        </p>
      </motion.div>
    </div>
  );
}
