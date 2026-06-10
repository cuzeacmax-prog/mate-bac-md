-- ETAPA 71 E2: subscriptions devine STAREA abonamentului (un rând per user);
-- payment_attempts primește event_id unic (idempotența webhook-ului).
-- UN SINGUR ADEVĂR al tier-ului: subscriptions; profiles.subscription_status
-- e sincronizat DIN subscriptions (singurul scriitor: lib/payments/state.ts).

alter table subscriptions
  add column if not exists plan text not null default 'premium',
  add column if not exists status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled')),
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists provider_ref text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists subscriptions_user_unique on subscriptions(user_id);

alter table payment_attempts
  add column if not exists event_id text;
create unique index if not exists payment_attempts_event_unique
  on payment_attempts(event_id) where event_id is not null;

-- planul: config în DB, nu hardcodat
insert into system_config (key, value, description)
select 'payments.plan_premium',
       '{"price_lei": 199, "period_days": 30, "trial_days": 7, "past_due_grace_days": 7}'::jsonb,
       'ETAPA 71: planul Premium — preț/lună, perioada, trialul, grația past_due'
where not exists (select 1 from system_config where key = 'payments.plan_premium');
