/**
 * topic-concept-map.ts — ETAPA 60 PAS 2
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  REVIZUIRE UMANĂ NECESARĂ (Maxim)                                    ║
 * ║  Maparea topic-diagnostic → concepte din graf a fost propusă         ║
 * ║  automat DOAR pe potriviri clare de slug/titlu. Validează tabelul   ║
 * ║  de mai jos; orice corecție = editezi lista de slug-uri.            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Poartă anti-fabricație:
 *  - Toate slug-urile de mai jos au fost verificate că EXISTĂ în `concepts`
 *    (query anti-join la data scrierii: 0 inexistente).
 *  - `npm run verify:topic-map` re-verifică contra DB și iese cu cod 1 la
 *    orice slug inexistent — rulează-l după orice editare.
 *  - La runtime, rezolvarea slug→id sare peste slug-urile negăsite cu
 *    console.error (nu inventează evidență).
 *
 * Note de mapare (cross-grade, de validat uman):
 *  - „siruri" (diagnostic g10) → progresii din graf la g11 (graful nu are
 *    progresii la g10; conținutul întrebărilor e clar despre progresii).
 *  - „polinoame" (diagnostic g11) → concepte la g12 în graf.
 *  - „ecuatii/inecuatii_log_exp" (g11) → concepte la g10 în graf.
 *  - „matrici_determinanti", „numere_complexe" (g12) → concepte la g11.
 *  - „combinatorica" (g12) → concepte la g10.
 *
 * Tabel topic → slug-uri:
 * | topic (grade)               | slug-uri concepte                                          |
 * |-----------------------------|------------------------------------------------------------|
 * | algebra_ecuatii (10)        | g9-ecuatia-de-gradul-i…, g9-ecuatia-de-gradul-ii…          |
 * | algebra_inecuatii (10)      | g9-inecuatia-de-gradul-i…, g10-inecuatii-de-gradul-ii      |
 * | functii (10)                | g10-functie, g10-graficul-functiei, g10-functia-de-gradul-i|
 * | trigonometrie_baza (10)     | g10-cerc-trigonometric, g10-functiile-trig…-sinus-si-cosinus|
 * | logaritmi (10)              | g10-logaritmul-unui-numar, g10-functia-logaritmica         |
 * | exponentiale (10)           | g10-functia-exponentiala, g10-ecuatie-exponentiala         |
 * | siruri (10)                 | g11-progresia-aritmetica, g11-progresia-geometrica         |
 * | limite (11)                 | g11-limita-unei-functii-intr-un-punct, g11-limite-remarcabile, g11-operatii-cu-limite-de-functii |
 * | derivate (11)               | g11-derivata-functiei-intr-un-punct, g11-algoritm-de-calcul-al-derivatei |
 * | derivate_aplicatii (11)     | g11-tabloul-de-variatie-al-functiei, g11-optimizare-prin-derivate |
 * | ecuatii_log_exp (11)        | g10-ecuatie-logaritmica, g10-ecuatie-exponentiala          |
 * | inecuatii_log_exp (11)      | g10-inecuatie-logaritmica, g10-inecuatie-exponentiala      |
 * | polinoame (11)              | g12-polinom, g12-radacina-polinomului                      |
 * | siruri_avansate (11)        | g11-limita-unui-sir, g11-formula-sumei-…-progresiei-aritmetice |
 * | primitive (12)              | g12-primitiva-a-unei-functii, g12-integrala-nedefinita, g12-tabelul-integralelor-nedefinite-uzuale |
 * | integrale (12)              | g12-integrala-definita, g12-formula-leibniz-newton         |
 * | arii_volume (12)            | g12-aria-subgraficului…, g12-aria-multimii-delimitate…, g12-volumul-corpului-de-rotatie |
 * | geometrie_3d (12)           | g12-volumul-unui-corp-geometric, g12-volumul-piramidei, g12-volumul-prismei |
 * | matrici_determinanti (12)   | g11-matrice, g11-determinant-de-ordinul-2, g11-operatii-cu-matrice |
 * | numere_complexe (12)        | g11-numar-complex, g11-operatii-…-forma-algebrica, g11-modulul-unui-numar-complex |
 * | combinatorica (12)          | g10-combinari, g10-aranjamente, g10-permutari              |
 * | probabilitati (12)          | g12-probabilitatea-clasica…, g12-formula-probabilitatii-reuniunii…, g12-evenimente-independente |
 *
 * Topice NEMAPATE: niciunul — toate cele 22 de topice au avut potriviri
 * clare în graf. (Dacă la revizuire vreo mapare cade, mut-o în NEMAPATE.)
 */

/** Topice fără concept evident în graf — excluse de la scrierea de evidență. */
export const TOPICE_NEMAPATE: string[] = [];

export const TOPIC_CONCEPT_MAP: Record<string, string[]> = {
  // ── clasa 10 ──────────────────────────────────────────────────────────
  algebra_ecuatii: [
    'g9-ecuatia-de-gradul-i-cu-o-necunoscuta',
    'g9-ecuatia-de-gradul-ii-cu-o-necunoscuta',
  ],
  algebra_inecuatii: [
    'g9-inecuatia-de-gradul-i-cu-o-necunoscuta',
    'g10-inecuatii-de-gradul-ii',
  ],
  functii: ['g10-functie', 'g10-graficul-functiei', 'g10-functia-de-gradul-i'],
  trigonometrie_baza: [
    'g10-cerc-trigonometric',
    'g10-functiile-trigonometrice-sinus-si-cosinus',
  ],
  logaritmi: ['g10-logaritmul-unui-numar', 'g10-functia-logaritmica'],
  exponentiale: ['g10-functia-exponentiala', 'g10-ecuatie-exponentiala'],
  siruri: ['g11-progresia-aritmetica', 'g11-progresia-geometrica'],

  // ── clasa 11 ──────────────────────────────────────────────────────────
  limite: [
    'g11-limita-unei-functii-intr-un-punct',
    'g11-limite-remarcabile',
    'g11-operatii-cu-limite-de-functii',
  ],
  derivate: [
    'g11-derivata-functiei-intr-un-punct',
    'g11-algoritm-de-calcul-al-derivatei',
  ],
  derivate_aplicatii: [
    'g11-tabloul-de-variatie-al-functiei',
    'g11-optimizare-prin-derivate',
  ],
  ecuatii_log_exp: ['g10-ecuatie-logaritmica', 'g10-ecuatie-exponentiala'],
  inecuatii_log_exp: ['g10-inecuatie-logaritmica', 'g10-inecuatie-exponentiala'],
  polinoame: ['g12-polinom', 'g12-radacina-polinomului'],
  siruri_avansate: [
    'g11-limita-unui-sir',
    'g11-formula-sumei-primilor-n-termeni-ai-progresiei-aritmetice',
  ],

  // ── clasa 12 ──────────────────────────────────────────────────────────
  primitive: [
    'g12-primitiva-a-unei-functii',
    'g12-integrala-nedefinita',
    'g12-tabelul-integralelor-nedefinite-uzuale',
  ],
  integrale: ['g12-integrala-definita', 'g12-formula-leibniz-newton'],
  arii_volume: [
    'g12-aria-subgraficului-unei-functii',
    'g12-aria-multimii-delimitate-de-graficele-a-doua-functii',
    'g12-volumul-corpului-de-rotatie',
  ],
  geometrie_3d: [
    'g12-volumul-unui-corp-geometric',
    'g12-volumul-piramidei',
    'g12-volumul-prismei',
  ],
  matrici_determinanti: [
    'g11-matrice',
    'g11-determinant-de-ordinul-2',
    'g11-operatii-cu-matrice',
  ],
  numere_complexe: [
    'g11-numar-complex',
    'g11-operatii-cu-numere-complexe-in-forma-algebrica',
    'g11-modulul-unui-numar-complex',
  ],
  combinatorica: ['g10-combinari', 'g10-aranjamente', 'g10-permutari'],
  probabilitati: [
    'g12-probabilitatea-clasica-a-unui-eveniment',
    'g12-formula-probabilitatii-reuniunii-evenimentelor',
    'g12-evenimente-independente',
  ],
};

/** Slug-urile de concepte pentru un topic de diagnostic; [] dacă topicul e nemapat. */
export function getConceptSlugsForTopic(topicId: string): string[] {
  return TOPIC_CONCEPT_MAP[topicId] ?? [];
}
