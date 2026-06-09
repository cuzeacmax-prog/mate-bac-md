/**
 * daily.ts — ETAPA 14 (FAZA 4): daily challenge determinist + streak.
 *
 * Daily: 1–3 exerciții SERVIBILE (exercise_servable, ETAPA 64) de pe frontiera
 * userului (frontier_concepts), alese DETERMINIST cu seed = (user_id, data) —
 * aceeași zi → aceleași exerciții (garantat dublu: seed + rând persistat în
 * daily_challenges cu unique (user_id, challenge_date)).
 *
 * Streak: o zi = daily completat → rând în streak_log (unique user_id+activity_date);
 * seria neîntreruptă se calculează server-side din zilele consecutive.
 * Zero LLM aici; evaluarea răspunsurilor trece prin lib/evaluare (ETAPA 63).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DailyExercise {
  exercise_id: string;
  concept_slug: string;
  concept_name: string;
  statement: string;
  module: string | null;
  tier: 'verificat' | 'sursa-oficiala';
  has_figure: boolean;
  /** completat de elev (corect sau nu) */
  attempted: boolean;
  correct: boolean | null;
}

export interface DailyChallenge {
  id: string;
  challenge_date: string; // YYYY-MM-DD
  exercises: DailyExercise[];
  completed: boolean;
}

const DAILY_MAX = 3;

/** data „de azi" în fusul orar al elevilor (Chișinău), format YYYY-MM-DD */
export function chisinauToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Chisinau',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// ── PRNG determinist (pur, testabil) ─────────────────────────────────────────
/** FNV-1a pe string → seed 32-bit */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — generator determinist mic */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** alege determinist k elemente din listă (seed fix → aceeași alegere) */
export function pickDeterministic<T>(items: T[], k: number, seed: number): T[] {
  const rand = mulberry32(seed);
  const pool = [...items];
  const out: T[] = [];
  while (out.length < k && pool.length > 0) {
    const idx = Math.floor(rand() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

interface FrontierRowLite {
  concept_id: string;
  slug: string;
  name: string;
  servable_exercises: number;
}

/**
 * Daily-ul zilei: îl întoarce pe cel persistat sau îl construiește determinist.
 */
export async function getOrCreateDailyChallenge(
  service: SupabaseClient,
  userId: string,
  grade: number,
  date: string
): Promise<DailyChallenge | null> {
  // 1) există deja? (aceeași zi → aceleași exerciții)
  const { data: existing, error: exErr } = await service
    .from('daily_challenges')
    .select('id, challenge_date, exercises, completed')
    .eq('user_id', userId)
    .eq('challenge_date', date)
    .maybeSingle();
  if (exErr) {
    console.error('[daily] lookup failed:', exErr.message);
    return null;
  }
  if (existing) {
    return {
      id: existing.id as string,
      challenge_date: existing.challenge_date as string,
      exercises: (existing.exercises as unknown as DailyExercise[]) ?? [],
      completed: !!existing.completed,
    };
  }

  // 2) frontiera userului → concepte cu exerciții servibile
  const { data: frontier, error: frErr } = await service.rpc('frontier_concepts', {
    p_user_id: userId,
    p_grade: grade,
    p_limit: 10,
  });
  if (frErr) {
    console.error('[daily] frontier failed:', frErr.message);
    return null;
  }
  const concepts = ((frontier ?? []) as FrontierRowLite[]).filter(
    (r) => Number(r.servable_exercises) > 0
  );
  if (concepts.length === 0) return null; // fără diagnostic / fără conținut servibil

  // 3) candidați: exercițiile servibile ale primelor concepte din frontieră
  const conceptIds = concepts.slice(0, DAILY_MAX).map((c) => c.concept_id);
  const { data: links } = await service
    .from('exercise_concept_link')
    .select('exercise_id, concept_id')
    .in('concept_id', conceptIds)
    .limit(600);
  const exIds = [...new Set((links ?? []).map((l) => l.exercise_id as string))];
  if (exIds.length === 0) return null;
  const { data: servable } = await service
    .from('exercise_servable')
    .select('exercise_id, tier')
    .in('exercise_id', exIds);
  const tierById = new Map((servable ?? []).map((s) => [s.exercise_id as string, s.tier as DailyExercise['tier']]));

  // grupare pe concept, în ordinea frontierei
  const byConcept = new Map<string, string[]>();
  for (const l of links ?? []) {
    const eid = l.exercise_id as string;
    if (!tierById.has(eid)) continue;
    const cid = l.concept_id as string;
    const arr = byConcept.get(cid) ?? [];
    arr.push(eid);
    byConcept.set(cid, arr);
  }

  // 4) alegere deterministă: câte un exercițiu per concept (max 3), seed=(user, dată)
  const seed = hashSeed(`${userId}:${date}`);
  const chosen: Array<{ exercise_id: string; concept: FrontierRowLite }> = [];
  const used = new Set<string>();
  for (const c of concepts) {
    if (chosen.length >= DAILY_MAX) break;
    const candidates = (byConcept.get(c.concept_id) ?? []).filter((id) => !used.has(id)).sort();
    if (candidates.length === 0) continue;
    const pick = pickDeterministic(candidates, 1, seed ^ hashSeed(c.concept_id))[0];
    chosen.push({ exercise_id: pick, concept: c });
    used.add(pick);
  }
  if (chosen.length === 0) return null;

  // 5) detaliile exercițiilor + figuri
  const chosenIds = chosen.map((c) => c.exercise_id);
  const [{ data: exRows }, { data: figs }] = await Promise.all([
    service.from('exercise_raw').select('id, statement, module').in('id', chosenIds),
    service
      .from('figura_autor')
      .select('exercise_id')
      .in('exercise_id', chosenIds)
      .in('status', ['approved', 'auto-acceptat']),
  ]);
  const figSet = new Set((figs ?? []).map((f) => f.exercise_id as string));
  const exercises: DailyExercise[] = [];
  for (const ch of chosen) {
    const row = (exRows ?? []).find((r) => r.id === ch.exercise_id);
    if (!row) continue;
    exercises.push({
      exercise_id: ch.exercise_id,
      concept_slug: ch.concept.slug,
      concept_name: ch.concept.name,
      statement: row.statement as string,
      module: (row.module as string | null) ?? null,
      tier: tierById.get(ch.exercise_id) ?? 'verificat',
      has_figure: figSet.has(ch.exercise_id),
      attempted: false,
      correct: null,
    });
  }
  if (exercises.length === 0) return null;

  // 6) persistă (unique user_id+challenge_date; cursa → recitește)
  const { data: inserted, error: insErr } = await service
    .from('daily_challenges')
    .insert({
      user_id: userId,
      challenge_date: date,
      exercises,
      exercises_completed: 0,
      exercises_correct: 0,
      estimated_minutes: exercises.length * 5,
      completed: false,
    })
    .select('id')
    .maybeSingle();
  if (insErr) {
    // conflict pe unique → altcineva l-a creat în paralel; recitește
    const { data: again } = await service
      .from('daily_challenges')
      .select('id, challenge_date, exercises, completed')
      .eq('user_id', userId)
      .eq('challenge_date', date)
      .maybeSingle();
    if (again) {
      return {
        id: again.id as string,
        challenge_date: again.challenge_date as string,
        exercises: (again.exercises as unknown as DailyExercise[]) ?? [],
        completed: !!again.completed,
      };
    }
    console.error('[daily] insert failed:', insErr.message);
    return null;
  }
  return { id: inserted!.id as string, challenge_date: date, exercises, completed: false };
}

/**
 * Marchează o încercare pe un exercițiu din daily; la final completează ziua
 * și scrie streak_log. Întoarce starea actualizată.
 */
export async function recordDailyAttempt(
  service: SupabaseClient,
  userId: string,
  date: string,
  exerciseId: string,
  correct: boolean | null
): Promise<{ completed: boolean; exercises: DailyExercise[] } | null> {
  const { data: row, error } = await service
    .from('daily_challenges')
    .select('id, exercises, completed')
    .eq('user_id', userId)
    .eq('challenge_date', date)
    .maybeSingle();
  if (error || !row) {
    if (error) console.error('[daily] attempt lookup failed:', error.message);
    return null;
  }
  const exercises = (row.exercises as unknown as DailyExercise[]) ?? [];
  const target = exercises.find((e) => e.exercise_id === exerciseId);
  if (!target) return null;
  // doar prima încercare contează pentru completare (re-încercările nu rescriu)
  if (!target.attempted) {
    target.attempted = true;
    target.correct = correct;
  }
  const attempted = exercises.filter((e) => e.attempted).length;
  const correctCount = exercises.filter((e) => e.correct === true).length;
  const completed = attempted >= exercises.length;

  const { error: upErr } = await service
    .from('daily_challenges')
    .update({
      exercises,
      exercises_completed: attempted,
      exercises_correct: correctCount,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', row.id);
  if (upErr) {
    console.error('[daily] attempt update failed:', upErr.message);
    return null;
  }

  if (completed) {
    // o zi = daily completat → rând în streak_log (idempotent pe unique)
    const { error: slErr } = await service.from('streak_log').upsert(
      {
        user_id: userId,
        activity_date: date,
        exercises_count: exercises.length,
      },
      { onConflict: 'user_id,activity_date' }
    );
    if (slErr) console.error('[daily] streak upsert failed:', slErr.message);
  }
  return { completed, exercises };
}

/**
 * Seria neîntreruptă de zile cu daily completat, terminând azi sau ieri
 * (azi încă necompletat nu rupe seria de ieri).
 */
export async function computeStreak(
  service: SupabaseClient,
  userId: string,
  today: string
): Promise<number> {
  const { data, error } = await service
    .from('streak_log')
    .select('activity_date')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false })
    .limit(400);
  if (error) {
    console.error('[daily] streak read failed:', error.message);
    return 0;
  }
  const days = new Set((data ?? []).map((r) => r.activity_date as string));
  if (days.size === 0) return 0;

  const dayMs = 86_400_000;
  const toUtc = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

  // pornește de azi; dacă azi lipsește, de ieri (seria nu e încă ruptă)
  let cursor = toUtc(today);
  if (!days.has(today)) cursor -= dayMs;
  let streak = 0;
  while (days.has(fromUtc(cursor))) {
    streak++;
    cursor -= dayMs;
  }
  return streak;
}
