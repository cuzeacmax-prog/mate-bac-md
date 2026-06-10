/**
 * POST /api/payments/mock-pay — ETAPA 71 E3: „providerul" simulat.
 * Pagina de checkout mock confirmă/eșuează plata; aici se construiește
 * evenimentul, se SEMNEAZĂ (HMAC) și se aplică prin ACELAȘI applyWebhookEvent
 * ca webhook-ul — fluxul complet, fără scurtături. Doar pe provider mock.
 */
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPaymentProvider, type WebhookEvent } from '@/lib/payments/provider';
import { signPayload } from '@/lib/payments/mock';
import { applyWebhookEvent, getPlanConfig } from '@/lib/payments/state';

export async function POST(req: NextRequest) {
  if (getPaymentProvider().name !== 'mock') {
    return NextResponse.json({ error: 'Doar pe providerul mock' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { ref?: string; outcome?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  const ref = body.ref?.trim();
  const outcome = body.outcome === 'fail' ? 'payment_failed' : 'payment_succeeded';
  if (!ref) return NextResponse.json({ error: 'ref obligatoriu' }, { status: 400 });

  const service = createServiceClient();
  const plan = await getPlanConfig(service);
  const event: WebhookEvent = {
    event_id: `evt_${randomUUID()}`,
    type: outcome,
    provider_ref: ref,
    user_id: user.id,
    plan: plan.plan,
    amount_lei: plan.price_lei,
    ...(outcome === 'payment_failed' ? { failure_reason: 'mock: plată refuzată simulat' } : {}),
  };
  // semnat + verificat — EXACT drumul webhook-ului real
  const payload = JSON.stringify(event);
  const verified = getPaymentProvider().verifyWebhook(payload, signPayload(payload));
  if (!verified) return NextResponse.json({ error: 'Semnare internă eșuată' }, { status: 500 });
  const result = await applyWebhookEvent(service, verified);
  return NextResponse.json({ ok: result.applied, status: result.status ?? null });
}
