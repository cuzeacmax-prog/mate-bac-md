/**
 * CAT (Computerized Adaptive Testing) algorithm
 * Adjusts difficulty based on user performance during onboarding diagnostic.
 */

export interface DiagnosticAttempt {
  exercise_id: string;
  difficulty: number;
  is_correct: boolean;
  time_spent_seconds: number;
  topic_id: string;
  selected_letter?: string;
  correct_letter?: string;
}

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 8;
const START_DIFFICULTY = 3;

/**
 * Determines next difficulty based on history.
 * CAT: bump up on correct, down on wrong.
 */
export function nextDifficulty(history: DiagnosticAttempt[]): number {
  if (history.length === 0) return START_DIFFICULTY;

  const last = history[history.length - 1];
  if (last.is_correct) {
    return Math.min(5, last.difficulty + 1);
  } else {
    return Math.max(1, last.difficulty - 1);
  }
}

/**
 * Determines if diagnostic should stop.
 * Stops when:
 *  - >= MAX_QUESTIONS answered
 *  - >= MIN_QUESTIONS AND difficulty has stabilized (range <= 1 in last 3)
 */
export function shouldStop(history: DiagnosticAttempt[]): boolean {
  if (history.length >= MAX_QUESTIONS) return true;
  if (history.length < MIN_QUESTIONS) return false;

  const lastThree = history.slice(-3);
  const difficulties = lastThree.map((h) => h.difficulty);
  const range = Math.max(...difficulties) - Math.min(...difficulties);
  return range <= 1;
}

/**
 * Calculates initial BAC prediction from diagnostic history.
 * Maps performance to 1.0–10.0 scale.
 */
export function calculateInitialBACPrediction(history: DiagnosticAttempt[]): number {
  if (history.length === 0) return 5.0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const attempt of history) {
    // Correct answers at higher difficulty = higher score
    const baseScore = attempt.is_correct
      ? 2.0 + attempt.difficulty * 1.4   // 3.4 (diff 1) → 9.0 (diff 5)
      : 1.0 + attempt.difficulty * 0.8;  // 1.8 (diff 1) → 5.0 (diff 5)

    const weight = attempt.difficulty; // Higher difficulty carries more weight
    weightedSum += baseScore * weight;
    totalWeight += weight;
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 5.0;

  // Speed bonus: avg < 60s at score > 6.0
  const avgTime =
    history.reduce((s, a) => s + a.time_spent_seconds, 0) / history.length;
  const speedBonus = avgTime < 60 && rawScore > 6.0 ? 0.3 : 0;

  const final = rawScore + speedBonus;
  return Math.min(10.0, Math.max(2.0, Math.round(final * 10) / 10));
}

/**
 * Identifies top 3 weakest topics from diagnostic history.
 */
export function identifyWeaknesses(history: DiagnosticAttempt[]): string[] {
  const topicStats = new Map<string, { wrong: number; total: number }>();

  for (const attempt of history) {
    const stats = topicStats.get(attempt.topic_id) || { wrong: 0, total: 0 };
    stats.total += 1;
    if (!attempt.is_correct) stats.wrong += 1;
    topicStats.set(attempt.topic_id, stats);
  }

  return Array.from(topicStats.entries())
    .map(([topic, stats]) => ({
      topic,
      errorRate: stats.total > 0 ? stats.wrong / stats.total : 0,
    }))
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 3)
    .map((t) => t.topic);
}
