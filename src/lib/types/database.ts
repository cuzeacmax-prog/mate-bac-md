// ETAPA 10 — Types pentru noul schema

import type { Goal } from '@/lib/profile/goal';

export type SubscriptionTier = 'free' | 'trial' | 'premium' | 'pro' | 'family';
export type SessionType = 'daily_challenge' | 'free_question' | 'mock_bac' | 'diagnostic' | 'practice';
export type SubscriptionEventType = 'started' | 'renewed' | 'upgraded' | 'downgraded' | 'cancelled' | 'expired' | 'refunded';

export interface UserProfileExtended {
  id: string;
  email: string;

  // Onboarding
  target_bac_score: number | null;
  grade_level: 9 | 10 | 11 | 12 | null;
  // ETAPA 82: obiectivul elevului (BAC ca mod, nu cadru). NULL = neconfirmat.
  goal: Goal | null;
  onboarding_completed: boolean;
  onboarding_completed_at: Date | null;

  // BAC Prediction
  current_bac_prediction: number | null;
  initial_bac_prediction: number | null;
  bac_prediction_updated_at: Date | null;

  // Streak
  streak_current: number;
  streak_longest: number;
  streak_last_activity_date: Date | null;
  streak_freezes_available: number;

  // Subscription
  subscription_tier: SubscriptionTier;
  subscription_started_at: Date | null;
  subscription_expires_at: Date | null;
  trial_started_at: Date | null;
  trial_used: boolean;

  // Referral
  referral_code: string;
  referred_by_user_id: string | null;

  // Tracking
  total_exercises_solved: number;
  total_minutes_studied: number;
  last_active_at: Date;
  notification_preferences: NotificationPreferences;

  // AI Cost tracking
  monthly_ai_cost_cents: number;
  ai_cost_reset_at: Date;
}

export interface NotificationPreferences {
  push: boolean;
  email: boolean;
  streak_reminders: boolean;
  daily_challenge: boolean;
  mock_bac: boolean;
}

export interface TopicMastery {
  id: string;
  user_id: string;
  topic_id: string;
  topic_display_name: string;
  mastery_score: number;
  exercises_attempted: number;
  exercises_correct: number;
  last_practice_at: Date | null;
  needs_review: boolean;
  next_review_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExerciseAttempt {
  id: string;
  user_id: string;
  exercise_id: string | null;
  topic_id: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  is_correct: boolean;
  time_spent_seconds: number | null;
  user_answer: string | null;
  correct_answer: string | null;
  hints_used: number;
  session_type: SessionType;
  metadata: Record<string, unknown> | null;
  attempted_at: Date;
}

export interface StreakLog {
  id: string;
  user_id: string;
  activity_date: Date;
  exercises_count: number;
  minutes_studied: number;
  created_at: Date;
}

export interface DailyChallenge {
  id: string;
  user_id: string;
  challenge_date: Date;
  exercises: ChallengeExercise[];
  exercises_completed: number;
  exercises_correct: number;
  estimated_minutes: number;
  actual_minutes: number | null;
  completed: boolean;
  completed_at: Date | null;
  created_at: Date;
}

export interface ChallengeExercise {
  exercise_id: string;
  topic_id: string;
  difficulty: number;
  prompt: string;
  expected_answer: string;
  hint?: string;
  user_answer?: string;
  is_correct?: boolean;
}

export interface MockBacAttempt {
  id: string;
  user_id: string;
  started_at: Date;
  completed_at: Date | null;
  duration_seconds: number | null;
  total_score: number | null;
  exercises_data: unknown;
  detailed_feedback: unknown;
  grade_level: number;
  is_completed: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  event_type: SubscriptionEventType;
  amount_lei: number | null;
  duration_days: number | null;
  payment_provider: string | null;
  payment_id: string | null;
  created_at: Date;
}

export interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  status: 'pending' | 'completed' | 'rewarded';
  reward_granted_at: Date | null;
  created_at: Date;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent: string | null;
  created_at: Date;
  last_used_at: Date;
}

// Topic constants
export const TOPICS_GRADE_10 = [
  { id: 'algebra_ecuatii', name: 'Algebră - Ecuații' },
  { id: 'algebra_inecuatii', name: 'Algebră - Inecuații' },
  { id: 'siruri', name: 'Șiruri' },
  { id: 'functii', name: 'Funcții' },
  { id: 'trigonometrie_baza', name: 'Trigonometrie de bază' },
  { id: 'logaritmi', name: 'Logaritmi' },
  { id: 'exponentiale', name: 'Funcții exponențiale' },
] as const;

export const TOPICS_GRADE_11 = [
  { id: 'limite', name: 'Limite de funcții' },
  { id: 'derivate', name: 'Derivate' },
  { id: 'derivate_aplicatii', name: 'Aplicații derivate' },
  { id: 'polinoame', name: 'Polinoame' },
  { id: 'ecuatii_log_exp', name: 'Ecuații log/exp' },
  { id: 'inecuatii_log_exp', name: 'Inecuații log/exp' },
  { id: 'siruri_avansate', name: 'Șiruri avansate' },
] as const;

export const TOPICS_GRADE_12 = [
  { id: 'primitive', name: 'Primitive' },
  { id: 'integrale', name: 'Integrale definite' },
  { id: 'arii_volume', name: 'Arii și volume' },
  { id: 'geometrie_3d', name: 'Geometrie 3D' },
  { id: 'numere_complexe', name: 'Numere complexe' },
  { id: 'matrici_determinanti', name: 'Matrici și determinanți' },
  { id: 'combinatorica', name: 'Combinatorică' },
  { id: 'probabilitati', name: 'Probabilități' },
] as const;

export type TopicId10 = (typeof TOPICS_GRADE_10)[number]['id'];
export type TopicId11 = (typeof TOPICS_GRADE_11)[number]['id'];
export type TopicId12 = (typeof TOPICS_GRADE_12)[number]['id'];
export type TopicId = TopicId10 | TopicId11 | TopicId12;

// Topic weights for BAC prediction (per grade)
export const TOPIC_WEIGHTS_GRADE_12: Record<string, number> = {
  'limite': 0.08,
  'derivate': 0.12,
  'integrale': 0.15,
  'arii_volume': 0.10,
  'geometrie_3d': 0.15,
  'numere_complexe': 0.08,
  'matrici_determinanti': 0.10,
  'combinatorica': 0.07,
  'probabilitati': 0.08,
  'primitive': 0.07,
};

export const TOPIC_WEIGHTS_GRADE_11: Record<string, number> = {
  'limite': 0.20,
  'derivate': 0.25,
  'derivate_aplicatii': 0.20,
  'polinoame': 0.10,
  'ecuatii_log_exp': 0.10,
  'inecuatii_log_exp': 0.10,
  'siruri_avansate': 0.05,
};

export const TOPIC_WEIGHTS_GRADE_10: Record<string, number> = {
  'algebra_ecuatii': 0.20,
  'algebra_inecuatii': 0.15,
  'siruri': 0.15,
  'functii': 0.15,
  'trigonometrie_baza': 0.15,
  'logaritmi': 0.10,
  'exponentiale': 0.10,
};
