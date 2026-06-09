import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { gradeLevel, targetBacScore } = await req.json();

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

  // Initialize topic_mastery for this grade
  const topicsByGrade: Record<number, Array<{ id: string; name: string }>> = {
    10: [
      { id: 'algebra_ecuatii', name: 'Algebrǎ - Ecuații' },
      { id: 'algebra_inecuatii', name: 'Algebrǎ - Inecuații' },
      { id: 'siruri', name: 'Șiruri' },
      { id: 'functii', name: 'Funcții' },
      { id: 'trigonometrie_baza', name: 'Trigonometrie de bazǎ' },
      { id: 'logaritmi', name: 'Logaritmi' },
      { id: 'exponentiale', name: 'Funcții exponențiale' },
    ],
    11: [
      { id: 'limite', name: 'Limite de funcții' },
      { id: 'derivate', name: 'Derivate' },
      { id: 'derivate_aplicatii', name: 'Aplicații derivate' },
      { id: 'polinoame', name: 'Polinoame' },
      { id: 'ecuatii_log_exp', name: 'Ecuații log/exp' },
      { id: 'inecuatii_log_exp', name: 'Inecuații log/exp' },
      { id: 'siruri_avansate', name: 'Șiruri avansate' },
    ],
    12: [
      { id: 'primitive', name: 'Primitive' },
      { id: 'integrale', name: 'Integrale definite' },
      { id: 'arii_volume', name: 'Arii și volume' },
      { id: 'geometrie_3d', name: 'Geometrie 3D' },
      { id: 'numere_complexe', name: 'Numere complexe' },
      { id: 'matrici_determinanti', name: 'Matrici și determinanți' },
      { id: 'combinatorica', name: 'Combinatoricǎ' },
      { id: 'probabilitati', name: 'Probabilitǎți' },
    ],
  };

  const topics = topicsByGrade[gradeLevel ?? 12] ?? topicsByGrade[12];
  const weaknessSet = new Set<string>(weaknesses);

  const masteryRows = topics.map((t) => ({
    user_id: user.id,
    topic_id: t.id,
    topic_display_name: t.name,
    mastery_score: weaknessSet.has(t.id) ? 10 : 50, // weaknesses start lower
    needs_review: weaknessSet.has(t.id),
  }));

  // ETAPA 59 (P4): eroarea upsert-ului NU se mai înghite — se loghează și
  // request-ul răspunde 500, ca defectul să fie vizibil, nu tăcut.
  const { error: masteryError } = await supabase
    .from('topic_mastery')
    .upsert(masteryRows, { onConflict: 'user_id,topic_id' });

  if (masteryError) {
    console.error('[onboarding/complete] topic_mastery upsert error:', JSON.stringify(masteryError));
    return Response.json({ error: `topic_mastery: ${masteryError.message}` }, { status: 500 });
  }

  return Response.json({ success: true });
}
