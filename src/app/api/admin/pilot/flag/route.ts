/**
 * POST /api/admin/pilot/flag — ETAPA 78 FAZA D: adaugă/scoate un user din
 * cohorta pilot. Doar admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') {
    return NextResponse.json({ error: 'Doar admin' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { user_id?: string; is_pilot?: boolean } | null;
  if (!body?.user_id || typeof body.is_pilot !== 'boolean') {
    return NextResponse.json({ error: 'user_id și is_pilot obligatorii' }, { status: 400 });
  }
  const { error } = await createServiceClient()
    .from('user_profiles')
    .update({ is_pilot: body.is_pilot })
    .eq('id', body.user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
