/**
 * posthog-client.ts — ETAPA 76 FAZA E (cauza #1 dovedită de baseline):
 * posthog-js (188KB) intra SINCRON în bundle-ul comun al tuturor rutelor,
 * inclusiv landing → TBT mobil ~850ms. Acum: dynamic import LA IDLE
 * (requestIdleCallback), cu coadă pentru evenimentele emise înainte de
 * încărcare — nimic nu se pierde, nimic nu blochează hidratarea.
 */
import type { PostHog } from 'posthog-js';

let ph: PostHog | null = null;
let loading = false;
const queue: Array<(p: PostHog) => void> = [];

function withPosthog(fn: (p: PostHog) => void) {
  if (ph) fn(ph);
  else queue.push(fn);
}

async function load() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    console.warn('[Posthog] Missing NEXT_PUBLIC_POSTHOG_KEY');
    return;
  }
  const { default: posthog } = await import('posthog-js');
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage',
    autocapture: false,
    loaded: (p) => {
      if (process.env.NODE_ENV === 'development') {
        p.debug();
      }
    },
  });
  ph = posthog;
  for (const fn of queue.splice(0)) fn(posthog);
}

export function initPosthog() {
  if (typeof window === 'undefined' || loading) return;
  loading = true;
  // analytics nu are voie să concureze cu hidratarea — pornește la idle
  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback(() => void load(), { timeout: 4000 });
  } else {
    setTimeout(() => void load(), 2500);
  }
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  withPosthog((p) => p.identify(userId, properties));
}

export function track(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  withPosthog((p) => p.capture(eventName, properties));
}

export function trackPageView(pathname: string) {
  if (typeof window === 'undefined') return;
  withPosthog((p) => p.capture('$pageview', { $pathname: pathname }));
}

export function reset() {
  if (typeof window === 'undefined') return;
  withPosthog((p) => p.reset());
}

// Event names — type-safe
export const Events = {
  // Onboarding funnel
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_GOAL_SELECTED: 'onboarding_goal_selected',
  ONBOARDING_GRADE_SELECTED: 'onboarding_grade_selected',
  SIGNUP_COMPLETED: 'signup_completed',
  DIAGNOSTIC_STARTED: 'diagnostic_started',
  DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
  BAC_PREDICTION_REVEALED: 'bac_prediction_revealed',
  FIRST_LESSON_COMPLETED: 'first_lesson_completed',
  TRIAL_ACTIVATED: 'trial_activated',
  TRIAL_SKIPPED: 'trial_skipped',

  // Daily engagement
  HOME_VIEWED: 'home_viewed',
  DAILY_CHALLENGE_STARTED: 'daily_challenge_started',
  DAILY_CHALLENGE_COMPLETED: 'daily_challenge_completed',
  EXERCISE_ATTEMPTED: 'exercise_attempted',
  FREE_QUESTION_ASKED: 'free_question_asked',
  STREAK_INCREMENTED: 'streak_incremented',
  STREAK_LOST: 'streak_lost',
  STREAK_FREEZE_USED: 'streak_freeze_used',

  // Mock BAC
  MOCK_BAC_STARTED: 'mock_bac_started',
  MOCK_BAC_COMPLETED: 'mock_bac_completed',

  // Conversion
  PRICING_PAGE_VIEWED: 'pricing_page_viewed',
  CHECKOUT_STARTED: 'checkout_started',
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_FAILED: 'payment_failed',

  // Referral
  REFERRAL_LINK_COPIED: 'referral_link_copied',
  REFERRAL_LINK_SHARED: 'referral_link_shared',
  REFERRAL_SIGNUP_COMPLETED: 'referral_signup_completed',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
