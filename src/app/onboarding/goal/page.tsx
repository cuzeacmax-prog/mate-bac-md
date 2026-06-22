'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { track, Events } from '@/lib/analytics/posthog-client';
import { resolveGoal, targetQuestion } from '@/lib/profile/goal';

// ETAPA 73: carduri glass cu accentul de domeniu pe hover (tokens, nu palete ad-hoc)
const GOALS = [
  { score: 7, label: '7', desc: 'Promovez lejer', emoji: '✅', hoverVar: '--domain-vi' },
  { score: 8, label: '8', desc: 'Notă bună', emoji: '📚', hoverVar: '--domain-ii' },
  { score: 9, label: '9', desc: 'Notă foarte bună', emoji: '🎯', hoverVar: '--domain-i' },
  { score: 10, label: '10', desc: 'Performanță maximă', emoji: '🏆', hoverVar: '--domain-iv' },
];

export default function GoalPage() {
  const router = useRouter();
  const setTargetScore = useOnboardingStore((s) => s.setTargetScore);
  // ETAPA 82: întrebarea se reformulează după obiectiv (BAC vs notă la clasă).
  const goal = useOnboardingStore((s) => resolveGoal(s.goal));
  const question = targetQuestion(goal) || 'Ce notă vrei să iei?';

  function handleSelect(score: number) {
    setTargetScore(score);
    track(Events.ONBOARDING_GOAL_SELECTED, { target_score: score, goal });
    router.push('/onboarding/auth');
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
          <p className="text-sm font-medium text-primary">Pasul 3 din 3</p>
          <h2 className="text-2xl font-bold">Care este nota ta țintă?</h2>
          <p className="text-muted-foreground text-sm">
            {question}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {GOALS.map(({ score, label, desc, emoji, hoverVar }) => (
            <motion.button
              key={score}
              onClick={() => handleSelect(score)}
              className="glass-2 rounded-3xl p-6 text-center transition-all duration-150 active:scale-95 hover:border-[var(--goal-hover)]"
              style={{ "--goal-hover": `var(${hoverVar})` } as React.CSSProperties}
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
