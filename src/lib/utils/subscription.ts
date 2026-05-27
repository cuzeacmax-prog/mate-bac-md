import type { SubscriptionTier } from '@/lib/types/database';

export interface TierLimits {
  questions_per_day: number;
  daily_challenges_per_week: number;
  voice_mode: boolean;
  voice_minutes_per_day?: number;
  mock_bac: boolean;
  memory_persistence: boolean;
  zoom_sessions_per_month?: number;
  accounts_included?: number;
}

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  switch (tier) {
    case 'free':
      return {
        questions_per_day: 20,
        daily_challenges_per_week: 2,
        voice_mode: false,
        mock_bac: false,
        memory_persistence: false,
      };
    case 'trial':
    case 'premium':
      return {
        questions_per_day: Infinity,
        daily_challenges_per_week: 7,
        voice_mode: true,
        voice_minutes_per_day: 20,
        mock_bac: true,
        memory_persistence: true,
      };
    case 'pro':
      return {
        questions_per_day: Infinity,
        daily_challenges_per_week: 7,
        voice_mode: true,
        voice_minutes_per_day: Infinity,
        mock_bac: true,
        memory_persistence: true,
        zoom_sessions_per_month: 1,
      };
    case 'family':
      return {
        questions_per_day: Infinity,
        daily_challenges_per_week: 7,
        voice_mode: true,
        voice_minutes_per_day: 20,
        mock_bac: true,
        memory_persistence: true,
        accounts_included: 2,
      };
  }
}

export function isPremiumTier(tier: SubscriptionTier): boolean {
  return tier !== 'free';
}

export function isSubscriptionActive(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}
