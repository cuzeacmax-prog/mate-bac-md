/**
 * POST /api/simulare/start — ETAPA 69: pornește o simulare BAC parțială.
 * Setul e determinist (seed per attempt) din pool-ul servibil cu răspuns
 * oficial; cronometrul pleacă server-side (started_at).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createExamAttempt } from '@/lib/simulare/exam';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  const { data: profileRow } = await supabase
    .from('user_profiles').select('grade_level').eq('id', user.id).maybeSingle();
  const grade = (profileRow?.grade_level as number | null) ?? 12;

  try {
    const attempt = await createExamAttempt(createServiceClient(), user.id, grade);
    return NextResponse.json(attempt);
  } catch (err) {
    console.error('[simulare/start]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Simularea nu a putut porni' }, { status: 500 });
  }
}
