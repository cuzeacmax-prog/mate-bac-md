-- ETAPA 71 E2 (completare): event_type primește valorile mașinii de stări noi
-- (coloana e jurnal; starea curentă trăiește în status).
alter table subscriptions drop constraint if exists subscriptions_event_type_check;
alter table subscriptions add constraint subscriptions_event_type_check
  check (event_type in (
    'started', 'renewed', 'upgraded', 'downgraded', 'cancelled', 'expired', 'refunded',
    'trial_started', 'payment_succeeded', 'payment_failed', 'cancel_requested',
    'auto_canceled', 'auto_past_due'
  ));
