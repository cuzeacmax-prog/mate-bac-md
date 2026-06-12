import type { SupabaseClient } from '@supabase/supabase-js';
import { chisinauToday, computeStreak } from '@/lib/daily/daily';
import { emailOptedOut, sendEmail, sentEver, sentRecently } from './email';
import {
  emailBunVenit,
  emailPlataRestanta,
  emailRaportSaptamanal,
  emailStreakRupt,
  emailTrialExpira,
  type WeeklyData,
} from './email-templates';

/**
 * ETAPA 78 C1 — orchestrarea emailurilor. Un singur cron zilnic (seara,
 * Chișinău) acoperă tot: streak rupt (a doua zi după întrerupere), trialul
 * expiră (cu ~2 zile înainte), plata restantă (past_due), iar DUMINICA și
 * raportul săptămânal (elev + părinte când există email separat).
 * Toate cifrele raportului vin din date reale — zero înfrumusețare.
 */

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  parent_email: string | null;
  grade_level: number | null;
};

function dayOffset(today: string, offset: number): string {
  const t = Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function isChisinauSunday(now: Date): boolean {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Chisinau', weekday: 'short' }).format(now) === 'Sun'
  );
}

// ── BUN VENIT (apelat din /auth/callback, idempotent pe viață) ───────────────
export async function sendWelcomeOnce(svc: SupabaseClient, userId: string): Promise<boolean> {
  if (await sentEver(svc, userId, 'email-bun-venit')) return false;
  const { data: prof } = await svc
    .from('user_profiles')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (!prof?.email) return false;
  const t = emailBunVenit(userId, prof.full_name);
  await sendEmail(svc, { userId, type: 'email-bun-venit', to: prof.email, ...t });
  return true;
}

// ── RAPORTUL SĂPTĂMÂNAL: numai date reale ────────────────────────────────────
export async function gatherWeeklyData(
  svc: SupabaseClient,
  userId: string,
  grade: number,
  now: Date
): Promise<WeeklyData> {
  const weekStart = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const today = chisinauToday(now);

  const [lessonsRes, attemptsRes, conceptsRes, frontierRes, streak] = await Promise.all([
    svc
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', weekStart)
      .like('title', 'Lecție:%'),
    svc
      .from('exercise_attempts')
      .select('is_correct')
      .eq('user_id', userId)
      .gte('attempted_at', weekStart),
    svc
      .from('concept_mastery')
      .select('mastery, concepts(name)')
      .eq('user_id', userId)
      .gte('last_evidence_at', weekStart)
      .order('mastery', { ascending: false })
      .limit(3),
    svc.rpc('frontier_concepts', { p_user_id: userId, p_grade: grade, p_limit: 3 }),
    computeStreak(svc, userId, today),
  ]);

  const attempts = attemptsRes.data ?? [];
  const conceptNames = (conceptsRes.data ?? [])
    .map((r) => (r.concepts as unknown as { name: string } | null)?.name)
    .filter((n): n is string => Boolean(n));
  const frontier = (frontierRes.data ?? []) as Array<{ name: string }>;

  return {
    lessons: lessonsRes.count ?? 0,
    attempts: attempts.length,
    correct: attempts.filter((a) => a.is_correct === true).length,
    streak,
    concepts: conceptNames,
    nextConcept: frontier[0]?.name ?? null,
  };
}

// ── STREAK RUPT: ieri lipsă, alaltăieri prezent, seria pierdută ≥ 2 ──────────
export async function lostStreakLength(
  svc: SupabaseClient,
  userId: string,
  today: string
): Promise<number> {
  const { data } = await svc
    .from('streak_log')
    .select('activity_date')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false })
    .limit(400);
  const days = new Set((data ?? []).map((r) => r.activity_date as string));
  const yesterday = dayOffset(today, -1);
  if (days.has(yesterday) || days.has(today)) return 0; // seria nu e ruptă
  let cursor = dayOffset(today, -2);
  let len = 0;
  while (days.has(cursor)) {
    len++;
    cursor = dayOffset(cursor, -1);
  }
  return len;
}

// ── cron-ul zilnic ───────────────────────────────────────────────────────────
export interface EmailCronReport {
  streakRupt: number;
  trialExpira: number;
  plataRestanta: number;
  raportSaptamanal: number;
  raportParinte: number;
  skipped: Record<string, number>;
}

export async function runEmailCron(svc: SupabaseClient, now: Date): Promise<EmailCronReport> {
  const today = chisinauToday(now);
  const report: EmailCronReport = {
    streakRupt: 0,
    trialExpira: 0,
    plataRestanta: 0,
    raportSaptamanal: 0,
    raportParinte: 0,
    skipped: {},
  };
  const skip = (reason: string) => {
    report.skipped[reason] = (report.skipped[reason] ?? 0) + 1;
  };

  const profileById = new Map<string, ProfileRow>();
  const loadProfiles = async (ids: string[]) => {
    const missing = ids.filter((id) => !profileById.has(id));
    if (missing.length === 0) return;
    const { data } = await svc
      .from('user_profiles')
      .select('id, email, full_name, parent_email, grade_level')
      .in('id', missing);
    for (const p of (data ?? []) as ProfileRow[]) profileById.set(p.id, p);
  };

  // 1) STREAK RUPT — candidați: activi alaltăieri, fără activitate ieri
  const { data: d2rows } = await svc
    .from('streak_log')
    .select('user_id')
    .eq('activity_date', dayOffset(today, -2));
  const { data: d1rows } = await svc
    .from('streak_log')
    .select('user_id')
    .eq('activity_date', dayOffset(today, -1));
  const activeYesterday = new Set((d1rows ?? []).map((r) => r.user_id as string));
  const candidates = [...new Set((d2rows ?? []).map((r) => r.user_id as string))].filter(
    (id) => !activeYesterday.has(id)
  );
  await loadProfiles(candidates);
  for (const userId of candidates) {
    const prof = profileById.get(userId);
    if (!prof?.email) { skip('streak-rupt:fara-email'); continue; }
    if (await emailOptedOut(svc, userId)) { skip('streak-rupt:opt-out'); continue; }
    if (await sentRecently(svc, userId, 'email-streak-rupt', 3)) { skip('streak-rupt:trimis-recent'); continue; }
    const lost = await lostStreakLength(svc, userId, today);
    if (lost < 2) { skip('streak-rupt:serie-sub-2'); continue; }
    const t = emailStreakRupt(userId, prof.full_name, lost);
    await sendEmail(svc, { userId, type: 'email-streak-rupt', to: prof.email, ...t });
    report.streakRupt++;
  }

  // 2) TRIALUL EXPIRĂ (≤2 zile) + PLATA RESTANTĂ — din mașina de stări (ETAPA 71)
  const { data: subs } = await svc
    .from('subscriptions')
    .select('user_id, status, current_period_end')
    .in('status', ['trialing', 'past_due']);
  await loadProfiles([...new Set((subs ?? []).map((s) => s.user_id as string))]);
  for (const sub of subs ?? []) {
    const userId = sub.user_id as string;
    const prof = profileById.get(userId);
    if (!prof?.email) { skip('abonament:fara-email'); continue; }

    if (sub.status === 'trialing' && sub.current_period_end) {
      const msLeft = new Date(sub.current_period_end as string).getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / 86_400_000);
      if (daysLeft < 1 || daysLeft > 2) { skip('trial:nu-e-fereastra'); continue; }
      if (await sentRecently(svc, userId, 'email-trial-expira', 7)) { skip('trial:trimis-recent'); continue; }
      const endDate = new Intl.DateTimeFormat('ro-RO', {
        timeZone: 'Europe/Chisinau', day: 'numeric', month: 'long',
      }).format(new Date(sub.current_period_end as string));
      const t = emailTrialExpira(userId, prof.full_name, daysLeft, endDate);
      await sendEmail(svc, { userId, type: 'email-trial-expira', to: prof.email, ...t });
      report.trialExpira++;
    }

    if (sub.status === 'past_due') {
      if (await sentRecently(svc, userId, 'email-plata-restanta', 7)) { skip('past-due:trimis-recent'); continue; }
      const t = emailPlataRestanta(userId, prof.full_name);
      await sendEmail(svc, { userId, type: 'email-plata-restanta', to: prof.email, ...t });
      report.plataRestanta++;
    }
  }

  // 3) RAPORTUL SĂPTĂMÂNAL — doar duminica (Chișinău)
  if (isChisinauSunday(now)) {
    const { data: users } = await svc
      .from('user_profiles')
      .select('id, email, full_name, parent_email, grade_level')
      .not('email', 'is', null);
    for (const prof of (users ?? []) as ProfileRow[]) {
      if (!prof.email) continue;
      if (await emailOptedOut(svc, prof.id)) { skip('raport:opt-out'); continue; }
      if (await sentRecently(svc, prof.id, 'email-raport-saptamanal', 3)) { skip('raport:trimis-recent'); continue; }
      const data = await gatherWeeklyData(svc, prof.id, prof.grade_level ?? 12, now);
      const t = emailRaportSaptamanal(prof.id, prof.full_name, data);
      await sendEmail(svc, { userId: prof.id, type: 'email-raport-saptamanal', to: prof.email, ...t });
      report.raportSaptamanal++;
      if (prof.parent_email && prof.parent_email !== prof.email) {
        const tp = emailRaportSaptamanal(prof.id, prof.full_name, data, { forParent: true });
        await sendEmail(svc, { userId: prof.id, type: 'email-raport-parinte', to: prof.parent_email, ...tp });
        report.raportParinte++;
      }
    }
  }

  return report;
}
