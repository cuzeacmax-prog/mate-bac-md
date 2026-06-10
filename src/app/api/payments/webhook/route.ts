/**
 * POST /api/payments/webhook — ETAPA 71 E3: webhook-ul providerului.
 * Semnătura (x-payment-signature) e OBLIGATORIE și verificată de provider;
 * evenimentul e idempotent pe event_id (applyWebhookEvent). Fără auth de
 * user — exact ca un webhook real.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPaymentProvider } from '@/lib/payments/provider';
import { applyWebhookEvent } from '@/lib/payments/state';

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('x-payment-signature') ?? '';
  const event = getPaymentProvider().verifyWebhook(payload, signature);
  if (!event) {
    console.error('[payments/webhook] semnătură invalidă sau payload corupt — respins');
    return NextResponse.json({ error: 'Semnătură invalidă' }, { status: 401 });
  }
  const result = await applyWebhookEvent(createServiceClient(), event);
  if (result.idempotent) return NextResponse.json({ ok: true, idempotent: true });
  if (!result.applied) return NextResponse.json({ error: 'Eveniment neaplicabil' }, { status: 422 });
  return NextResponse.json({ ok: true, status: result.status });
}
