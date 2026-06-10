/**
 * state.ts — ETAPA 71 E2-E4: mașina de stări a abonamentului.
 *
 * UN SINGUR ADEVĂR al tier-ului: tabelul subscriptions. profiles.subscription_status
 * (citit de rate-limit, cost-guard, chat) e SINCRONIZAT de aici — syncProfileTier
 * e SINGURUL scriitor (statusul 'admin' nu e atins niciodată).
 *
 * Stări: trialing → active → past_due → (retry ok → active | grație depășită →
 * canceled/free). Anulare: cancel_at_period_end → activ până la final → canceled.
 * Nimic nu se șterge — doar tranziții + istoric în payment_attempts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanConfig, WebhookEvent } from './provider';

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  current_period_start: string | null;
  current_period_end: string | null;
  provider_ref: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
}

const DEFAULT_PLAN: PlanConfig = {
  plan: 'premium', price_lei: 199, period_days: 30, trial_days: 7, past_due_grace_days: 7,
};

/** planul din system_config (nu hardcodat); fallback documentat */
export async function getPlanConfig(service: SupabaseClient): Promise<PlanConfig> {
  const { data } = await service
    .from('system_config').select('value').eq('key', 'payments.plan_premium').maybeSingle();
  const v = (data?.value as Partial<PlanConfig> | null) ?? {};
  return { ...DEFAULT_PLAN, ...v, plan: 'premium' };
}

/** SINGURUL scriitor al profiles.subscription_status (în afara adminului) */
async function syncProfileTier(service: SupabaseClient, userId: string, premium: boolean): Promise<void> {
  const { data: prof } = await service
    .from('profiles').select('subscription_status').eq('id', userId).maybeSingle();
  const current = (prof?.subscription_status as string | null) ?? 'free';
  if (current === 'admin') return; // adminul nu e atins
  const next = premium ? 'premium' : 'free';
  if (current === next) return;
  const { error } = await service.from('profiles').update({ subscription_status: next }).eq('id', userId);
  if (error) console.error('[payments] profile sync failed:', error.message);
}

function isPremiumStatus(sub: SubscriptionRow, plan: PlanConfig, now: Date): boolean {
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
  if (sub.status === 'trialing') return !!end && end > now;
  if (sub.status === 'active') return !!end && end > now;
  if (sub.status === 'past_due') {
    // grația: politicos premium încă N zile, apoi downgrade
    const since = new Date(sub.updated_at);
    return now.getTime() - since.getTime() < plan.past_due_grace_days * 86_400_000;
  }
  return false;
}

export async function getSubscription(service: SupabaseClient, userId: string): Promise<SubscriptionRow | null> {
  const { data } = await service.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

/** leagă trialul de onboarding de subscriptions (status trialing cu expirare) */
export async function startTrial(service: SupabaseClient, userId: string): Promise<void> {
  const plan = await getPlanConfig(service);
  const existing = await getSubscription(service, userId);
  if (existing) return; // are deja istoric — trialul nu se re-acordă
  const now = new Date();
  const end = new Date(now.getTime() + plan.trial_days * 86_400_000);
  const { error } = await service.from('subscriptions').insert({
    user_id: userId,
    tier: plan.plan,
    event_type: 'trial_started',
    amount_lei: 0,
    duration_days: plan.trial_days,
    payment_provider: 'mock',
    plan: plan.plan,
    status: 'trialing',
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
    updated_at: now.toISOString(),
  });
  if (error) {
    console.error('[payments] trial insert failed:', error.message);
    return;
  }
  await service.from('user_profiles')
    .update({ trial_started_at: now.toISOString(), trial_used: true })
    .eq('id', userId);
  await syncProfileTier(service, userId, true);
}

/**
 * Aplica un eveniment de webhook VERIFICAT. Idempotent pe event_id
 * (insert în payment_attempts cu unique — duplicatul nu mai tranziționează).
 */
export async function applyWebhookEvent(
  service: SupabaseClient,
  event: WebhookEvent
): Promise<{ applied: boolean; idempotent: boolean; status?: SubscriptionRow['status'] }> {
  const plan = await getPlanConfig(service);

  // idempotența: încercarea se scrie PRIMA; duplicat → nicio tranziție
  const { error: attErr } = await service.from('payment_attempts').insert({
    user_id: event.user_id,
    plan_tier: event.plan,
    amount_lei: event.amount_lei,
    payment_provider: 'mock',
    status: event.type === 'payment_succeeded' ? 'success' : event.type === 'payment_failed' ? 'failed' : 'cancelled',
    provider_payment_id: event.provider_ref,
    failure_reason: event.failure_reason ?? null,
    event_id: event.event_id,
    completed_at: new Date().toISOString(),
  });
  if (attErr) {
    if (attErr.code === '23505') return { applied: false, idempotent: true }; // duplicat
    console.error('[payments] attempt insert failed:', attErr.message);
    return { applied: false, idempotent: false };
  }

  const now = new Date();
  const sub = await getSubscription(service, event.user_id);

  if (event.type === 'payment_succeeded') {
    const end = new Date(now.getTime() + plan.period_days * 86_400_000);
    const fields = {
      plan: plan.plan,
      status: 'active' as const,
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
      provider_ref: event.provider_ref,
      cancel_at_period_end: false,
      updated_at: now.toISOString(),
      tier: plan.plan,
      event_type: 'payment_succeeded',
      amount_lei: event.amount_lei,
      duration_days: plan.period_days,
      payment_provider: 'mock',
    };
    const { error } = sub
      ? await service.from('subscriptions').update(fields).eq('user_id', event.user_id)
      : await service.from('subscriptions').insert({ user_id: event.user_id, ...fields });
    if (error) {
      console.error('[payments] activate failed:', error.message);
      return { applied: false, idempotent: false };
    }
    await syncProfileTier(service, event.user_id, true);
    return { applied: true, idempotent: false, status: 'active' };
  }

  if (event.type === 'payment_failed') {
    if (!sub) return { applied: false, idempotent: false }; // eșec fără abonament: doar istoric
    const { error } = await service.from('subscriptions')
      .update({ status: 'past_due', updated_at: now.toISOString(), event_type: 'payment_failed' })
      .eq('user_id', event.user_id);
    if (error) console.error('[payments] past_due failed:', error.message);
    // în grație rămâne premium (politicos); refreshSubscription face downgrade-ul
    await syncProfileTier(service, event.user_id, isPremiumStatus({ ...sub, status: 'past_due', updated_at: now.toISOString() }, plan, now));
    return { applied: true, idempotent: false, status: 'past_due' };
  }

  // subscription_canceled: activ până la finalul perioadei
  if (!sub) return { applied: false, idempotent: false };
  const { error } = await service.from('subscriptions')
    .update({ cancel_at_period_end: true, updated_at: now.toISOString(), event_type: 'cancel_requested' })
    .eq('user_id', event.user_id);
  if (error) console.error('[payments] cancel failed:', error.message);
  return { applied: true, idempotent: false, status: sub.status };
}

/**
 * Reconciliază starea cu timpul (apelat la citirea paginii): trial expirat,
 * perioadă încheiată, grația past_due depășită → canceled + profil free.
 * NIMIC nu se șterge.
 */
export async function refreshSubscription(
  service: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const sub = await getSubscription(service, userId);
  if (!sub) return null;
  const plan = await getPlanConfig(service);
  const now = new Date();
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null;

  let nextStatus: SubscriptionRow['status'] | null = null;
  if (sub.status === 'trialing' && end && end <= now) nextStatus = 'canceled';
  if (sub.status === 'active' && end && end <= now) {
    // mock-ul nu re-facturează singur: perioada încheiată = canceled dacă s-a
    // cerut anularea, altfel past_due (așteaptă reîncercarea de plată)
    nextStatus = sub.cancel_at_period_end ? 'canceled' : 'past_due';
  }
  if (sub.status === 'past_due' && now.getTime() - new Date(sub.updated_at).getTime() >= plan.past_due_grace_days * 86_400_000) {
    nextStatus = 'canceled';
  }

  let fresh = sub;
  if (nextStatus && nextStatus !== sub.status) {
    const { error } = await service.from('subscriptions')
      .update({ status: nextStatus, updated_at: now.toISOString(), event_type: `auto_${nextStatus}` })
      .eq('user_id', userId);
    if (error) console.error('[payments] refresh failed:', error.message);
    else fresh = { ...sub, status: nextStatus, updated_at: now.toISOString() };
  }
  await syncProfileTier(service, userId, isPremiumStatus(fresh, plan, now));
  return fresh;
}
