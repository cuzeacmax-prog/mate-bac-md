/**
 * ETAPA 78 B3 — ACCEPTANȚĂ PUSH: simulare cron pe userul de audit, cu regulile
 * de bun-simț dovedite una câte una:
 *   fără abonament → nimic; ore de liniște → nimic; daily făcut → nimic;
 *   streak < 2 → nimic (n-are ce pierde); trimis → notifications_log;
 *   al doilea push în aceeași zi → blocat (max 1/zi);
 *   provocarea: DOAR opt-in explicit + fereastra de dimineață.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa78-push-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { decideStreakPush, decideProvocarePush, sendPushToUser } from '../../src/lib/notify/push';
import { chisinauToday } from '../../src/lib/daily/daily';

const EMAIL = 'etapa60-acceptance@test.local';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

function expectReason(name: string, d: { send: boolean; reason?: string }, reason: string) {
  if (d.send || d.reason !== reason) {
    fail(`${name}: așteptat blocaj '${reason}', primit ${JSON.stringify(d)}`);
  }
  console.log(`  ✓ ${name}: blocat corect (${reason})`);
}

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  const uid = user.id;

  // user_profiles trebuie să existe (FK-ul abonamentelor)
  await svc.from('user_profiles').upsert({ id: uid, email: EMAIL }, { onConflict: 'id' });

  const today = chisinauToday();
  const seara = new Date(`${today}T19:30:00+03:00`);
  const noapte = new Date(`${today}T22:30:00+03:00`);
  const dimineata = new Date(`${today}T08:30:00+03:00`);
  const pranz = new Date(`${today}T12:00:00+03:00`);

  // start curat: fără abonamente, fără log push azi, fără daily azi, prefs implicite
  await svc.from('push_subscriptions').delete().eq('user_id', uid);
  await svc.from('notifications_log').delete().eq('user_id', uid).eq('channel', 'push').gte('sent_at', `${today}T00:00:00`);
  await svc.from('daily_challenges').delete().eq('user_id', uid).eq('challenge_date', today);
  await svc.from('user_profiles').update({ notification_preferences: {} }).eq('id', uid);
  // streak ≥ 2: ieri + alaltăieri în streak_log
  const day = (offset: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  await svc.from('streak_log').delete().eq('user_id', uid);
  await svc.from('streak_log').insert([
    { user_id: uid, activity_date: day(1), exercises_count: 3 },
    { user_id: uid, activity_date: day(2), exercises_count: 3 },
  ]);

  console.log('STREAK ÎN PERICOL — regulile:');
  expectReason('fără abonament push', await decideStreakPush(svc, uid, seara), 'fara-abonament-push');

  const fakeEndpoint = `https://example.com/push-fake-${uid.slice(0, 8)}`;
  await svc.from('push_subscriptions').insert({
    user_id: uid,
    endpoint: fakeEndpoint,
    keys: { p256dh: 'BPlaceholderP256dhKeyForAuditOnly_NotARealKey_0000000000000000000000000000000000000000000', auth: 'cGxhY2Vob2xkZXI' },
  });

  const ok = await decideStreakPush(svc, uid, seara);
  if (!ok.send) fail(`cu abonament + daily nefăcut + streak 2 trebuia SĂ TRIMITĂ, primit ${JSON.stringify(ok)}`);
  console.log('  ✓ abonat + daily nefăcut + streak 2 → decizia: TRIMITE');

  expectReason('orele de liniște (22:30)', await decideStreakPush(svc, uid, noapte), 'ore-de-liniste');

  await svc.from('daily_challenges').insert({
    user_id: uid, challenge_date: today, exercises: [], completed: true,
  });
  expectReason('daily-ul făcut', await decideStreakPush(svc, uid, seara), 'daily-facut');
  await svc.from('daily_challenges').delete().eq('user_id', uid).eq('challenge_date', today);

  await svc.from('streak_log').delete().eq('user_id', uid);
  expectReason('streak 0 (nimic de pierdut)', await decideStreakPush(svc, uid, seara), 'streak-sub-2-nimic-de-pierdut');
  await svc.from('streak_log').insert([
    { user_id: uid, activity_date: day(1), exercises_count: 3 },
    { user_id: uid, activity_date: day(2), exercises_count: 3 },
  ]);

  // trimiterea reală (endpoint fals → eșec logat onest, nu exception)
  const sent = await sendPushToUser(svc, uid, 'push-streak', {
    title: 'Streak-ul tău e în pericol 🔥',
    body: 'Daily-ul de azi te așteaptă.',
    url: '/app/azi',
  });
  const { data: logRows } = await svc
    .from('notifications_log')
    .select('notification_type, channel, metadata, sent_at')
    .eq('user_id', uid)
    .eq('channel', 'push')
    .gte('sent_at', `${today}T00:00:00`);
  if (!logRows || logRows.length !== 1) fail(`trimiterea trebuia logată exact o dată (găsit ${logRows?.length ?? 0})`);
  console.log(`  ✓ trimiterea → notifications_log (status: ${(logRows[0].metadata as { status: string }).status}, delivered=${sent.delivered}, dead=${sent.dead})`);

  expectReason('al 2-lea push în aceeași zi', await decideStreakPush(svc, uid, seara), 'limita-1-pe-zi');

  console.log('PROVOCAREA DE DIMINEAȚĂ — regulile:');
  // abonamentul fals poate fi fost șters la cleanup (endpoint mort) → re-inserăm
  await svc.from('push_subscriptions').upsert(
    { user_id: uid, endpoint: fakeEndpoint, keys: { p256dh: 'x', auth: 'y' } },
    { onConflict: 'endpoint' }
  );
  // curățăm logul ca limita-1-pe-zi să nu mascheze regulile proprii provocării
  await svc.from('notifications_log').delete().eq('user_id', uid).eq('channel', 'push').gte('sent_at', `${today}T00:00:00`);

  expectReason('fără opt-in explicit', await decideProvocarePush(svc, uid, dimineata), 'fara-opt-in');
  await svc.from('user_profiles').update({ notification_preferences: { daily_challenge: true } }).eq('id', uid);
  const okProv = await decideProvocarePush(svc, uid, dimineata);
  if (!okProv.send) fail(`opt-in + 08:30 + daily nefăcut trebuia SĂ TRIMITĂ, primit ${JSON.stringify(okProv)}`);
  console.log('  ✓ opt-in + 08:30 + daily nefăcut → decizia: TRIMITE');
  expectReason('în afara ferestrei (12:00)', await decideProvocarePush(svc, uid, pranz), 'in-afara-ferestrei-de-dimineata');

  // cleanup: abonamentul fals + prefs implicite (logul rămâne ca artefact de audit)
  await svc.from('push_subscriptions').delete().eq('user_id', uid);
  await svc.from('user_profiles').update({ notification_preferences: {} }).eq('id', uid);

  console.log('\n✅ B3: push-ul e servitor, nu spam — toate regulile dovedite pe userul de audit.');
}
main().catch((e) => { console.error(e); process.exit(1); });
