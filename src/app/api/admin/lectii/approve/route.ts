/**
 * POST /api/admin/lectii/approve — ETAPA 75 B4: aprobarea profesorului.
 * Doar admin; approve=true → status 'aprobat-profesor' (+approved_at);
 * approve=false → doar observațiile se salvează.
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

  let body: { id?: string; approve?: boolean; observatii?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'id obligatoriu' }, { status: 400 });

  const svc = createServiceClient();
  const update: Record<string, unknown> = { observatii: body.observatii?.trim() || null };
  if (body.approve) {
    update.status = 'aprobat-profesor';
    update.approved_at = new Date().toISOString();
  }
  const { error } = await svc.from('lesson_canonical').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
