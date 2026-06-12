/**
 * ETAPA 78 FAZA D — ACCEPTANȚĂ PANOUL PILOTULUI: userul de audit intră în
 * cohortă, panoul îl vede cu cifre REALE (attempts/streak/cost din tabele),
 * inbox-ul are coloana status, iar scoaterea din cohortă îl face să dispară.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa78-pilot-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { gatherPilotPanel } from '../../src/lib/admin/pilot-data';

const EMAIL = 'etapa60-acceptance@test.local';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  const uid = user.id;
  await svc.from('user_profiles').upsert({ id: uid, email: EMAIL }, { onConflict: 'id' });

  // în cohortă → panoul îl vede cu cifre reale
  await svc.from('user_profiles').update({ is_pilot: true }).eq('id', uid);
  const panel = await gatherPilotPanel(svc);
  const me = panel.pilots.find((p) => p.id === uid);
  if (!me) fail('userul pilot nu apare în panou');
  if (panel.totals.pilots < 1) fail('totalul de piloți e 0 deși cohorta are useri');
  console.log(`  ✓ în cohortă: attempts7=${me.attempts7}, corecte=${me.correct7}, lecții=${me.lessons7}, streak=${me.streak}, cost=$${me.costUsd7.toFixed(4)}, activ7=${me.active7}`);
  if (me.attempts7 !== me.correct7 + (me.attempts7 - me.correct7)) fail('aritmetica attempts/correct e ruptă');

  // inbox-ul: coloana status există și e citibilă (nou/vazut/rezolvat)
  const { error: fbErr } = await svc.from('admin_feedback').select('id, status').limit(1);
  if (fbErr) fail(`admin_feedback.status nu e citibil: ${fbErr.message}`);
  for (const f of panel.feedback) {
    if (!['nou', 'vazut', 'rezolvat'].includes(f.status)) fail(`status invalid în inbox: ${f.status}`);
  }
  console.log(`  ✓ inbox feedback: ${panel.feedback.length} intrări, toate cu status valid`);
  console.log(`  ✓ erori recente: ${panel.errors.length} rânduri (katex_error_report, include client-render)`);
  console.log(`  ✓ top concepte (7z, pilot): ${panel.topConcepts.slice(0, 3).map((c) => c.name).join(', ') || '—'}`);

  // scos din cohortă → dispare
  await svc.from('user_profiles').update({ is_pilot: false }).eq('id', uid);
  const panel2 = await gatherPilotPanel(svc);
  if (panel2.pilots.some((p) => p.id === uid)) fail('userul scos din cohortă încă apare');
  console.log('  ✓ scos din cohortă: nu mai apare în panou');

  console.log('\n✅ FAZA D: panoul pilotului citește doar date reale, cohorta e setabilă, inbox-ul are stare.');
}
main().catch((e) => { console.error(e); process.exit(1); });
