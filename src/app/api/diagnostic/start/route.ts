import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { gradeLevel, targetBacScore } = await req.json();
  if (!gradeLevel || ![10, 11, 12].includes(gradeLevel)) {
    return Response.json({ error: 'gradeLevel invalid' }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from('diagnostic_sessions')
    .insert({
      user_id: user.id,
      grade_level: gradeLevel,
      target_bac_score: targetBacScore ?? null,
    })
    .select('id')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sessionId: session.id });
}
