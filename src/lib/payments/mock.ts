/**
 * mock.ts — ETAPA 71 E1: MockProvider — COMPLET funcțional.
 *
 * Semnătura webhook: HMAC-SHA256 pe payload-ul brut, cu secretul din
 * PAYMENT_WEBHOOK_SECRET (fallback de dev). Pagina de checkout e internă
 * (/app/abonament/checkout) — confirmarea/eșecul simulat trimit webhook-ul
 * SEMNAT prin /api/payments/mock-pay, exact ca un provider real.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { CheckoutSession, PaymentProvider, PlanConfig, WebhookEvent } from './provider';

const SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? 'mock-webhook-secret-dev';

export function signPayload(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex');
}

export class MockProvider implements PaymentProvider {
  readonly name = 'mock';

  async createCheckout(plan: PlanConfig, userId: string): Promise<CheckoutSession> {
    const providerRef = `mock_${userId.slice(0, 8)}_${randomUUID().slice(0, 8)}`;
    return {
      checkoutUrl: `/app/abonament/checkout?ref=${encodeURIComponent(providerRef)}&plan=${encodeURIComponent(plan.plan)}&pret=${plan.price_lei}`,
      providerRef,
    };
  }

  verifyWebhook(payload: string, signature: string): WebhookEvent | null {
    const expected = signPayload(payload);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature ?? '', 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null; // semnătură INVALIDĂ
    try {
      const ev = JSON.parse(payload) as WebhookEvent;
      if (!ev.event_id || !ev.type || !ev.user_id || !ev.provider_ref) return null;
      if (!['payment_succeeded', 'payment_failed', 'subscription_canceled'].includes(ev.type)) return null;
      return ev;
    } catch {
      return null;
    }
  }

  async getSubscriptionStatus(): Promise<'active' | 'canceled' | 'unknown'> {
    return 'unknown'; // mock-ul nu ține stare proprie — adevărul e în DB
  }

  async cancelSubscription(): Promise<void> {
    // mock: anularea e doar tranziția din DB (applyWebhookEvent / cancel route)
  }
}
