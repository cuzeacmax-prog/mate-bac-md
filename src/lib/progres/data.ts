/**
 * data.ts — ETAPA 68: agregatele paginii /app/progres.
 *
 * O singură funcție folosită ȘI de pagină, ȘI de scriptul de acceptanță
 * (cifrele afișate = cifrele verificate). Un singur round-trip logic:
 * toate query-urile pleacă în paralel (Promise.all), agregare în JS — zero N+1,
 * zero LLM.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { chisinauToday, computeStreak } from '@/lib/daily/daily';

export type ConceptStatus = 'nestudiat' | 'in-lucru' | 'stapanit';
export const MASTERY_THRESHOLD = 0.6;

export interface ProgressConcept {
  id: string;
  slug: string;
  name: string;
  status: ConceptStatus;
  mastery: number;
}

export interface ProgressDomain {
  module: string;
  concepts: ProgressConcept[];
  mastered: number;
  inProgress: number;
  total: number;
  /** exerciții servibile în modul (0 → „în curând", nu listă goală) */
  servable: number;
}

export interface ProgressData {
  grade: number;
  domains: ProgressDomain[];
  totals: { mastered: number; inProgress: number; total: number };
  streak: number;
  exercisesSolved: number;
  exercisesCorrect: number;
  recent: Array<{ at: string; label: string; correct: boolean | null }>;
  /** DOAR dacă există diagnostic terminat — interval, nu cifră falsă */
  prediction: { value: number; low: number; high: number } | null;
}

const MODULE_ORDER = [
  'Modulul I', 'Modulul II', 'Modulul III', 'Modulul IV',
  'Modulul V', 'Modulul VI', 'Modulul VII', 'Modulul VIII',
];

export async function getProgressData(
  service: SupabaseClient,
  userId: string,
  grade: number
): Promise<ProgressData> {
  const [membership, mastery, servableRows, attempts, diag] = await Promise.all([
    service
      .from('concept_family_membership')
      .select('module, concept_id, concepts(id, slug, name, grade_level)'),
    service
      .from('concept_mastery')
      .select('concept_id, mastery')
      .eq('user_id', userId),
    service
      .from('exercise_servable')
      .select('exercise_id, exercise_raw(module)'),
    service
      .from('exercise_attempts')
      .select('exercise_id, is_correct, session_type, attempted_at')
      .eq('user_id', userId)
      .order('attempted_at', { ascending: false })
      .limit(500),
    service
      .from('diagnostic_sessions')
      .select('initial_bac_prediction, completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const masteryById = new Map(
    (mastery.data ?? []).map((m) => [m.concept_id as string, Number(m.mastery)])
  );

  // servabile per modul (pentru empty state onest)
  const servableByModule = new Map<string, number>();
  for (const r of servableRows.data ?? []) {
    const mod = (r.exercise_raw as unknown as { module: string | null } | null)?.module;
    if (mod) servableByModule.set(mod, (servableByModule.get(mod) ?? 0) + 1);
  }

  // harta: conceptele CLASEI elevului, grupate pe module (domenii ETAPA 61)
  const byModule = new Map<string, ProgressConcept[]>();
  const seen = new Set<string>();
  for (const row of membership.data ?? []) {
    const c = row.concepts as unknown as { id: string; slug: string; name: string; grade_level: number | null } | null;
    if (!c || c.grade_level !== grade) continue;
    if (seen.has(`${row.module}|${c.id}`)) continue;
    seen.add(`${row.module}|${c.id}`);
    const m = masteryById.get(c.id);
    const status: ConceptStatus =
      m === undefined ? 'nestudiat' : m >= MASTERY_THRESHOLD ? 'stapanit' : 'in-lucru';
    const arr = byModule.get(row.module as string) ?? [];
    arr.push({ id: c.id, slug: c.slug, name: c.name, status, mastery: m ?? 0 });
    byModule.set(row.module as string, arr);
  }

  const domains: ProgressDomain[] = [];
  for (const mod of MODULE_ORDER) {
    const concepts = (byModule.get(mod) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    if (concepts.length === 0 && !servableByModule.get(mod)) continue; // modul irelevant clasei
    domains.push({
      module: mod,
      concepts,
      mastered: concepts.filter((c) => c.status === 'stapanit').length,
      inProgress: concepts.filter((c) => c.status === 'in-lucru').length,
      total: concepts.length,
      servable: servableByModule.get(mod) ?? 0,
    });
  }

  const allAttempts = attempts.data ?? [];
  const recent = allAttempts.slice(0, 5).map((a) => ({
    at: a.attempted_at as string,
    label:
      a.session_type === 'daily_challenge' ? 'Provocarea zilei'
      : String(a.exercise_id).startsWith('quiz:') ? 'Quiz din lecție'
      : a.session_type === 'diagnostic' ? 'Diagnostic'
      : 'Exercițiu în chat',
    correct: a.is_correct as boolean | null,
  }));

  const streak = await computeStreak(service, userId, chisinauToday());

  const predictionValue = diag.data?.initial_bac_prediction as number | null | undefined;
  const prediction =
    predictionValue != null
      ? {
          value: Number(predictionValue),
          low: Math.max(1, Math.round((Number(predictionValue) - 0.5) * 10) / 10),
          high: Math.min(10, Math.round((Number(predictionValue) + 0.5) * 10) / 10),
        }
      : null;

  return {
    grade,
    domains,
    totals: {
      mastered: domains.reduce((s, d) => s + d.mastered, 0),
      inProgress: domains.reduce((s, d) => s + d.inProgress, 0),
      total: domains.reduce((s, d) => s + d.total, 0),
    },
    streak,
    exercisesSolved: allAttempts.length,
    exercisesCorrect: allAttempts.filter((a) => a.is_correct === true).length,
    recent,
    prediction,
  };
}
