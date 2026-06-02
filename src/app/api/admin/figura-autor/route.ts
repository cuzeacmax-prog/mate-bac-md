import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * ETAPA 45/46 — acțiuni UMANE peste cazul de autorat (pe /admin/figura-autor). Gard admin. Două acțiuni:
 *   • REMARCI pe desenul GENERAT  → { id, remarci:{text, pins:[{x,y,text}]} } → status 'needs_revision'
 *     (alimentează bucla de corecție rulată de Claude Code pe coadă).
 *   • VERDICT                      → { id, verdict:'approved'|'rejected'|null } → status idem (approved → bibliotecă).
 */
interface Pin { x: number; y: number; text: string }

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  let body: { id?: unknown; verdict?: unknown; remarci?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = typeof body.id === 'string' ? body.id : null;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const svc = createServiceClient();

  // ── REMARCI (revizie cerută) ──
  if (body.remarci !== undefined) {
    const r = body.remarci as { text?: unknown; pins?: unknown } | null;
    const text = r && typeof r.text === 'string' ? r.text.trim() : '';
    const pinsRaw = r && Array.isArray(r.pins) ? r.pins : [];
    const pins: Pin[] = pinsRaw
      .filter((p): p is Pin => !!p && typeof p === 'object' && typeof (p as Pin).x === 'number' && typeof (p as Pin).y === 'number')
      .map((p) => ({ x: p.x, y: p.y, text: typeof p.text === 'string' ? p.text.slice(0, 200) : '' }))
      .slice(0, 30);
    if (!text && pins.length === 0) return NextResponse.json({ error: 'Remarcă goală.' }, { status: 400 });
    const { error } = await svc.from('figura_autor').update({ remarci: { text: text.slice(0, 2000), pins }, status: 'needs_revision', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id, status: 'needs_revision', pins: pins.length });
  }

  // ── VERDICT (aprobat/respins) ──
  const verdict = body.verdict === null || body.verdict === 'approved' || body.verdict === 'rejected'
    ? (body.verdict as string | null) : undefined;
  if (verdict === undefined) return NextResponse.json({ error: 'verdict invalid (approved|rejected|null)' }, { status: 400 });
  const patch = verdict === null
    ? { verdict_uman: null, updated_at: new Date().toISOString() }
    : { verdict_uman: verdict, status: verdict, updated_at: new Date().toISOString() };
  const { error } = await svc.from('figura_autor').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id, verdict });
}
