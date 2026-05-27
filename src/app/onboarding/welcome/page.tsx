'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BookOpen, Target, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { track, Events } from '@/lib/analytics/posthog-client';

const HIGHLIGHTS = [
  { icon: Target, text: 'Predicție notă BAC personalizată' },
  { icon: TrendingUp, text: 'Plan de studiu adaptat nivelului tău' },
  { icon: Clock, text: '8-15 minute pe zi pentru progres real' },
];

export default function WelcomePage() {
  const router = useRouter();

  function handleStart() {
    track(Events.ONBOARDING_STARTED);
    router.push('/onboarding/goal');
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full">
      <motion.div
        className="text-center space-y-8 w-full"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo + headline */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-primary/10 p-5">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Bine ai venit la<br />
            <span className="text-primary">Profesor Maxim</span>
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Tutorul AI specializat 100% pe BAC Matematică Moldova.
            În 3 minute îți facem o predicție personalizată a notei tale.
          </p>
        </div>

        {/* Highlights */}
        <div className="space-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3"
            >
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3 pt-2">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold"
            onClick={handleStart}
          >
            Începe gratuit →
          </Button>
          <p className="text-xs text-muted-foreground">
            Gratuit — fără card, fără obligații
          </p>
        </div>
      </motion.div>
    </div>
  );
}
