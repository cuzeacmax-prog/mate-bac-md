/**
 * /api/focus — ETAPA 71 B4: lentila „test mâine".
 * POST {concept_ids[], label?, hours?} → setează focusul (RLS user-owned);
 * DELETE → îl anulează. Harta/azi/daily îl citesc până la expirare.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_CONCEPTS = 60; // cel mai mare domeniu (Modulul IV) are 33 de concepte
const DEFAULT_HOURS = 36;
const MAX_HOURS = 14 * 24;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { concept_ids?: string[]; label?: string; hours?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  const ids = (body.concept_ids ?? []).filter((s) => typeof s === 'string').slice(0, MAX_CONCEPTS);
  if (ids.length === 0) return NextResponse.json({ error: 'concept_ids obligatoriu' }, { status: 400 });
  const hours = Math.min(Math.max(Number(body.hours) || DEFAULT_HOURS, 1), MAX_HOURS);
  const expires = new Date(Date.now() + hours * 3600_000).toISOString();

  const { error } = await supabase.from('user_focus').upsert(
    {
      user_id: user.id,
      concept_ids: ids,
      label: body.label?.slice(0, 80) ?? null,
      expires_at: expires,
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.error('[focus] upsert failed:', error.message);
    return NextResponse.json({ error: 'Eroare la salvare' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, expires_at: expires });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });
  const { error } = await supabase.from('user_focus').delete().eq('user_id', user.id);
  if (error) {
    console.error('[focus] delete failed:', error.message);
    return NextResponse.json({ error: 'Eroare la anulare' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
