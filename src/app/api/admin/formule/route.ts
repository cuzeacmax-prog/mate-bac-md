/**
 * /api/admin/formule — ETAPA 83 I: Maxim aprobă o foaie de formule
 * („de_revizuit" → „verificat"). Doar admin. Conținutul rămâne derivat din
 * lecțiile canonice; aici se schimbă doar statusul de verificare.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') return NextResponse.json({ error: 'Doar admin' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { sheet_key?: string; title?: string; status?: string } | null;
  if (!body?.sheet_key || (body.status !== 'verificat' && body.status !== 'de_revizuit')) {
    return NextResponse.json({ error: 'sheet_key + status (verificat|de_revizuit) obligatorii' }, { status: 400 });
  }
  const svc = createServiceClient();
  const { error } = await svc.from('formula_sheets').upsert(
    {
      sheet_key: body.sheet_key,
      title: body.title ?? null,
      status: body.status,
      approved_by: body.status === 'verificat' ? (user.email ?? 'admin') : null,
      approved_at: body.status === 'verificat' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'sheet_key' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sheet_key: body.sheet_key, status: body.status });
}
