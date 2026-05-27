'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initPosthog, trackPageView } from '@/lib/analytics/posthog-client';

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initPosthog();
  }, []);

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);

  return <>{children}</>;
}
