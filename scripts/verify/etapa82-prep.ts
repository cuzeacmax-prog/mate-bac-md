/**
 * etapa82-prep.ts — pregătește userul de audit pentru porțile browser ETAPA 82.
 *
 * Rulează (DUPĂ ce migrația e aplicată): npx tsx --env-file=.env.local scripts/verify/etapa82-prep.ts
 *
 * Setează goal='bac', grade_level=12, target_bac_score=9 pe userul de audit, ca:
 *  - gate-ul A3 (goal NULL → /onboarding/confirma) să NU redirecteze gaterurile;
 *  - harta să arate clasa 12 plină (stress/qa-crawl/screens) cu toate lentilele.
 * Date de TEST, prin service client — la fel ca resetul de parolă din scripturile
 * existente (NU e o migrație de schemă).
 */
import { createServiceClient } from '../../src/lib/supabase/service';

const EMAIL = 'etapa60-acceptance@test.local';

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) {
    console.error('✗ EȘEC: userul de audit lipsește');
    process.exitCode = 1;
    return;
  }
  const { error } = await svc
    .from('user_profiles')
    .update({ goal: 'bac', grade_level: 12, target_bac_score: 9 })
    .eq('id', user.id);
  if (error) {
    console.error(`✗ EȘEC: ${error.message} (ai aplicat migrația 20260623000001?)`);
    process.exitCode = 1;
    return;
  }
  console.log('✅ audit pregătit: goal=bac, grade_level=12, target_bac_score=9');
}

main();
