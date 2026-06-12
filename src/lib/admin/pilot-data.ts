import type { SupabaseClient } from '@supabase/supabase-js';
import { chisinauToday, computeStreak } from '@/lib/daily/daily';

/**
 * ETAPA 78 FAZA D — datele panoului pilotului. ZERO LLM: doar agregări pe
 * tabelele reale (streak_log, exercise_attempts, conversations,
 * concept_mastery, katex_error_report, admin_feedback, api_usage_log).
 * Un singur ecran, citibil dimineața în 2 minute.
 */

export interface PilotUserRow {
  id: string;
  email: string;
  name: string | null;
  streak: number;
  attempts7: number;
  correct7: number;
  lessons7: number;
  costUsd7: number;
  activeToday: boolean;
  active7: boolean;
}

export interface PilotPanelData {
  pilots: PilotUserRow[];
  totals: {
    pilots: number;
    activeToday: number;
    active7: number;
    lessons7: number;
    attempts7: number;
    correct7: number;
    costUsd7: number;
  };
  topConcepts: Array<{ name: string; count: number }>;
  errors: Array<{ created_at: string; source: string | null; error: string | null; raw: string | null }>;
  feedback: Array<{
    id: string;
    rating: string;
    status: string;
    notes: string | null;
    ideal_response: string | null;
    created_at: string;
    message: string | null;
    conversation_id: string | null;
  }>;
  candidates: Array<{ id: string; email: string; name: string | null }>;
}

export async function gatherPilotPanel(svc: SupabaseClient, now = new Date()): Promise<PilotPanelData> {
  const today = chisinauToday(now);
  const week = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const todayStart = `${today}T00:00:00`;

  const { data: pilotProfiles } = await svc
    .from('user_profiles')
    .select('id, email, full_name')
    .eq('is_pilot', true)
    .order('created_at', { ascending: true });
  const pilots = (pilotProfiles ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>;
  const ids = pilots.map((p) => p.id);

  const [attemptsRes, lessonsRes, costRes, conceptsRes, errorsRes, feedbackRes, candidatesRes, streaks] =
    await Promise.all([
      ids.length
        ? svc
            .from('exercise_attempts')
            .select('user_id, is_correct, attempted_at')
            .in('user_id', ids)
            .gte('attempted_at', week)
        : Promise.resolve({ data: [] }),
      ids.length
        ? svc
            .from('conversations')
            .select('user_id')
            .in('user_id', ids)
            .gte('created_at', week)
            .like('title', 'Lecție:%')
        : Promise.resolve({ data: [] }),
      ids.length
        ? svc
            .from('api_usage_log')
            .select('user_id, cost_usd')
            .in('user_id', ids)
            .gte('created_at', week)
        : Promise.resolve({ data: [] }),
      ids.length
        ? svc
            .from('concept_mastery')
            .select('concepts(name)')
            .in('user_id', ids)
            .gte('last_evidence_at', week)
        : Promise.resolve({ data: [] }),
      svc
        .from('katex_error_report')
        .select('created_at, source, error, raw')
        .order('created_at', { ascending: false })
        .limit(10),
      svc
        .from('admin_feedback')
        .select('id, rating, status, notes, ideal_response, created_at, messages(content, conversation_id)')
        .order('created_at', { ascending: false })
        .limit(20),
      svc
        .from('user_profiles')
        .select('id, email, full_name')
        .eq('is_pilot', false)
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15),
      Promise.all(ids.map((id) => computeStreak(svc, id, today))),
    ]);

  type AttemptRow = { user_id: string; is_correct: boolean | null; attempted_at: string };
  const attempts = (attemptsRes.data ?? []) as AttemptRow[];
  const lessons = (lessonsRes.data ?? []) as Array<{ user_id: string }>;
  const costs = (costRes.data ?? []) as Array<{ user_id: string; cost_usd: number | null }>;

  const rows: PilotUserRow[] = pilots.map((p, i) => {
    const mine = attempts.filter((a) => a.user_id === p.id);
    const myCost = costs.filter((c) => c.user_id === p.id).reduce((s, c) => s + (c.cost_usd ?? 0), 0);
    return {
      id: p.id,
      email: p.email ?? '—',
      name: p.full_name,
      streak: streaks[i] ?? 0,
      attempts7: mine.length,
      correct7: mine.filter((a) => a.is_correct === true).length,
      lessons7: lessons.filter((l) => l.user_id === p.id).length,
      costUsd7: myCost,
      activeToday: mine.some((a) => a.attempted_at >= todayStart),
      active7: mine.length > 0,
    };
  });

  const conceptCounts = new Map<string, number>();
  for (const r of conceptsRes.data ?? []) {
    const name = (r.concepts as unknown as { name: string } | null)?.name;
    if (name) conceptCounts.set(name, (conceptCounts.get(name) ?? 0) + 1);
  }
  const topConcepts = [...conceptCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  type FbRow = {
    id: string;
    rating: string;
    status: string;
    notes: string | null;
    ideal_response: string | null;
    created_at: string;
    messages: { content: string; conversation_id: string } | null;
  };
  const feedback = ((feedbackRes.data ?? []) as unknown as FbRow[]).map((f) => ({
    id: f.id,
    rating: f.rating,
    status: f.status ?? 'nou',
    notes: f.notes,
    ideal_response: f.ideal_response,
    created_at: f.created_at,
    message: f.messages?.content?.slice(0, 160) ?? null,
    conversation_id: f.messages?.conversation_id ?? null,
  }));

  return {
    pilots: rows,
    totals: {
      pilots: rows.length,
      activeToday: rows.filter((r) => r.activeToday).length,
      active7: rows.filter((r) => r.active7).length,
      lessons7: rows.reduce((s, r) => s + r.lessons7, 0),
      attempts7: rows.reduce((s, r) => s + r.attempts7, 0),
      correct7: rows.reduce((s, r) => s + r.correct7, 0),
      costUsd7: rows.reduce((s, r) => s + r.costUsd7, 0),
    },
    topConcepts,
    errors: (errorsRes.data ?? []) as PilotPanelData['errors'],
    feedback,
    candidates: ((candidatesRes.data ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>).map(
      (c) => ({ id: c.id, email: c.email ?? '—', name: c.full_name })
    ),
  };
}
