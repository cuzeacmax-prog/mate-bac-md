/**
 * module-concept-map.ts — ETAPA 61 PAS 1
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  REVIZUIRE UMANĂ NECESARĂ (Maxim)                                    ║
 * ║  Harta modul-de-culegere → subarbori permiși din graf. Un link      ║
 * ║  exercițiu↔concept EXISTĂ doar dacă conceptul e în familia          ║
 * ║  modulului (poarta de curriculum) ȘI similaritatea ≥ prag.          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * SEMANTICA FAMILIEI: familia(rădăcină) = {rădăcina} ∪ descendenții ei din
 * concept_edges (X e descendent dacă depinde tranzitiv de rădăcină:
 * X →(from=dependent → to=prerechizit)* rădăcină). Apartenența se calculează
 * din muchii și se PERSISTĂ în concept_family_membership (nu se ghicește).
 *
 * Poarta la load: `npm run verify:module-map` verifică fiecare slug contra
 * DB și iese cu cod 1 la orice slug inexistent.
 *
 * Conținutul modulelor (citit din exercise_raw.section, nu presupus):
 * | Modul | Conținut (din secțiuni)                       | Rădăcini familie |
 * |-------|-----------------------------------------------|------------------|
 * | I     | Primitive, integrale nedefinite, prin părți   | primitiva, integrala-nedefinită |
 * | II    | Integrala definită, arii, volum corp rotație  | integrala-definită |
 * | III   | Combinatorică, binomul lui Newton             | permutări/aranjamente/combinări (g10+g12), binom |
 * | IV    | Probabilități, statistică, calcul financiar   | eveniment-aleator, serie-statistică, procent, dobândă |
 * | V     | Poliedre: prismă, piramidă, trunchi           | poliedru, prismă, piramidă, trunchi, cub, paralelipiped, tetraedru, volumul-corp |
 * | VI    | Corpuri de rotație: cilindru, con, sferă      | cilindru, con, trunchi-con, sferă, volumul-corp |
 * | VII   | TESTE recapitulative BAC (mixte!)             | uniunea I–VI+VIII + algebra liceală (funcții, ecuații, log/exp, modul, trig, progresii) |
 * | VIII  | Polinoame, ecuații de grad superior           | polinom (+ descendenți: rădăcină, împărțire) |
 *
 * NICIODATĂ cross-domeniu: analiza NU intră la „modulul numărului real" —
 * număr real ≠ integrală. (Defectul care a născut această etapă.)
 */

/** Familii de algebră liceală pentru testele mixte (Modulul VII). */
const ALGEBRA_LICEALA_ROOTS = [
  'g10-functie',
  'g10-logaritmul-unui-numar',
  'g10-functia-exponentiala',
  'g10-functia-logaritmica',
  'g9-ecuatia-de-gradul-ii-cu-o-necunoscuta',
  'g10-modulul-numarului-real',
  'g10-inecuatie-cu-o-necunoscuta',
  'g10-functiile-trigonometrice-ansamblu',
  'g11-progresia-aritmetica',
  'g11-progresia-geometrica',
];

const MODUL_I = ['g12-primitiva-a-unei-functii', 'g12-integrala-nedefinita'];
const MODUL_II = ['g12-integrala-definita'];
const MODUL_III = [
  'g10-permutari', 'g10-aranjamente', 'g10-combinari',
  'g12-permutari', 'g12-aranjamente', 'g12-combinari',
  'g12-binomul-lui-newton',
];
const MODUL_IV = [
  'g12-eveniment-aleator',
  'g12-serie-statistica',
  'g12-procent',
  'g12-dobanda-notiune-generala',
];
const MODUL_V = [
  'g12-poliedru', 'g12-prisma', 'g12-piramida', 'g12-trunchi-de-piramida',
  'g12-cub', 'g12-paralelipiped', 'g12-paralelipiped-dreptunghic', 'g12-tetraedru',
  'g12-volumul-unui-corp-geometric',
];
const MODUL_VI = [
  'g12-cilindrul-circular-drept', 'g12-conul-circular-drept',
  'g12-trunchiul-de-con-circular-drept', 'g12-sfera-si-corpul-sferic',
  'g12-volumul-unui-corp-geometric',
];
const MODUL_VIII = ['g12-polinom', 'g12-radacina-polinomului', 'g12-impartirea-polinoamelor'];

export const MODULE_CONCEPT_ROOTS: Record<string, string[]> = {
  'Modulul I': MODUL_I,
  'Modulul II': MODUL_II,
  'Modulul III': MODUL_III,
  'Modulul IV': MODUL_IV,
  'Modulul V': MODUL_V,
  'Modulul VI': MODUL_VI,
  // VII = teste mixte: uniunea tuturor + algebra liceală
  'Modulul VII': [
    ...MODUL_I, ...MODUL_II, ...MODUL_III, ...MODUL_IV,
    ...MODUL_V, ...MODUL_VI, ...MODUL_VIII,
    ...ALGEBRA_LICEALA_ROOTS,
  ],
  'Modulul VIII': MODUL_VIII,
};

/** Toate slug-urile distincte (pentru poarta de validare). */
export function allRootSlugs(): string[] {
  return [...new Set(Object.values(MODULE_CONCEPT_ROOTS).flat())];
}
