/**
 * etapa82-goal-mode.ts — ETAPA 82 POARTĂ C: BAC ca MOD, nu cadru.
 *
 * Rulează: npx tsx scripts/verify/etapa82-goal-mode.ts
 *
 * Dovedește determinist (zero LLM, zero DB) că același cont cu goal schimbat
 * bac↔note_clasa produce mesaje/traseu vizibil diferite, și că NU apare niciun
 * limbaj de BAC la goal=note_clasa/explorare.
 */
import {
  GOALS,
  mapHeadline,
  defaultLens,
  showsBacLens,
  predictionLabel,
  officialSourceLabel,
  servableLabel,
  targetQuestion,
  type Goal,
} from '../../src/lib/profile/goal';

function fail(msg: string): never {
  console.error(`✗ EȘEC: ${msg}`);
  process.exit(1);
}

const GRADE = 10;
console.log('── Modul per obiectiv (clasa 10, notă-țintă 9) ──\n');
for (const g of GOALS) {
  console.log(`goal=${g}`);
  console.log(`  titlu hartă : ${mapHeadline(g, GRADE)}`);
  console.log(`  lentilă     : ${defaultLens(g, true) ?? '(neutră / liberă)'}  · lentila BAC: ${showsBacLens(g) ? 'DA' : 'nu'}`);
  console.log(`  predicție   : ${predictionLabel(g)}`);
  console.log(`  sursă oficl.: ${officialSourceLabel(g)}`);
  console.log(`  nod (3 ex.) : ${servableLabel(g, 3)}`);
  console.log(`  întreb. țintă: ${targetQuestion(g) || '(nu se întreabă)'}\n`);
}

// 1) bac ≠ note_clasa: mesaje/traseu vizibil diferite
if (mapHeadline('bac', GRADE) === mapHeadline('note_clasa', GRADE)) {
  fail('titlul hărții e identic pentru bac și note_clasa');
}
if (defaultLens('bac', true) === defaultLens('note_clasa', true) && showsBacLens('bac') === showsBacLens('note_clasa')) {
  fail('lentila/modul nu diferă între bac și note_clasa');
}
console.log('✅ bac ≠ note_clasa: titlu + lentilă vizibil diferite');

// 2) ZERO limbaj de BAC la note_clasa & explorare
const strings = (g: Goal): string[] => [
  mapHeadline(g, GRADE),
  mapHeadline(g, null),
  predictionLabel(g),
  officialSourceLabel(g),
  servableLabel(g, 0),
  servableLabel(g, 4),
  targetQuestion(g),
];
for (const g of ['note_clasa', 'explorare'] as Goal[]) {
  for (const s of strings(g)) {
    if (s.toLowerCase().includes('bac')) fail(`limbaj de BAC găsit la goal=${g}: "${s}"`);
  }
}
console.log('✅ niciun limbaj de BAC la note_clasa & explorare');

// 3) explorare = hartă liberă (lentilă neutră, fără traseu impus)
if (defaultLens('explorare', true) !== null) fail('explorare ar trebui să fie neutră (fără lentilă impusă)');
console.log('✅ explorare = hartă liberă (lentilă neutră)');

// 4) bac = mod examen (limbaj de BAC prezent)
for (const s of [mapHeadline('bac', GRADE), predictionLabel('bac'), officialSourceLabel('bac')]) {
  if (!s.toLowerCase().includes('bac')) fail(`modul BAC ar trebui să conțină limbaj de BAC: "${s}"`);
}
console.log('✅ bac = mod examen (limbaj de BAC prezent)');

console.log('\n✅ ETAPA 82 POARTĂ C acceptată: BAC ca mod, nu cadru.');
