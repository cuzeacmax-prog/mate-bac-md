import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chisinauToday, computeStreak } from '@/lib/daily/daily';

/**
 * ETAPA 78 FAZA B — push cu BUN-SIMȚ. Toate regulile într-un singur loc:
 *   - max 1 push/zi per user (orice tip);
 *   - ore de liniște 21:00–09:00 Chișinău pentru push-urile nesolicitate
 *     (streak); provocarea de dimineață (08:30) e OPT-IN explicit din setări,
 *     deci are propria fereastră 08:00–10:00;
 *   - fără abonament push sau cu preferința oprită → nimic;
 *   - fiecare trimitere (și fiecare endpoint mort) → notifications_log.
 */

export type PushDecision = { send: true } | { send: false; reason: string };

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

function vapidReady(): boolean {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
}
if (vapidReady()) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:contact@matebac.md',
    VAPID_PUBLIC!,
    VAPID_PRIVATE!
  );
}

export function chisinauHour(now: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Chisinau',
      hour: '2-digit',
      hour12: false,
    }).format(now),
    10
  );
}

/** orele de liniște: 21:00–09:00 Chișinău */
export function inQuietHours(now: Date): boolean {
  const h = chisinauHour(now);
  return h >= 21 || h < 9;
}

type Prefs = { streak_reminders?: boolean; daily_challenge?: boolean } | null;

async function readContext(svc: SupabaseClient, userId: string, now: Date) {
  const today = chisinauToday(now);
  const [subsRes, prefsRes, dailyRes, sentRes] = await Promise.all([
    svc.from('push_subscriptions').select('id, endpoint, keys').eq('user_id', userId),
    svc.from('user_profiles').select('notification_preferences').eq('id', userId).maybeSingle(),
    svc
      .from('daily_challenges')
      .select('completed')
      .eq('user_id', userId)
      .eq('challenge_date', today)
      .maybeSingle(),
    // max 1 push/zi: orice push deja trimis azi (Chișinău) blochează următorul
    svc
      .from('notifications_log')
      .select('id')
      .eq('user_id', userId)
      .eq('channel', 'push')
      .gte('sent_at', `${today}T00:00:00`)
      .limit(1),
  ]);
  return {
    today,
    subs: subsRes.data ?? [],
    prefs: (prefsRes.data?.notification_preferences ?? null) as Prefs,
    dailyCompleted: Boolean(dailyRes.data?.completed),
    pushSentToday: (sentRes.data ?? []).length > 0,
  };
}

/** STREAK ÎN PERICOL (seara): doar dacă daily-ul NU e făcut ȘI streak ≥ 2. */
export async function decideStreakPush(
  svc: SupabaseClient,
  userId: string,
  now: Date
): Promise<PushDecision> {
  const ctx = await readContext(svc, userId, now);
  if (ctx.subs.length === 0) return { send: false, reason: 'fara-abonament-push' };
  if (ctx.prefs?.streak_reminders === false) return { send: false, reason: 'preferinta-oprita' };
  if (inQuietHours(now)) return { send: false, reason: 'ore-de-liniste' };
  if (ctx.pushSentToday) return { send: false, reason: 'limita-1-pe-zi' };
  if (ctx.dailyCompleted) return { send: false, reason: 'daily-facut' };
  const streak = await computeStreak(svc, userId, ctx.today);
  if (streak < 2) return { send: false, reason: 'streak-sub-2-nimic-de-pierdut' };
  return { send: true };
}

/** PROVOCAREA E GATA (dimineața): DOAR opt-in explicit din setări. */
export async function decideProvocarePush(
  svc: SupabaseClient,
  userId: string,
  now: Date
): Promise<PushDecision> {
  const ctx = await readContext(svc, userId, now);
  if (ctx.subs.length === 0) return { send: false, reason: 'fara-abonament-push' };
  if (ctx.prefs?.daily_challenge !== true) return { send: false, reason: 'fara-opt-in' };
  // opt-in explicit pentru dimineață → fereastra proprie 08:00–10:00 Chișinău
  const h = chisinauHour(now);
  if (h < 8 || h >= 10) return { send: false, reason: 'in-afara-ferestrei-de-dimineata' };
  if (ctx.pushSentToday) return { send: false, reason: 'limita-1-pe-zi' };
  if (ctx.dailyCompleted) return { send: false, reason: 'daily-deja-facut' };
  return { send: true };
}

export type PushPayload = { title: string; body: string; url?: string };

/** trimite către toate abonamentele userului; endpoint-urile moarte se șterg; totul se loghează */
export async function sendPushToUser(
  svc: SupabaseClient,
  userId: string,
  type: string,
  payload: PushPayload
): Promise<{ delivered: number; dead: number }> {
  if (!vapidReady()) {
    await svc.from('notifications_log').insert({
      user_id: userId,
      notification_type: type,
      channel: 'push',
      metadata: { status: 'pending-no-vapid', payload },
    });
    return { delivered: 0, dead: 0 };
  }
  const { data: subs } = await svc
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('user_id', userId);
  let delivered = 0;
  let dead = 0;
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
        JSON.stringify({ ...payload, icon: '/icons/icon-192.png' })
      );
      delivered++;
      await svc
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', sub.id);
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        // abonament mort (browser dezinstalat etc.) → curățăm
        await svc.from('push_subscriptions').delete().eq('id', sub.id);
        dead++;
      } else {
        dead++;
      }
    }
  }
  await svc.from('notifications_log').insert({
    user_id: userId,
    notification_type: type,
    channel: 'push',
    metadata: { status: delivered > 0 ? 'trimis' : 'esuat-endpoint', delivered, dead, payload },
  });
  return { delivered, dead };
}

/** rulează cron-ul pe toți userii cu abonamente push; întoarce raportul */
export async function runPushCron(
  svc: SupabaseClient,
  kind: 'streak' | 'provocare',
  now: Date
): Promise<{ candidates: number; sent: number; skipped: Record<string, number> }> {
  const { data: rows } = await svc.from('push_subscriptions').select('user_id');
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))];
  const skipped: Record<string, number> = {};
  let sent = 0;
  for (const userId of userIds) {
    const decision =
      kind === 'streak'
        ? await decideStreakPush(svc, userId, now)
        : await decideProvocarePush(svc, userId, now);
    if (!decision.send) {
      skipped[decision.reason] = (skipped[decision.reason] ?? 0) + 1;
      continue;
    }
    const payload: PushPayload =
      kind === 'streak'
        ? {
            title: 'Streak-ul tău e în pericol 🔥',
            body: 'Daily-ul de azi te așteaptă — 5 minute și seria merge mai departe.',
            url: '/app/azi',
          }
        : {
            title: 'Provocarea zilei e gata',
            body: 'Trei exerciții alese pentru tine. Începe dimineața cu un punct câștigat.',
            url: '/app/azi',
          };
    const res = await sendPushToUser(svc, userId, `push-${kind}`, payload);
    if (res.delivered > 0) sent++;
  }
  return { candidates: userIds.length, sent, skipped };
}
