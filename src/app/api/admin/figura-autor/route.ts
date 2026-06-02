import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * ETAPA 45 — verdictul UMAN peste cazul de autorat (compari DORIT vs GENERAT pe /admin/figura-autor).
 * Scrie DOAR verdict_uman în figura_autor. Gard admin. READ-ONLY pe rest.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  let body: { id?: unknown; verdict?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = typeof body.id === 'string' ? body.id : null;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const verdict = body.verdict === null || body.verdict === 'aprobat' || body.verdict === 'respins'
    ? (body.verdict as string | null) : undefined;
  if (verdict === undefined) return NextResponse.json({ error: 'verdict invalid (aprobat|respins|null)' }, { status: 400 });

  const { error } = await createServiceClient().from('figura_autor').update({ verdict_uman: verdict, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id, verdict });
}
