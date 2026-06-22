import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { startTrial } from '@/lib/payments/state';
import { resolveGoal } from '@/lib/profile/goal';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { gradeLevel, targetBacScore, goal, activatedTrial } = await req.json();
  // ETAPA 82: un elev care termină onboardingul are mereu un obiectiv valid
  // (default sigur note_clasa dacă lipsește — niciodată presupunerea BAC).
  const resolvedGoal = resolveGoal(goal);

  // ETAPA 59: predicția și slăbiciunile vin din diagnostic_sessions (calculate
  // pe server la submit), NU din body-ul clientului.
  const { data: lastSession } = await supabase
    .from('diagnostic_sessions')
    .select('initial_bac_prediction, weaknesses')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const initialBacPrediction: number | null = lastSession?.initial_bac_prediction ?? null;
  const weaknesses: string[] = (lastSession?.weaknesses as string[] | null) ?? [];

  // Update user_profiles
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      grade_level: gradeLevel ?? null,
      target_bac_score: targetBacScore ?? null,
      goal: resolvedGoal,
      initial_bac_prediction: initialBacPrediction,
      current_bac_prediction: initialBacPrediction,
      bac_prediction_updated_at: new Date().toISOString(),
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileError) {
    console.error('[onboarding/complete] user_profiles update error:', JSON.stringify(profileError));
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  // ETAPA 60 (PAS 1): topic_mastery e DEPRECATED — nu se mai scrie de aici.
  // Starea elevului trăiește în concept_mastery, scrisă per-evidență de
  // /api/diagnostic/submit (și chat) pe conceptele din graf, nu pe topice plate.
  void weaknesses; // păstrat doar pentru telemetrie viitoare; nu se persistă aici

  // ETAPA 71 E2: trialul de 7 zile se LEAGĂ de subscriptions (status trialing
  // cu expirare) — nu mai rămâne un flag paralel ignorat.
  if (activatedTrial === true) {
    try {
      await startTrial(createServiceClient(), user.id);
    } catch (err) {
      console.error('[onboarding/complete] startTrial failed:', err instanceof Error ? err.message : err);
    }
  }

  return Response.json({ success: true });
}
