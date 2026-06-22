'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { track, Events } from '@/lib/analytics/posthog-client';
import { GOAL_OPTIONS, needsTarget, type Goal } from '@/lib/profile/goal';

/**
 * ETAPA 82 FAZA A2 — pasul de OBIECTIV (înainte de diagnostic).
 * "Nu toți dau BAC": întrebăm cald ce-și dorește elevul. Tot ce vede mai
 * departe (hartă, mesaje, traseu) se subordonează acestei alegeri.
 */
export default function ObiectivPage() {
  const router = useRouter();
  const setGoal = useOnboardingStore((s) => s.setGoal);

  function handleSelect(goal: Goal) {
    setGoal(goal);
    track(Events.ONBOARDING_OBJECTIVE_SELECTED, { goal });
    // Explorare nu are notă-țintă → sare peste pasul de țintă direct la cont.
    router.push(needsTarget(goal) ? '/onboarding/goal' : '/onboarding/auth');
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full">
      <motion.div
        className="w-full space-y-8"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-primary">Pasul 2 din 3</p>
          <h2 className="text-2xl font-bold">Ce-ți dorești?</h2>
          <p className="text-muted-foreground text-sm">
            Alege ce te aduce aici — îți potrivim totul după asta
          </p>
        </div>

        <div className="space-y-3">
          {GOAL_OPTIONS.map(({ goal, label, desc, emoji }) => (
            <motion.button
              key={goal}
              onClick={() => handleSelect(goal)}
              className="w-full rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:bg-primary/5 p-5 text-left transition-all duration-150 active:scale-[0.98] flex items-center gap-4"
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-3xl shrink-0" aria-hidden>{emoji}</span>
              <span className="min-w-0">
                <span className="block font-bold text-lg">{label}</span>
                <span className="block text-sm text-muted-foreground mt-0.5">{desc}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
