import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyUnsubscribeToken } from '@/lib/notify/email';

/**
 * ETAPA 78 C1 — dezabonarea dintr-un click, fără login (linkul din footerul
 * fiecărui email poartă un token HMAC legat de user). Setează
 * notification_preferences.email = false și confirmă pe o pagină simplă.
 */
function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#171a2b;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<div style="max-width:420px;padding:40px 28px;text-align:center;color:#e8e9f0">
<p style="font-size:17px;font-weight:700;margin:0 0 16px">Profesor Maxim</p>
<h1 style="font-size:21px;margin:0 0 12px">${title}</h1>
<p style="font-size:15px;line-height:1.6;color:#a9aec4;margin:0">${body}</p>
</div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('u');
  const token = req.nextUrl.searchParams.get('t');
  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) {
    return page('Link invalid', 'Linkul de dezabonare nu e valid sau a fost modificat.');
  }

  const svc = createServiceClient();
  const { data: row } = await svc
    .from('user_profiles')
    .select('notification_preferences')
    .eq('id', userId)
    .maybeSingle();
  if (!row) return page('Link invalid', 'Contul nu există.');

  const merged = { ...((row.notification_preferences as object) ?? {}), email: false };
  await svc.from('user_profiles').update({ notification_preferences: merged }).eq('id', userId);
  await svc.from('notifications_log').insert({
    user_id: userId,
    notification_type: 'email-unsubscribe',
    channel: 'email',
    metadata: { status: 'dezabonat' },
  });

  return page(
    'Te-am dezabonat',
    'Nu îți mai trimitem emailuri de re-angajare. Le poți reporni oricând din Setări, în aplicație.'
  );
}
