/**
 * POST /api/daily/attempt — ETAPA 14: încercarea elevului pe un exercițiu din
 * daily challenge. Evaluarea trece prin ACELAȘI cod ca chat-ul (ETAPA 63:
 * determinist → judecător) și mișcă concept_mastery (source='exercise').
 * La completarea zilei: streak_log + streak-ul recalculat server-side.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { evaluateAttempt } from '@/lib/evaluare/evaluate';
import { recordConceptEvidence } from '@/lib/mastery/evidence';
import {
  chisinauToday,
  computeStreak,
  recordDailyAttempt,
  type DailyExercise,
} from '@/lib/daily/daily';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { exerciseId?: string; answer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  const exerciseId = body.exerciseId?.trim();
  const answer = body.answer?.trim();
  if (!exerciseId || !answer) {
    return NextResponse.json({ error: 'exerciseId și answer sunt obligatorii' }, { status: 400 });
  }

  const service = createServiceClient();
  const today = chisinauToday();

  // exercițiul trebuie să fie în daily-ul de azi al userului
  const { data: challenge } = await service
    .from('daily_challenges')
    .select('exercises')
    .eq('user_id', user.id)
    .eq('challenge_date', today)
    .maybeSingle();
  const exercises = (challenge?.exercises as unknown as DailyExercise[]) ?? [];
  const dailyEx = exercises.find((e) => e.exercise_id === exerciseId);
  if (!dailyEx) {
    return NextResponse.json({ error: 'Exercițiul nu face parte din daily-ul de azi' }, { status: 404 });
  }

  // evaluarea (ETAPA 63): determinist pe răspuns oficial, altfel judecător
  const evaluation = await evaluateAttempt(service, {
    userId: user.id,
    conversationId: `daily-${today}`,
    message: answer,
    exercise: { id: exerciseId, statement: dailyEx.statement },
    sessionType: 'daily_challenge',
    assumeAttempt: true,
  });
  if (!evaluation) {
    return NextResponse.json({ error: 'Evaluarea a eșuat — încearcă din nou' }, { status: 502 });
  }

  // mastery pe conceptul pentru care a fost ales exercițiul
  try {
    await recordConceptEvidence(service, user.id, [dailyEx.concept_slug], evaluation.correct, 'exercise');
  } catch (err) {
    console.error('[api/daily] evidence failed:', err instanceof Error ? err.message : err);
  }

  // starea daily + streak
  const state = await recordDailyAttempt(service, user.id, today, exerciseId, evaluation.correct);
  const streak = await computeStreak(service, user.id, today);

  return NextResponse.json({
    correct: evaluation.correct,
    method: evaluation.method,
    confidence: evaluation.confidence,
    completed: state?.completed ?? false,
    exercises: state?.exercises ?? exercises,
    streak,
  });
}
