'use client';

import { usePathname } from 'next/navigation';

const STEPS = [
  '/onboarding/welcome',
  '/onboarding/goal',
  '/onboarding/grade',
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Progress bar */}
      <div className="fixed top-0 inset-x-0 z-50 h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 flex flex-col pt-1">
        {children}
      </main>
    </div>
  );
}
