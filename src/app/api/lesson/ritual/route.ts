/**
 * GET /api/lesson/ritual?concept=slug — ETAPA 70 G3: datele ritualului de
 * final de lecție. ZERO LLM: mastery-ul conceptului, streak-ul și următorul
 * concept de pe frontiera REALĂ a userului (frontier_concepts).
 * Apelat la începutul lecției (mastery inițial) și la final (delta).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { chisinauToday, computeStreak } from '@/lib/daily/daily';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  const slug = req.nextUrl.searchParams.get('concept')?.trim();
  if (!slug) return NextResponse.json({ error: 'concept este obligatoriu' }, { status: 400 });

  const service = createServiceClient();
  const { data: concept } = await service.from('concepts').select('id').eq('slug', slug).maybeSingle();
  if (!concept) return NextResponse.json({ error: 'Concept inexistent' }, { status: 404 });

  const { data: gradeRow } = await supabase
    .from('user_profiles').select('grade_level').eq('id', user.id).maybeSingle();
  const grade = (gradeRow?.grade_level as number | null) ?? 12;

  const [{ data: masteryRow }, frontier, streak] = await Promise.all([
    service
      .from('concept_mastery')
      .select('mastery')
      .eq('user_id', user.id)
      .eq('concept_id', concept.id)
      .maybeSingle(),
    service.rpc('frontier_concepts', { p_user_id: user.id, p_grade: grade, p_limit: 3 }),
    computeStreak(service, user.id, chisinauToday()),
  ]);

  const rows = (frontier.data ?? []) as Array<{ slug: string; name: string }>;
  const next = rows.find((r) => r.slug !== slug) ?? null;

  return NextResponse.json({
    mastery: Number(masteryRow?.mastery ?? 0),
    streak,
    next: next ? { slug: next.slug, name: next.name } : null,
  });
}
