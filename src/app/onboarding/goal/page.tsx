'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { track, Events } from '@/lib/analytics/posthog-client';

const GOALS = [
  { score: 7, label: '7', desc: 'Promovez lejer', emoji: '✅', color: 'border-green-200 bg-green-50 hover:border-green-400' },
  { score: 8, label: '8', desc: 'Notă bună', emoji: '📚', color: 'border-blue-200 bg-blue-50 hover:border-blue-400' },
  { score: 9, label: '9', desc: 'Notă foarte bună', emoji: '🎯', color: 'border-violet-200 bg-violet-50 hover:border-violet-400' },
  { score: 10, label: '10', desc: 'Performanță maximă', emoji: '🏆', color: 'border-amber-200 bg-amber-50 hover:border-amber-400' },
];

export default function GoalPage() {
  const router = useRouter();
  const setTargetScore = useOnboardingStore((s) => s.setTargetScore);

  function handleSelect(score: number) {
    setTargetScore(score);
    track(Events.ONBOARDING_GOAL_SELECTED, { target_score: score });
    router.push('/onboarding/grade');
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
          <p className="text-sm font-medium text-primary">Pasul 1 din 3</p>
          <h2 className="text-2xl font-bold">Care este obiectivul tău?</h2>
          <p className="text-muted-foreground text-sm">
            Ce notă vrei să iei la BAC Matematică?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {GOALS.map(({ score, label, desc, emoji, color }) => (
            <motion.button
              key={score}
              onClick={() => handleSelect(score)}
              className={`rounded-2xl border-2 p-6 text-center transition-all duration-150 active:scale-95 ${color}`}
              whileTap={{ scale: 0.96 }}
            >
              <div className="text-3xl mb-2">{emoji}</div>
              <div className="text-4xl font-bold text-foreground mb-1">{label}</div>
              <div className="text-xs text-muted-foreground font-medium">{desc}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
