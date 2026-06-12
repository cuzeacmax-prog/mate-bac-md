import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * ETAPA 78 C1 — emailul părintelui (opțional): când există, raportul
 * săptămânal pleacă și către părinte. String gol → se șterge.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { parent_email?: unknown } | null;
  const raw = typeof body?.parent_email === 'string' ? body.parent_email.trim() : null;
  if (raw === null) return NextResponse.json({ error: 'parent_email lipsă' }, { status: 400 });
  if (raw !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return NextResponse.json({ error: 'Email invalid' }, { status: 400 });
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from('user_profiles')
    .update({ parent_email: raw === '' ? null : raw })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, parent_email: raw === '' ? null : raw });
}
