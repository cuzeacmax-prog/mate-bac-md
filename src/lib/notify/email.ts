import { createHmac } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * ETAPA 78 FAZA C — emailuri prin Resend, cu aceeași filozofie ca push-ul:
 * servitori, nu spam.
 *
 * GARDA: fără RESEND_API_KEY → fiecare trimitere se scrie în notifications_log
 * cu metadata.status = 'pending-no-key' și NIMIC nu crapă (Maxim conectează
 * domeniul zilele astea; logul arată exact ce s-ar fi trimis).
 *
 * Opt-out: notification_preferences.email = false oprește emailurile de
 * re-angajare (streak rupt, raport săptămânal). Emailurile de CONT (bun venit,
 * trial expiră, plată restantă) se trimit oricum — sunt informații despre
 * contul lui, nu marketing — dar poartă și ele linkul de dezabonare în footer.
 */

const RESEND_URL = 'https://api.resend.com/emails';

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? 'Profesor Maxim <noreply@profesormaxim.md>';
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

// ── dezabonarea: token HMAC, fără login (un click din orice client de email) ──
function unsubSecret(): string {
  // derivat din CRON_SECRET (deja în env); prefixul separă domeniul de utilizare
  return `unsub:${process.env.CRON_SECRET ?? 'dev-only'}`;
}

export function unsubscribeToken(userId: string): string {
  return createHmac('sha256', unsubSecret()).update(userId).digest('hex').slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  return unsubscribeToken(userId) === token;
}

export function unsubscribeUrl(userId: string): string {
  return `${appUrl()}/api/email/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;
}

// ── reguli ────────────────────────────────────────────────────────────────────
export async function emailOptedOut(svc: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await svc
    .from('user_profiles')
    .select('notification_preferences')
    .eq('id', userId)
    .maybeSingle();
  const prefs = (data?.notification_preferences ?? {}) as { email?: boolean };
  return prefs.email === false;
}

/** același tip de email nu pleacă de două ori în fereastra dată (zile) */
export async function sentRecently(
  svc: SupabaseClient,
  userId: string,
  type: string,
  days: number
): Promise<boolean> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await svc
    .from('notifications_log')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_type', type)
    .eq('channel', 'email')
    .gte('sent_at', since)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function sentEver(svc: SupabaseClient, userId: string, type: string): Promise<boolean> {
  const { data } = await svc
    .from('notifications_log')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_type', type)
    .eq('channel', 'email')
    .limit(1);
  return (data ?? []).length > 0;
}

// ── trimiterea ────────────────────────────────────────────────────────────────
export type EmailSendResult = { status: 'trimis' | 'pending-no-key' | 'esuat'; detail?: string };

export async function sendEmail(
  svc: SupabaseClient,
  args: { userId: string; type: string; to: string; subject: string; html: string }
): Promise<EmailSendResult> {
  const { userId, type, to, subject, html } = args;

  if (!emailEnabled()) {
    await svc.from('notifications_log').insert({
      user_id: userId,
      notification_type: type,
      channel: 'email',
      metadata: { status: 'pending-no-key', to, subject },
    });
    return { status: 'pending-no-key' };
  }

  let result: EmailSendResult;
  try {
    const resp = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, html }),
    });
    if (resp.ok) {
      const data = (await resp.json().catch(() => ({}))) as { id?: string };
      result = { status: 'trimis', detail: data.id };
    } else {
      const body = await resp.text().catch(() => '');
      result = { status: 'esuat', detail: `HTTP ${resp.status}: ${body.slice(0, 300)}` };
    }
  } catch (err) {
    result = { status: 'esuat', detail: err instanceof Error ? err.message : String(err) };
  }

  await svc.from('notifications_log').insert({
    user_id: userId,
    notification_type: type,
    channel: 'email',
    metadata: { status: result.status, to, subject, detail: result.detail ?? null },
  });
  return result;
}
