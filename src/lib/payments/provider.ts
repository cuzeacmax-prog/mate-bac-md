/**
 * provider.ts — ETAPA 71 E1: interfața PaymentProvider.
 *
 * Providerul real (Hub.md / MAIB) va fi DOAR un adaptor nou pe ACEEAȘI
 * interfață, când vin credențialele — nimic din fluxuri nu se rescrie.
 * Selectarea: env PAYMENT_PROVIDER (default 'mock').
 */
import { MockProvider } from './mock';

export interface PlanConfig {
  plan: string;
  price_lei: number;
  period_days: number;
  trial_days: number;
  past_due_grace_days: number;
}

export interface CheckoutSession {
  /** URL-ul către pagina de plată a providerului (mock: pagina internă) */
  checkoutUrl: string;
  providerRef: string;
}

export type WebhookEventType = 'payment_succeeded' | 'payment_failed' | 'subscription_canceled';

export interface WebhookEvent {
  event_id: string;
  type: WebhookEventType;
  provider_ref: string;
  user_id: string;
  plan: string;
  amount_lei: number;
  failure_reason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(plan: PlanConfig, userId: string): Promise<CheckoutSession>;
  /** null = semnătură INVALIDĂ sau payload corupt — webhook-ul se respinge */
  verifyWebhook(payload: string, signature: string): WebhookEvent | null;
  getSubscriptionStatus(providerRef: string): Promise<'active' | 'canceled' | 'unknown'>;
  cancelSubscription(providerRef: string): Promise<void>;
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  const name = process.env.PAYMENT_PROVIDER ?? 'mock';
  if (name !== 'mock') {
    // adaptorul real se montează aici când există credențiale
    console.error(`[payments] provider necunoscut '${name}' — folosesc mock`);
  }
  provider = new MockProvider();
  return provider;
}
