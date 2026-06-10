/**
 * ETAPA 71 FAZA E — ACCEPTANȚĂ: ciclul de plată COMPLET pe mock.
 *
 * trial→subscribe→active (webhook semnat) → fail→past_due (premium în grație)
 * → retry→active → cancel→activ-până-la-final → perioadă încheiată→canceled/free
 * → grația past_due depășită→free. Semnătură INVALIDĂ respinsă; același event
 * de 2 ori = idempotent (o singură tranziție). Assert pe FIECARE stare în DB.
 * ACELEAȘI funcții ca rutele (applyWebhookEvent / refreshSubscription / MockProvider).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa71-payments-acceptance.ts
 */
import { randomUUID } from 'node:crypto';
import { createServiceClient } from '../../src/lib/supabase/service';
import { MockProvider, signPayload } from '../../src/lib/payments/mock';
import { applyWebhookEvent, refreshSubscription, startTrial, getSubscription, getPlanConfig } from '../../src/lib/payments/state';
import type { WebhookEvent } from '../../src/lib/payments/provider';

const EMAIL = 'etapa60-acceptance@test.local';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const provider = new MockProvider();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  console.log(`user de audit: ${user.id}`);

  const profileStatus = async (): Promise<string> => {
    const { data } = await svc.from('profiles').select('subscription_status').eq('id', user.id).maybeSingle();
    return (data?.subscription_status as string | null) ?? 'free';
  };
  const assertState = async (
    label: string,
    expect: { status?: string; profile?: string; cancelAtEnd?: boolean }
  ) => {
    const sub = await getSubscription(svc, user.id);
    const prof = await profileStatus();
    const status = sub?.status ?? '(fără)';
    console.log(`  [${label}] subscriptions.status=${status} cancel_at_end=${sub?.cancel_at_period_end ?? '-'} profiles=${prof}`);
    if (expect.status && status !== expect.status) fail(`${label}: status ${status} ≠ ${expect.status}`);
    if (expect.profile && prof !== expect.profile) fail(`${label}: profil ${prof} ≠ ${expect.profile}`);
    if (expect.cancelAtEnd !== undefined && sub?.cancel_at_period_end !== expect.cancelAtEnd) fail(`${label}: cancel_at_period_end greșit`);
  };
  const sendEvent = (type: WebhookEvent['type'], ref: string, eventId?: string) => {
    const event: WebhookEvent = {
      event_id: eventId ?? `evt_${randomUUID()}`,
      type,
      provider_ref: ref,
      user_id: user.id,
      plan: 'premium',
      amount_lei: 199,
      ...(type === 'payment_failed' ? { failure_reason: 'test: card refuzat' } : {}),
    };
    const payload = JSON.stringify(event);
    const verified = provider.verifyWebhook(payload, signPayload(payload));
    if (!verified) fail('semnarea internă a eșuat');
    return { event, verified };
  };

  // ── reset: stare curată pe userul de audit (nimic real aici) ──────────────
  await svc.from('payment_attempts').delete().eq('user_id', user.id);
  await svc.from('subscriptions').delete().eq('user_id', user.id);
  await svc.from('profiles').update({ subscription_status: 'free' }).eq('id', user.id);
  await svc.from('user_profiles').update({ trial_started_at: null, trial_used: false }).eq('id', user.id);

  // ── 1) trialul din onboarding → trialing + premium ─────────────────────────
  await startTrial(svc, user.id);
  await assertState('trial pornit', { status: 'trialing', profile: 'premium' });

  // ── 2) subscribe: webhook semnat → active ──────────────────────────────────
  const checkout = await provider.createCheckout(await getPlanConfig(svc), user.id);
  const { verified: okEvent, event: okRaw } = sendEvent('payment_succeeded', checkout.providerRef);
  const r1 = await applyWebhookEvent(svc, okEvent);
  if (!r1.applied || r1.status !== 'active') fail('subscribe nu a activat');
  await assertState('plată reușită', { status: 'active', profile: 'premium', cancelAtEnd: false });

  // ── 3) semnătură INVALIDĂ → respins ────────────────────────────────────────
  const tampered = provider.verifyWebhook(JSON.stringify(okRaw), 'semnatura-falsa');
  if (tampered !== null) fail('semnătura invalidă a fost ACCEPTATĂ');
  console.log('  [semnătură falsă] respinsă ✓');

  // ── 4) același event de 2 ori → idempotent ────────────────────────────────
  const r2 = await applyWebhookEvent(svc, okEvent);
  if (!r2.idempotent) fail('duplicatul NU a fost idempotent');
  const { count: attemptsAfterDup } = await svc
    .from('payment_attempts').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('event_id', okRaw.event_id);
  if (attemptsAfterDup !== 1) fail(`duplicatul a creat ${attemptsAfterDup} rânduri`);
  console.log('  [duplicat] idempotent — o singură încercare persistată ✓');

  // ── 5) plată eșuată → past_due, premium în grație ─────────────────────────
  const { verified: failEvent } = sendEvent('payment_failed', checkout.providerRef);
  const r3 = await applyWebhookEvent(svc, failEvent);
  if (r3.status !== 'past_due') fail('eșecul nu a dus în past_due');
  await assertState('plată eșuată', { status: 'past_due', profile: 'premium' });

  // ── 6) reîncercare reușită → active ───────────────────────────────────────
  const { verified: retryEvent } = sendEvent('payment_succeeded', checkout.providerRef);
  await applyWebhookEvent(svc, retryEvent);
  await assertState('retry reușit', { status: 'active', profile: 'premium' });

  // ── 7) anulare → activ până la finalul perioadei ──────────────────────────
  const { verified: cancelEvent } = sendEvent('subscription_canceled', checkout.providerRef);
  await applyWebhookEvent(svc, cancelEvent);
  await assertState('anulare cerută', { status: 'active', profile: 'premium', cancelAtEnd: true });

  // ── 8) perioada se încheie → canceled + free (nimic șters) ────────────────
  await svc.from('subscriptions')
    .update({ current_period_end: new Date(Date.now() - 3600_000).toISOString() })
    .eq('user_id', user.id);
  await refreshSubscription(svc, user.id);
  await assertState('perioadă încheiată', { status: 'canceled', profile: 'free' });
  const { count: historyCount } = await svc
    .from('payment_attempts').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((historyCount ?? 0) < 4) fail('istoricul plăților s-a pierdut');
  console.log(`  [istoric] ${historyCount} încercări păstrate ✓`);

  // ── 9) grația past_due depășită → free ────────────────────────────────────
  const old = new Date(Date.now() - 9 * 86_400_000).toISOString();
  await svc.from('subscriptions')
    .update({ status: 'past_due', updated_at: old, current_period_end: new Date(Date.now() + 86_400_000).toISOString() })
    .eq('user_id', user.id);
  await svc.from('profiles').update({ subscription_status: 'premium' }).eq('id', user.id);
  await refreshSubscription(svc, user.id);
  await assertState('grație depășită', { status: 'canceled', profile: 'free' });

  console.log('\n✅ ETAPA 71 FAZA E acceptată: ciclul complet trial→active→past_due→retry→cancel→expirat→free, semnătura falsă respinsă, idempotență dovedită, istoric păstrat.');
}
main().catch((e) => { console.error(e); process.exit(1); });
