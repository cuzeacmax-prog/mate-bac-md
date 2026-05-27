'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { track, Events } from '@/lib/analytics/posthog-client';

const GRADES = [
  { grade: 10 as const, label: 'Clasa a 10-a', topics: 'Ecuații, funcții, logaritmi, trigonometrie' },
  { grade: 11 as const, label: 'Clasa a 11-a', topics: 'Limite, derivate, șiruri, polinoame' },
  { grade: 12 as const, label: 'Clasa a 12-a', topics: 'Integrale, geometrie 3D, combinatorică' },
];

export default function GradePage() {
  const router = useRouter();
  const setGradeLevel = useOnboardingStore((s) => s.setGradeLevel);

  function handleSelect(grade: 10 | 11 | 12) {
    setGradeLevel(grade);
    track(Events.ONBOARDING_GRADE_SELECTED, { grade_level: grade });
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
          <p className="text-sm font-medium text-primary">Pasul 2 din 3</p>
          <h2 className="text-2xl font-bold">În ce clasă ești?</h2>
          <p className="text-muted-foreground text-sm">
            Testul se adaptează la programa ta
          </p>
        </div>

        <div className="space-y-3">
          {GRADES.map(({ grade, label, topics }) => (
            <motion.button
              key={grade}
              onClick={() => handleSelect(grade)}
              className="w-full rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:bg-primary/5 p-5 text-left transition-all duration-150 active:scale-[0.98]"
              whileTap={{ scale: 0.98 }}
            >
              <div className="font-bold text-lg">{label}</div>
              <div className="text-sm text-muted-foreground mt-1">{topics}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
