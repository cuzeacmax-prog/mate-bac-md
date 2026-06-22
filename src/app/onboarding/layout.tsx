'use client';

import 'katex/dist/katex.min.css'; // ETAPA 66 E2: diagnostic + first-lesson randează math
import { usePathname } from 'next/navigation';
import { LivingBackdrop } from '@/components/motion/LivingBackdrop';
import { MotionProvider } from '@/components/motion/MotionProvider';

// ETAPA 82: ordinea reflectă fluxul nou — clasă → obiectiv → notă-țintă → cont.
// Rutele din afara funnelului (ex. /onboarding/confirma, gate-ul de o-singură-dată)
// nu apar aici și ascund bara de progres.
const STEPS = [
  '/onboarding/welcome',
  '/onboarding/grade',
  '/onboarding/obiectiv',
  '/onboarding/goal',
  '/onboarding/auth',
  '/onboarding/diagnostic-intro',
  '/onboarding/diagnostic',
  '/onboarding/reveal',
  '/onboarding/plan',
  '/onboarding/first-lesson',
  '/onboarding/trial',
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const stepIndex = STEPS.findIndex((s) => pathname.startsWith(s));
  const progress = stepIndex >= 0 ? ((stepIndex + 1) / STEPS.length) * 100 : 0;
  const showProgress = stepIndex >= 0;

  return (
    // FĂRĂ bg-background aici (body îl are deja): un fundal opac pe rădăcină
    // acoperea LivingBackdrop (-z-10 pictează SUB fundalul părintelui) —
    // defect dovedit de bucla vizuală ETAPA 74 runda 1
    <MotionProvider>
    <div className="relative min-h-screen flex flex-col">
      <LivingBackdrop />
      {/* Progress bar (doar pe pașii funnelului) */}
      {showProgress && (
        <div className="fixed top-0 inset-x-0 z-50 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <main className="flex-1 flex flex-col pt-1">
        {children}
      </main>
    </div>
    </MotionProvider>
  );
}
