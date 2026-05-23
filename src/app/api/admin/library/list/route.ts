import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();
  return profile?.subscription_status === 'admin' ? user : null;
}

// GET /api/admin/library/list?topic=&difficulty=&grade=&needs_review=&page=&limit=
export async function GET(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const topic = searchParams.get('topic');
  const difficulty = searchParams.get('difficulty');
  const grade = searchParams.get('grade');
  const needsReview = searchParams.get('needs_review');
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
  const offset = (page - 1) * limit;

  const sb = createServiceClient();

  let query = sb
    .from('solved_exercises')
    .select(
      'id, statement, solution, topic, subtopic, difficulty, grade_level, tags, svg_static, needs_review, reviewed_by_admin, source, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (topic) query = query.eq('topic', topic);
  if (difficulty) query = query.eq('difficulty', parseInt(difficulty, 10));
  if (grade) query = query.eq('grade_level', parseInt(grade, 10));
  if (needsReview === 'true') query = query.eq('needs_review', true);
  if (needsReview === 'false') query = query.eq('needs_review', false);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, limit });
}

// PATCH /api/admin/library/list — update exercise fields
export async function PATCH(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  let body: { id?: string; statement?: string; solution?: string; reviewed_by_admin?: boolean; needs_review?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('solved_exercises')
    .update(updates)
    .eq('id', id)
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// DELETE /api/admin/library/list?id=
export async function DELETE(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const sb = createServiceClient();
  const { error } = await sb.from('solved_exercises').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
