/**
 * exam.ts — ETAPA 69: simularea BAC (MVP onest).
 *
 * REGULA DE CONȚINUT: exclusiv exerciții SERVIBILE cu RĂSPUNS OFICIAL prin
 * link neambiguu (strict-bijectiv) — zero generare, scoring determinist-întâi
 * (ETAPA 63). Structura simulării e DICTATĂ de auditul pool-ului: cota per
 * modul se umple doar cât există; golurile se MARCHEAZĂ (Modulul VIII = 0 azi).
 * Cronometrul e server-side: started_at + durată; submit după deadline = respins.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashSeed, pickDeterministic } from '@/lib/daily/daily';
import { evaluateAttempt } from '@/lib/evaluare/evaluate';
import { recordConceptEvidence } from '@/lib/mastery/evidence';

export const EXAM_DURATION_MINUTES = 90;
/** cota-țintă per modul (proba completă ar fi mai mare — asta e varianta PARȚIALĂ onestă) */
export const MODULE_QUOTA: Record<string, number> = {
  'Modulul I': 1, 'Modulul II': 2, 'Modulul III': 1, 'Modulul IV': 1,
  'Modulul V': 2, 'Modulul VI': 1, 'Modulul VII': 1, 'Modulul VIII': 1,
};

export interface ExamItem {
  exercise_id: string;
  module: string;
  statement: string;
  has_figure: boolean;
  concept_slug: string | null;
}

export interface ExamAttempt {
  id: string;
  started_at: string;
  duration_minutes: number;
  items: ExamItem[];
  /** modulele cu cotă neacoperită din pool — simulare PARȚIALĂ, marcat */
  gaps: string[];
}

export interface ExamResult {
  total: number;
  correct: number;
  unevaluated: number;
  perModule: Array<{ module: string; correct: number; total: number }>;
  wrong: Array<{ exercise_id: string; module: string; concept_slug: string | null; statement: string }>;
  /** notă estimată ca INTERVAL, doar pe ce s-a testat */
  grade: { low: number; high: number; coveredModules: string[] } | null;
  expired: boolean;
}

/** pool-ul scorabil: servibil + răspuns oficial strict, cu primul concept legat */
async function loadPool(service: SupabaseClient): Promise<ExamItem[]> {
  const { data: links } = await service
    .from('exercise_answer_link')
    .select('exercise_id, exercise_raw(id, module, statement)')
    .eq('match_confidence', 'strict-bijectiv');
  const ids = (links ?? [])
    .map((l) => l.exercise_raw as unknown as { id: string; module: string | null; statement: string } | null)
    .filter((e): e is { id: string; module: string | null; statement: string } => !!e?.module);

  const exIds = ids.map((e) => e.id);
  const [{ data: figs }, { data: concepts }] = await Promise.all([
    service.from('figura_autor').select('exercise_id').in('exercise_id', exIds).in('status', ['approved', 'auto-acceptat']),
    service.from('exercise_concept_link').select('exercise_id, rank, concepts(slug)').in('exercise_id', exIds),
  ]);
  const figSet = new Set((figs ?? []).map((f) => f.exercise_id as string));
  const conceptByEx = new Map<string, string>();
  for (const c of concepts ?? []) {
    const slug = (c.concepts as unknown as { slug: string } | null)?.slug;
    if (slug && !conceptByEx.has(c.exercise_id as string)) conceptByEx.set(c.exercise_id as string, slug);
  }
  return ids.map((e) => ({
    exercise_id: e.id,
    module: e.module!,
    statement: e.statement,
    has_figure: figSet.has(e.id),
    concept_slug: conceptByEx.get(e.id) ?? null,
  }));
}

/** P1: auditul pool-ului → structura onest posibilă (per modul: disponibil vs cotă) */
export async function auditExamPool(service: SupabaseClient): Promise<{
  perModule: Array<{ module: string; available: number; quota: number; pick: number }>;
  gaps: string[];
}> {
  const pool = await loadPool(service);
  const byModule = new Map<string, number>();
  for (const p of pool) byModule.set(p.module, (byModule.get(p.module) ?? 0) + 1);
  const perModule = Object.entries(MODULE_QUOTA).map(([module, quota]) => {
    const available = byModule.get(module) ?? 0;
    return { module, available, quota, pick: Math.min(quota, available) };
  });
  return { perModule, gaps: perModule.filter((m) => m.pick < m.quota).map((m) => m.module) };
}

/** P2: creează un attempt — set determinist (seed per attempt), cronometru server-side */
export async function createExamAttempt(
  service: SupabaseClient,
  userId: string,
  grade: number
): Promise<ExamAttempt> {
  const pool = await loadPool(service);
  const audit = await auditExamPool(service);
  const seed = hashSeed(`${userId}:${Date.now()}`);

  const items: ExamItem[] = [];
  for (const m of audit.perModule) {
    if (m.pick === 0) continue;
    const candidates = pool.filter((p) => p.module === m.module).sort((a, b) => a.exercise_id.localeCompare(b.exercise_id));
    items.push(...pickDeterministic(candidates, m.pick, seed ^ hashSeed(m.module)));
  }
  if (items.length === 0) throw new Error('pool gol — simularea nu se poate construi');

  const { data: row, error } = await service
    .from('mock_bac_attempts')
    .insert({
      user_id: userId,
      started_at: new Date().toISOString(),
      grade_level: grade,
      is_completed: false,
      exercises_data: { seed, duration_minutes: EXAM_DURATION_MINUTES, items, gaps: audit.gaps },
    })
    .select('id, started_at')
    .single();
  if (error || !row) throw new Error(`attempt insert: ${error?.message}`);
  return {
    id: row.id as string,
    started_at: row.started_at as string,
    duration_minutes: EXAM_DURATION_MINUTES,
    items,
    gaps: audit.gaps,
  };
}

/** deadline-ul server-side (cu 60s grație de rețea) */
export function isExpired(startedAt: string, durationMinutes: number, now = new Date()): boolean {
  const deadline = new Date(startedAt + (startedAt.endsWith('Z') ? '' : 'Z')).getTime() + durationMinutes * 60_000 + 60_000;
  return now.getTime() > deadline;
}

/** P2/P3: submit final — expirare server-side, evaluare ETAPA 63, evidență 'exam' */
export async function submitExamAttempt(
  service: SupabaseClient,
  userId: string,
  attemptId: string,
  answers: Record<string, string>
): Promise<ExamResult> {
  const { data: att, error } = await service
    .from('mock_bac_attempts')
    .select('id, user_id, started_at, is_completed, exercises_data')
    .eq('id', attemptId)
    .maybeSingle();
  if (error || !att) throw new Error('attempt inexistent');
  if (att.user_id !== userId) throw new Error('attempt-ul nu îți aparține');
  if (att.is_completed) throw new Error('attempt deja încheiat');

  const data = att.exercises_data as { duration_minutes: number; items: ExamItem[]; gaps: string[] };

  // expirarea — calculată pe server, nu în JS-ul clientului
  if (isExpired(att.started_at as string, data.duration_minutes)) {
    await service
      .from('mock_bac_attempts')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        total_score: null,
        detailed_feedback: { expired: true },
      })
      .eq('id', attemptId);
    return {
      total: data.items.length, correct: 0, unevaluated: data.items.length,
      perModule: [], wrong: [], grade: null, expired: true,
    };
  }

  // evaluarea fiecărui item prin nivelurile ETAPEI 63 (determinist întâi)
  const results: Array<{ item: ExamItem; correct: boolean | null }> = [];
  for (const item of data.items) {
    const answer = answers[item.exercise_id]?.trim();
    if (!answer) { results.push({ item, correct: false }); continue; }
    const ev = await evaluateAttempt(service, {
      userId,
      conversationId: `exam-${attemptId}`,
      message: answer,
      exercise: { id: item.exercise_id, statement: item.statement },
      sessionType: 'mock_bac',
      assumeAttempt: true,
    });
    results.push({ item, correct: ev?.correct ?? null });
    if (item.concept_slug) {
      try {
        await recordConceptEvidence(service, userId, [item.concept_slug], ev?.correct ?? null, 'exam');
      } catch (e) {
        console.error('[simulare] evidence failed:', e instanceof Error ? e.message : e);
      }
    }
  }

  const correct = results.filter((r) => r.correct === true).length;
  const unevaluated = results.filter((r) => r.correct === null).length;
  const moduleAgg = new Map<string, { correct: number; total: number }>();
  for (const r of results) {
    const a = moduleAgg.get(r.item.module) ?? { correct: 0, total: 0 };
    a.total++;
    if (r.correct === true) a.correct++;
    moduleAgg.set(r.item.module, a);
  }
  const perModule = [...moduleAgg.entries()]
    .map(([module, a]) => ({ module, ...a }))
    .sort((a, b) => a.module.localeCompare(b.module, 'ro'));
  const wrong = results
    .filter((r) => r.correct !== true)
    .map((r) => ({
      exercise_id: r.item.exercise_id,
      module: r.item.module,
      concept_slug: r.item.concept_slug,
      statement: r.item.statement,
    }));

  // nota: DOAR pe ce s-a testat, ca interval (1..10 scalat liniar, ±0.5)
  const ratio = results.length > 0 ? correct / results.length : 0;
  const center = 1 + 9 * ratio;
  const grade = {
    low: Math.max(1, Math.round((center - 0.5) * 10) / 10),
    high: Math.min(10, Math.round((center + 0.5) * 10) / 10),
    coveredModules: perModule.map((m) => m.module),
  };

  const result: ExamResult = {
    total: results.length, correct, unevaluated, perModule, wrong, grade, expired: false,
  };
  const { error: upErr } = await service
    .from('mock_bac_attempts')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      total_score: correct,
      duration_seconds: Math.round((Date.now() - new Date(att.started_at + 'Z').getTime()) / 1000),
      detailed_feedback: result as unknown as Record<string, unknown>,
    })
    .eq('id', attemptId);
  if (upErr) console.error('[simulare] finalize failed:', upErr.message);
  return result;
}
