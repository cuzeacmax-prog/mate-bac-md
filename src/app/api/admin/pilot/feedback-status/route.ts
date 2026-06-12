/**
 * POST /api/admin/pilot/feedback-status — ETAPA 78 FAZA D: inbox-ul de
 * feedback primește stare (nou/văzut/rezolvat). Doar admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const STATUSES = ['nou', 'vazut', 'rezolvat'] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') {
    return NextResponse.json({ error: 'Doar admin' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id || !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: 'id și status (nou/vazut/rezolvat) obligatorii' }, { status: 400 });
  }
  const { error } = await createServiceClient()
    .from('admin_feedback')
    .update({ status: body.status })
    .eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
