/**
 * POST /api/payments/cancel — ETAPA 71 E3: anularea abonamentului.
 * Activ până la finalul perioadei (cancel_at_period_end) — nimic șters.
 */
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPaymentProvider, type WebhookEvent } from '@/lib/payments/provider';
import { applyWebhookEvent, getSubscription, getPlanConfig } from '@/lib/payments/state';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  const service = createServiceClient();
  const sub = await getSubscription(service, user.id);
  if (!sub) return NextResponse.json({ error: 'Fără abonament' }, { status: 404 });

  await getPaymentProvider().cancelSubscription(sub.provider_ref ?? '');
  const plan = await getPlanConfig(service);
  const event: WebhookEvent = {
    event_id: `evt_${randomUUID()}`,
    type: 'subscription_canceled',
    provider_ref: sub.provider_ref ?? 'mock_none',
    user_id: user.id,
    plan: plan.plan,
    amount_lei: 0,
  };
  const result = await applyWebhookEvent(service, event);
  return NextResponse.json({ ok: result.applied });
}
