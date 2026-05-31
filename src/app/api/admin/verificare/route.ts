import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * ETAPA 16 — verdictul UMAN peste verificarea CAS. Scrie DOAR human_status / human_note
 * în exercise_verification. Gard admin. READ-ONLY pe rest.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { id?: unknown; human_status?: unknown; human_note?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const id = typeof body.id === 'string' ? body.id : null;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const ALLOWED = ['confirmat', 'respins', null];
  const human_status = body.human_status === null || body.human_status === 'confirmat' || body.human_status === 'respins'
    ? (body.human_status as string | null) : undefined;
  if (human_status === undefined) {
    return NextResponse.json({ error: `human_status invalid (permis: ${ALLOWED.join(', ')})` }, { status: 400 });
  }
  const human_note = typeof body.human_note === 'string' ? body.human_note.slice(0, 1000) : null;

  const service = createServiceClient();
  const { error } = await service.from('exercise_verification')
    .update({ human_status, human_note }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id, human_status, human_note });
}
