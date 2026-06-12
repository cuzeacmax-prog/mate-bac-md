/**
 * ETAPA 78 C2 — ACCEPTANȚĂ EMAIL:
 *   1. fiecare template randat cu DATELE REALE ale userului de audit →
 *      HTML-urile persistate în docs/email-preview/ pentru ochii lui Maxim;
 *   2. GARDA fără RESEND_API_KEY: trimiterea se loghează 'pending-no-key'
 *      și nimic nu crapă;
 *   3. dedupe: același tip nu pleacă de două ori în fereastră;
 *   4. dezabonarea: tokenul HMAC valid trece, cel falsificat nu; opt-out
 *      blochează emailurile de re-angajare;
 *   5. cu cheia prezentă: trimitere reală de test către Maxim.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa78-email-acceptance.ts
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createServiceClient } from '../../src/lib/supabase/service';
import {
  emailEnabled,
  emailOptedOut,
  sendEmail,
  sentRecently,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from '../../src/lib/notify/email';
import {
  emailBunVenit,
  emailPlataRestanta,
  emailRaportSaptamanal,
  emailStreakRupt,
  emailTrialExpira,
} from '../../src/lib/notify/email-templates';
import { gatherWeeklyData, lostStreakLength } from '../../src/lib/notify/email-cron';
import { chisinauToday } from '../../src/lib/daily/daily';

const EMAIL = 'etapa60-acceptance@test.local';
const MAXIM = 'cuzeacmax@gmail.com';
const OUT = join(process.cwd(), 'docs', 'email-preview');

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  const uid = user.id;
  await svc.from('user_profiles').upsert({ id: uid, email: EMAIL }, { onConflict: 'id' });

  const today = chisinauToday();
  const now = new Date();

  // ── 1. template-urile, randate cu datele REALE ale userului de audit ────────
  console.log('C2.1 — randare cu date reale:');
  const weekly = await gatherWeeklyData(svc, uid, 12, now);
  console.log(`  date reale: lecții=${weekly.lessons}, încercate=${weekly.attempts}, corecte=${weekly.correct}, streak=${weekly.streak}, concepte=[${weekly.concepts.join(', ')}], next=${weekly.nextConcept}`);

  const emptyWeekly = { lessons: 0, attempts: 0, correct: 0, streak: 0, concepts: [], nextConcept: null };
  const previews: Array<[string, { subject: string; html: string }]> = [
    ['bun-venit', emailBunVenit(uid, 'Elev de Audit')],
    ['streak-rupt', emailStreakRupt(uid, 'Elev de Audit', 5)],
    ['raport-saptamanal', emailRaportSaptamanal(uid, 'Elev de Audit', weekly)],
    ['raport-saptamanal-parinte', emailRaportSaptamanal(uid, 'Elev de Audit', weekly, { forParent: true })],
    ['raport-reangajare', emailRaportSaptamanal(uid, 'Elev de Audit', emptyWeekly)],
    ['trial-expira', emailTrialExpira(uid, 'Elev de Audit', 2, '14 iunie')],
    ['plata-restanta', emailPlataRestanta(uid, 'Elev de Audit')],
  ];
  mkdirSync(OUT, { recursive: true });
  for (const [name, t] of previews) {
    const diacritice = /[ăâîșț]/i.test(t.html);
    const unsub = t.html.includes('/api/email/unsubscribe?u=');
    if (!diacritice) fail(`${name}: fără diacritice românești`);
    if (!unsub) fail(`${name}: footerul de dezabonare LIPSEȘTE (obligatoriu)`);
    writeFileSync(join(OUT, `${name}.html`), t.html, 'utf8');
    console.log(`  ✓ ${name}.html (subiect: "${t.subject}", diacritice ✓, unsubscribe ✓)`);
  }

  // ── 2. GARDA pending-no-key / trimiterea reală ──────────────────────────────
  await svc.from('notifications_log').delete().eq('user_id', uid).eq('channel', 'email');
  const keyPresent = emailEnabled();
  console.log(`C2.2 — garda (RESEND_API_KEY ${keyPresent ? 'PREZENTĂ' : 'absentă'}):`);
  const t1 = emailBunVenit(uid, 'Elev de Audit');
  const r1 = await sendEmail(svc, { userId: uid, type: 'email-bun-venit', to: keyPresent ? MAXIM : EMAIL, ...t1 });
  const expected = keyPresent ? 'trimis' : 'pending-no-key';
  if (r1.status !== expected) fail(`așteptat status '${expected}', primit '${r1.status}' (${r1.detail ?? ''})`);
  const { data: logRows } = await svc
    .from('notifications_log')
    .select('notification_type, metadata')
    .eq('user_id', uid)
    .eq('channel', 'email');
  if (!logRows || logRows.length !== 1) fail(`trimiterea trebuia logată exact o dată (găsit ${logRows?.length ?? 0})`);
  const meta = logRows[0].metadata as { status: string; to: string };
  if (meta.status !== expected) fail(`logul trebuia să poarte status '${expected}', are '${meta.status}'`);
  console.log(`  ✓ trimiterea → notifications_log (status: ${meta.status}, to: ${meta.to})${keyPresent ? ' — VERIFICĂ INBOXUL' : ' — nimic nu a crăpat'}`);

  // ── 3. dedupe pe tip ────────────────────────────────────────────────────────
  if (!(await sentRecently(svc, uid, 'email-bun-venit', 1))) fail('dedupe: emailul tocmai trimis nu e văzut de sentRecently');
  if (await sentRecently(svc, uid, 'email-raport-saptamanal', 3)) fail('dedupe: tip netrimis raportat ca trimis');
  console.log('  ✓ dedupe per tip funcționează (trimis=da, netrimis=nu)');

  // ── 4. dezabonarea: token + efect ───────────────────────────────────────────
  console.log('C2.4 — dezabonarea:');
  if (!verifyUnsubscribeToken(uid, unsubscribeToken(uid))) fail('tokenul valid nu trece verificarea');
  if (verifyUnsubscribeToken(uid, 'falsificat'.repeat(4))) fail('tokenul falsificat trece verificarea');
  console.log('  ✓ token HMAC: validul trece, falsificatul nu');

  await svc.from('user_profiles').update({ notification_preferences: { email: false } }).eq('id', uid);
  if (!(await emailOptedOut(svc, uid))) fail('opt-out: email=false nu e văzut');
  console.log('  ✓ opt-out (email=false) e respectat de verificarea din cron');
  await svc.from('user_profiles').update({ notification_preferences: {} }).eq('id', uid);

  // ── 5. streak rupt: detecția pe date reale ──────────────────────────────────
  console.log('C2.5 — detecția streak-ului rupt:');
  await svc.from('streak_log').delete().eq('user_id', uid);
  const day = (offset: number) => {
    const t = Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000;
    return new Date(t).toISOString().slice(0, 10);
  };
  await svc.from('streak_log').insert([
    { user_id: uid, activity_date: day(-2), exercises_count: 3 },
    { user_id: uid, activity_date: day(-3), exercises_count: 3 },
    { user_id: uid, activity_date: day(-4), exercises_count: 3 },
  ]);
  const lost = await lostStreakLength(svc, uid, today);
  if (lost !== 3) fail(`seria pierdută trebuia să fie 3 (activ -4..-2, ieri liber), primit ${lost}`);
  console.log('  ✓ ieri liber + 3 zile consecutive înainte → serie pierdută = 3');
  await svc.from('streak_log').insert([{ user_id: uid, activity_date: day(-1), exercises_count: 3 }]);
  const lost2 = await lostStreakLength(svc, uid, today);
  if (lost2 !== 0) fail(`cu activitate ieri seria NU e ruptă, primit ${lost2}`);
  console.log('  ✓ cu activitate ieri → seria nu e ruptă (0)');
  await svc.from('streak_log').delete().eq('user_id', uid);

  console.log(`\n✅ C2: ${previews.length} HTML-uri în docs/email-preview/, garda ${keyPresent ? 'trimitere reală OK' : "'pending-no-key' dovedită"}, dedupe + dezabonare + detecție streak verificate.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
