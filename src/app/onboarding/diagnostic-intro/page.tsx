'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Zap, BarChart2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { track, Events } from '@/lib/analytics/posthog-client';

const FEATURES = [
  { icon: Zap, text: '5–8 întrebări rapide' },
  { icon: Clock, text: '~3 minute, fără cronometru' },
  { icon: BarChart2, text: 'Predicția ta exactă la final' },
];

export default function DiagnosticIntroPage() {
  const router = useRouter();
  const gradeLevel = useOnboardingStore((s) => s.gradeLevel);

  function handleStart() {
    track(Events.DIAGNOSTIC_STARTED, { grade_level: gradeLevel });
    router.push('/onboarding/diagnostic');
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full">
      <motion.div
        className="w-full space-y-8 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="space-y-4">
          <div className="text-5xl">🔍</div>
          <h2 className="text-2xl font-bold">Testul de diagnostic</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Câteva întrebări cu variante de răspuns, adaptate nivelului tău.
            La final vei vedea nota BAC estimată chiar acum.
          </p>
        </div>

        <div className="space-y-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-left"
            >
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold"
          onClick={handleStart}
        >
          Începe testul →
        </Button>
      </motion.div>
    </div>
  );
}
