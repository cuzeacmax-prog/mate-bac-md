import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * ETAPA 78 B2 — preferințele de notificare (toggle per tip), merge în
 * user_profiles.notification_preferences (jsonb). Service client pentru
 * merge atomic citit-scris pe profilul PROPRIU (id = auth.uid()).
 */
const ALLOWED = ['streak_reminders', 'daily_challenge', 'email', 'push'] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'JSON invalid' }, { status: 400 });

  const patch: Record<string, boolean> = {};
  for (const key of ALLOWED) {
    if (typeof body[key] === 'boolean') patch[key] = body[key] as boolean;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nimic de schimbat' }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: row } = await svc
    .from('user_profiles')
    .select('notification_preferences')
    .eq('id', user.id)
    .maybeSingle();
  const merged = { ...((row?.notification_preferences as object) ?? {}), ...patch };
  const { error } = await svc
    .from('user_profiles')
    .update({ notification_preferences: merged })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, preferences: merged });
}
