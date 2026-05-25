/**
 * _normalize.mjs — Preprocessing: creează normalized.json pentru fiecare clasă
 * Run: node scripts/seed/manuale-extracted/_normalize.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(__dir, '../../../docs/manuale-source');
const outDir = __dir;

// ── CLASA XII ─────────────────────────────────────────────────────────────────

const clasa12Raw = JSON.parse(readFileSync(join(sourceDir, 'clasa_XII_raw_json.json'), 'utf8'));

const normalize12 = clasa12Raw.map(s => ({
  exercise_type:       s.exercise_type,
  exercise_type_label: s.exercise_type_label,
  method_name:         s.method_name,
  grade_level:         12,
  topic:               s.topic,
  subtopic:            s.subtopic || null,
  description:         s.description,
  steps:               Array.isArray(s.steps) ? s.steps : [],
  notation_rules:      s.notation_rules || {},
  examples:            Array.isArray(s.examples) ? s.examples : [],
  common_mistakes:     [
    ...(Array.isArray(s.common_mistakes) ? s.common_mistakes : []),
    ...(Array.isArray(s.forbidden_shortcuts)
      ? s.forbidden_shortcuts.map(f => ({ mistake: f, correction: 'Evitați această scurtătură.' }))
      : []),
  ],
  required_tools:      s.required_tools || null,
  importance_score:    s.importance_score || 5,
  validated:           s.validated === true,
  validated_by:        'Maxim (extrase din Achiri XII 2017, Ed. Prut)',
  source:              s.source || null,
}));

writeFileSync(
  join(outDir, 'clasa-12/normalized.json'),
  JSON.stringify(normalize12, null, 2),
  'utf8'
);
console.log(`clasa-12/normalized.json — ${normalize12.length} scenarii`);

// ── CLASA XI (din YAML index — stubs) ────────────────────────────────────────

const xi_themes = [
  {exercise_type:'multimi_marginire_supremum_infimum', label:'Margini inferioare și superioare ale mulțimilor de numere reale', topic:'analiza', importance:6, status:'nou'},
  {exercise_type:'siruri_definitie_clasificare', label:'Siruri numerice — definitie, moduri de definire, subsiruri', topic:'siruri', importance:7, status:'completare'},
  {exercise_type:'progresii_sume_n_termeni', label:'Sume Sn pentru PA si PG', topic:'siruri', importance:8, status:'completare'},
  {exercise_type:'siruri_limita_convergenta', label:'Limita unui sir. Siruri convergente / divergente. Numarul e', topic:'limite', importance:9, status:'nou'},
  {exercise_type:'limita_functie_intr_punct', label:'Limita unei functii intr-un punct', topic:'limite', importance:9, status:'nou'},
  {exercise_type:'limite_functii_elementare_operatii', label:'Operatii cu limite. Limitele functiilor elementare', topic:'limite', importance:9, status:'nou'},
  {exercise_type:'limite_calcul_remarcabile', label:'Calculul limitelor. Limite remarcabile', topic:'limite', importance:9, status:'completare'},
  {exercise_type:'limite_cazuri_exceptate', label:'Cazuri exceptate (nedeterminari) la limite', topic:'limite', importance:9, status:'completare'},
  {exercise_type:'functii_continue_definitie', label:'Functii continue intr-un punct si pe o multime', topic:'analiza', importance:9, status:'nou'},
  {exercise_type:'functii_continue_proprietati', label:'Operatii si proprietati ale functiilor continue', topic:'analiza', importance:8, status:'nou'},
  {exercise_type:'derivata_definitie_notiune', label:'Notiunea de derivata', topic:'analiza', importance:9, status:'nou'},
  {exercise_type:'derivata_interpretare_geometrica_completare', label:'Interpretarea geometrica a derivatei (completare)', topic:'analiza', importance:8, status:'completare'},
  {exercise_type:'derivate_tabel_reguli', label:'Tabelul derivatelor si regulile de derivare', topic:'analiza', importance:10, status:'nou'},
  {exercise_type:'derivata_diferentiala', label:'Diferentiala unei functii', topic:'analiza', importance:6, status:'nou'},
  {exercise_type:'derivate_teoreme_fundamentale', label:'Teoremele fundamentale: Fermat, Rolle, Lagrange, Cauchy, LHospital', topic:'analiza', importance:9, status:'completare'},
  {exercise_type:'derivate_ordin_superior', label:'Derivate de ordin superior', topic:'analiza', importance:7, status:'nou'},
  {exercise_type:'derivata_monotonie_extreme_completare', label:'Monotonia si extremele cu derivate (completare)', topic:'analiza', importance:9, status:'completare'},
  {exercise_type:'derivata_doua_asimptote_completare', label:'Convexitate, concavitate, asimptote (completare)', topic:'analiza', importance:8, status:'completare'},
  {exercise_type:'schema_studiu_functie', label:'Schema studiului unei functii (algoritm 7 etape)', topic:'analiza', importance:10, status:'nou'},
  {exercise_type:'derivata_aplicatii_max_min', label:'Aplicatii derivate la probleme de optim', topic:'analiza', importance:9, status:'nou'},
  {exercise_type:'numere_complexe_forma_trigonometrica', label:'Forma trigonometrica. Moivre. Radacini complexe', topic:'algebra', importance:9, status:'nou'},
  {exercise_type:'numere_complexe_aplicatii', label:'Aplicatii: ecuatii binome si trinome', topic:'algebra', importance:7, status:'nou'},
  {exercise_type:'matrice_operatii_complete', label:'Matrice: operatii, transpusa, forma esalon', topic:'algebra', importance:9, status:'completare'},
  {exercise_type:'determinanti_calcul_proprietati', label:'Determinanti: calcul, proprietati, inversa matricii', topic:'algebra', importance:10, status:'nou'},
  {exercise_type:'sisteme_liniare_cramer_gauss', label:'Sisteme liniare: Cramer general, Gauss, Kronecker-Capelli', topic:'algebra', importance:10, status:'nou'},
  {exercise_type:'axiomele_geometriei_spatiu', label:'Axiomele geometriei in spatiu', topic:'geometrie', importance:8, status:'nou'},
  {exercise_type:'pozitii_relative_drepte_spatiu', label:'Pozitii relative ale dreptelor in spatiu', topic:'geometrie', importance:7, status:'nou'},
  {exercise_type:'drepte_plane_paralelism', label:'Dreapta paralela cu plan. Teorema acoperisului', topic:'geometrie', importance:8, status:'nou'},
  {exercise_type:'plane_paralele', label:'Plane paralele', topic:'geometrie', importance:9, status:'nou'},
  {exercise_type:'drepte_plane_perpendiculare', label:'Drepte si plane perpendiculare', topic:'geometrie', importance:9, status:'nou'},
  {exercise_type:'proiectii_ortogonale_unghi_dreapta_plan', label:'Proiectii ortogonale. Teorema celor trei perpendiculare', topic:'geometrie', importance:10, status:'nou'},
  {exercise_type:'unghi_diedru', label:'Unghi diedru. Plane perpendiculare. Aria proiectiei', topic:'geometrie', importance:10, status:'nou'},
  {exercise_type:'transformari_izometrice_definitii', label:'Transformari geometrice. Izometrii', topic:'geometrie', importance:7, status:'nou'},
  {exercise_type:'simetria_centrala_spatiu', label:'Simetria centrala', topic:'geometrie', importance:6, status:'nou'},
  {exercise_type:'simetria_axiala_spatiu', label:'Simetria axiala', topic:'geometrie', importance:6, status:'nou'},
  {exercise_type:'simetria_fata_de_plan', label:'Simetria fata de un plan (reflexia)', topic:'geometrie', importance:6, status:'nou'},
  {exercise_type:'translatia_spatiu', label:'Translatia', topic:'geometrie', importance:6, status:'nou'},
  {exercise_type:'asemanare_omotetia_spatiu', label:'Transformarea de asemanare. Omotetia', topic:'geometrie', importance:7, status:'nou'},
  {exercise_type:'rotatia_axiala_spatiu', label:'Rotatia in jurul unei drepte (axiala)', topic:'geometrie', importance:6, status:'nou'},
];

// Only NEW topics (completions likely exist; skip to avoid duplicates)
const newOnly11 = xi_themes
  .filter(t => t.status === 'nou')
  .map(t => ({
    exercise_type:       t.exercise_type,
    exercise_type_label: t.label,
    method_name:         t.label + ' (cl.11, Achiri 2014)',
    grade_level:         11,
    topic:               t.topic,
    subtopic:            null,
    description:         t.label + '. Din Matematica clasa XI (Achiri si colab., Ed. Prut, 2014). Pasii si exemplele necesita completare manuala in /admin/methodologies.',
    steps:               [],
    notation_rules:      {},
    examples:            [],
    common_mistakes:     [],
    required_tools:      null,
    importance_score:    t.importance,
    validated:           false,
    validated_by:        null,
    source:              { book: 'Matematica clasa 11 (Achiri si colab.)', edition: '2014' },
  }));

writeFileSync(
  join(outDir, 'clasa-11/normalized.json'),
  JSON.stringify(newOnly11, null, 2),
  'utf8'
);
console.log(`clasa-11/normalized.json — ${newOnly11.length} scenarii noi (din ${xi_themes.length} total)`);

// ── CLASA X (din mega_index.json) ────────────────────────────────────────────

let xRaw = readFileSync(join(sourceDir, 'clasa_X_sectiunea_A_mega_index.json'), 'utf8');
if (xRaw.charCodeAt(0) === 0xFEFF) xRaw = xRaw.slice(1);
const xParsed = JSON.parse(xRaw);
const xIndex = xParsed.themes_index;

const normalize10 = xIndex.map(t => ({
  exercise_type:       t.exercise_type,
  exercise_type_label: t.exercise_type.replace(/_/g, ' '),
  method_name:         t.exercise_type.replace(/_/g, ' ') + ' (cl.10, Achiri 2012)',
  grade_level:         10,
  topic:               t.topic,
  subtopic:            t.subtopic || null,
  description:         'Tema ' + t.section + ' din Matematica clasa X (Achiri si colab., Ed. Prut, 2012), pag. ' + t.page_start + '. Pasii si exemplele necesita completare manuala.',
  steps:               [],
  notation_rules:      {},
  examples:            [],
  common_mistakes:     [],
  required_tools:      null,
  importance_score:    t.importance_score,
  validated:           false,
  validated_by:        null,
  source:              { book: 'Matematica clasa X (Achiri si colab.)', edition: '2012', page: t.page_start, section: t.section },
}));

writeFileSync(
  join(outDir, 'clasa-10/normalized.json'),
  JSON.stringify(normalize10, null, 2),
  'utf8'
);
console.log(`clasa-10/normalized.json — ${normalize10.length} scenarii (${xParsed.extraction_metadata.themes_already_in_db_skipped} pot fi deja in DB)`);

console.log('\nSUMAR TOTAL:');
console.log('  Clasa 10:', normalize10.length, 'scenarii');
console.log('  Clasa 11:', newOnly11.length, 'scenarii noi');
console.log('  Clasa 12:', normalize12.length, 'scenarii');
console.log('  TOTAL:', normalize10.length + newOnly11.length + normalize12.length, 'scenarii de importat');
