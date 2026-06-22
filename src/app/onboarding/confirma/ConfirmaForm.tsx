'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { track, Events } from '@/lib/analytics/posthog-client';
import { GOAL_OPTIONS, DEFAULT_GOAL, type Goal } from '@/lib/profile/goal';

const GRADES = [9, 10, 11, 12] as const;

/**
 * ETAPA 82 A3 — confirmare cald-tappable a clasei + obiectivului, o singură dată.
 * Skip = default sigur (clasa din profil + goal=note_clasa, NU BAC).
 */
export function ConfirmaForm({ initialGrade }: { initialGrade: number | null }) {
  const router = useRouter();
  const [grade, setGrade] = useState<number>(
    initialGrade && GRADES.includes(initialGrade as 9 | 10 | 11 | 12) ? initialGrade : 12,
  );
  const [goal, setGoal] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);

  async function persist(chosenGoal: Goal) {
    setBusy(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade_level: grade, goal: chosenGoal }),
      });
      track(Events.PROFILE_OBJECTIVE_CONFIRMED, { grade_level: grade, goal: chosenGoal });
    } catch {
      // non-blocking: chiar dacă pică, mergem mai departe (gate-ul rămâne dacă nu s-a salvat)
    }
    router.push('/app');
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full">
      <motion.div
        className="w-full space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-primary">Bun venit înapoi 👋</p>
          <h2 className="text-2xl font-bold">Hai să-ți potrivim aplicația</h2>
          <p className="text-muted-foreground text-sm">
            Confirmă clasa și ce-ți dorești — vei vedea doar ce contează pentru tine.
          </p>
        </div>

        {/* Clasa */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">Clasa ta</p>
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`rounded-2xl border-2 py-3 text-center font-bold transition-all duration-150 active:scale-95 ${
                  grade === g
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Obiectiv */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">Ce-ți dorești?</p>
          {GOAL_OPTIONS.map(({ goal: g, label, desc, emoji }) => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`w-full rounded-2xl border-2 p-4 text-left transition-all duration-150 active:scale-[0.98] flex items-center gap-4 ${
                goal === g
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              <span className="text-2xl shrink-0" aria-hidden>{emoji}</span>
              <span className="min-w-0">
                <span className="block font-bold">{label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{desc}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3 pt-1">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold"
            disabled={goal === null || busy}
            onClick={() => goal && persist(goal)}
          >
            {busy ? 'Se salvează...' : 'Confirmă →'}
          </Button>
          <button
            onClick={() => persist(DEFAULT_GOAL)}
            disabled={busy}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Sar peste — continui cu note mai bune la clasă
          </button>
        </div>
      </motion.div>
    </div>
  );
}
