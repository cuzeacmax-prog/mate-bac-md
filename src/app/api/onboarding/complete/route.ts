import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { gradeLevel, targetBacScore, initialBacPrediction, weaknesses } =
    await req.json();

  // Update user_profiles
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      grade_level: gradeLevel ?? null,
      target_bac_score: targetBacScore ?? null,
      initial_bac_prediction: initialBacPrediction ?? null,
      current_bac_prediction: initialBacPrediction ?? null,
      bac_prediction_updated_at: new Date().toISOString(),
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileError) {
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
  const weaknessSet = new Set<string>(weaknesses ?? []);

  const masteryRows = topics.map((t) => ({
    user_id: user.id,
    topic_id: t.id,
    topic_display_name: t.name,
    mastery_score: weaknessSet.has(t.id) ? 10 : 50, // weaknesses start lower
    needs_review: weaknessSet.has(t.id),
  }));

  await supabase
    .from('topic_mastery')
    .upsert(masteryRows, { onConflict: 'user_id,topic_id' });

  return Response.json({ success: true });
}
