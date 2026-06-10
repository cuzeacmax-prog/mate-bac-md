/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  REVIZUIRE UMANĂ — registrul figurilor canonice de teorie (ETAPA 70 B1)  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Fiecare intrare leagă un concept din graf de o figură canonică DETERMINISTĂ
 * (generatoarele din render.ts — coordonate calculate, zero conținut AI).
 * Figurile canonice sunt legitime la TEORIE (teoria e generică); ele NU țin
 * locul figurilor de exercițiu (acelea vin din figura_autor, pe exercițiu).
 *
 * Maxim: parcurge lista de mai jos (slug → descriere) și taie/corectează ce
 * nu corespunde teoriei conceptului. Previzualizare: /api/figura-teorie/{slug}
 *
 * Selecția conceptelor (dovada în raportul ETAPEI 70): frontierele REALE ale
 * userilor existenți (22 concepte) ∪ top concepte cu conținut servibil (51).
 */
import {
  areaUnderCurve,
  areaBetweenCurves,
  primitiveFamily,
  solidOfRevolution,
  pyramid,
  frustumPyramid,
  cone,
  frustumCone,
  prism,
  parallelepiped,
  cylinder,
  circleFig,
  rectangleFig,
  planeFigures,
  triangleBisector,
  triangleCircumcircle,
  triangleCentroid,
  twoTriangles,
  solidsTrio,
} from './render';

export interface TheoryFigure {
  /** descriere pentru revizuirea umană + legenda implicită */
  descriere: string;
  render: () => string;
}

export const THEORY_FIGURES: Record<string, TheoryFigure> = {
  // ── integrale & arii (familia cu cele mai multe exerciții servibile) ──────
  'g12-integrala-definita':                                { descriere: 'Aria de sub graficul lui f pe [a,b] — sensul integralei definite', render: () => areaUnderCurve('simpla') },
  'g12-interpretarea-geometrica-a-integralei-definite':    { descriere: 'Aria de sub grafic = integrala definită (interpretarea geometrică)', render: () => areaUnderCurve('simpla') },
  'g12-aria-subgraficului-unei-functii':                   { descriere: 'Subgraficul lui f pe [a,b], hașurat, cu y=f(x), a, b', render: () => areaUnderCurve('simpla') },
  'g12-formula-leibniz-newton':                            { descriere: 'Aria de sub grafic între a și b — ce calculează F(b)−F(a)', render: () => areaUnderCurve('simpla') },
  'g12-proprietatile-integralei-definite':                 { descriere: 'Aria de sub grafic pe [a,b] — suportul vizual al proprietăților', render: () => areaUnderCurve('simpla') },
  'g12-functie-integrabila-in-sens-riemann':               { descriere: 'Sume Riemann: dreptunghiuri sub grafic care aproximează aria', render: () => areaUnderCurve('riemann') },
  'g12-teorema-de-medie-pentru-integrala-definita':        { descriere: 'Dreptunghiul de înălțime f(c) cu aceeași arie ca subgraficul', render: () => areaUnderCurve('medie') },
  'g12-aria-multimii-delimitate-de-graficele-a-doua-functii': { descriere: 'Banda dintre y=f(x) și y=g(x) între intersecțiile a și b', render: areaBetweenCurves },
  'g12-primitiva-a-unei-functii':                          { descriere: 'Familia primitivelor F(x)+C — curbe paralele pe verticală', render: primitiveFamily },
  'g12-integrala-nedefinita':                              { descriere: 'Integrala nedefinită = familia F(x)+C', render: primitiveFamily },
  'g12-proprietatile-integralei-nedefinite':               { descriere: 'Familia primitivelor — suportul vizual al proprietăților', render: primitiveFamily },
  'g12-metoda-schimbarii-de-variabila-in-calculul-primitivelor': { descriere: 'Familia primitivelor (metoda schimbării de variabilă)', render: primitiveFamily },
  'g12-metoda-integrarii-prin-parti-integrala-nedefinita': { descriere: 'Familia primitivelor (integrarea prin părți, nedefinită)', render: primitiveFamily },
  'g12-metoda-substitutiei-pentru-integrala-definita':     { descriere: 'Aria de sub grafic pe [a,b] (substituția păstrează aria)', render: () => areaUnderCurve('simpla') },
  'g12-metoda-integrarii-prin-parti-pentru-integrala-definita': { descriere: 'Aria de sub grafic pe [a,b] (integrarea prin părți, definită)', render: () => areaUnderCurve('simpla') },
  'g12-volumul-corpului-de-rotatie':                       { descriere: 'Graficul lui f rotit în jurul lui Ox — corpul de rotație cu secțiuni', render: solidOfRevolution },
  'g12-aria-suprafetei-de-rotatie':                        { descriere: 'Suprafața generată de graficul lui f rotit în jurul lui Ox', render: solidOfRevolution },

  // ── corpuri geometrice (frontierele reale ale userilor) ───────────────────
  'g12-piramida':                                          { descriere: 'Piramidă patrulateră VABCD cu înălțimea VO și apotema VM', render: () => pyramid(true) },
  'g12-volumul-piramidei':                                 { descriere: 'Piramidă cu înălțimea VO marcată (V = A·h/3)', render: () => pyramid(false) },
  'g12-trunchi-de-piramida':                               { descriere: 'Trunchi de piramidă cu bazele paralele și înălțimea OO₁', render: frustumPyramid },
  'g12-volumul-trunchiului-de-piramida':                   { descriere: 'Trunchi de piramidă cu înălțimea marcată', render: frustumPyramid },
  'g12-conul-circular-drept':                              { descriere: 'Con circular drept: vârf V, rază r, înălțime h, generatoare G', render: cone },
  'g12-volumul-conului-circular-drept':                    { descriere: 'Con circular drept cu r și h (V = πr²h/3)', render: cone },
  'g12-aria-laterala-a-conului-circular-drept':            { descriere: 'Con circular drept cu generatoarea G (Aₗ = πrG)', render: cone },
  'g12-aria-totala-a-conului-circular-drept':              { descriere: 'Con circular drept cu r și G (Aₜ = πr(r+G))', render: cone },
  'g12-trunchiul-de-con-circular-drept':                   { descriere: 'Trunchi de con: razele R și r, înălțimea h, generatoarea G', render: frustumCone },
  'g12-aria-laterala-a-trunchiului-de-con-circular-drept': { descriere: 'Trunchi de con cu generatoarea G (Aₗ = πG(R+r))', render: frustumCone },
  'g12-prisma':                                            { descriere: 'Prismă triunghiulară dreaptă ABCA₁B₁C₁ cu înălțimea h', render: prism },
  'g12-prisma-dreapta':                                    { descriere: 'Prismă dreaptă cu muchiile laterale perpendiculare pe bază', render: prism },
  'g12-volumul-prismei':                                   { descriere: 'Prismă dreaptă cu înălțimea marcată (V = A·h)', render: prism },
  'g12-paralelipiped':                                     { descriere: 'Paralelipiped dreptunghic ABCDA₁B₁C₁D₁ cu dimensiunile a,b,c', render: () => parallelepiped(false) },
  'g12-paralelipiped-dreptunghic':                         { descriere: 'Paralelipiped dreptunghic cu diagonala d (d² = a²+b²+c²)', render: () => parallelepiped(true) },
  'g12-volumul-paralelipipedului-dreptunghic':             { descriere: 'Paralelipiped dreptunghic cu a,b,c (V = a·b·c)', render: () => parallelepiped(false) },
  'g12-cilindrul-circular-drept':                          { descriere: 'Cilindru circular drept: raza r, înălțimea h', render: cylinder },
  'g12-volumul-unui-corp-geometric':                       { descriere: 'Prismă, cilindru, con — formulele de volum alături', render: solidsTrio },

  // ── geometrie plană (frontierele g10 ale userilor reali) ──────────────────
  'g10-cerc':                                              { descriere: 'Cerc cu centrul O, raza r și un punct M pe cerc', render: () => circleFig(false) },
  'g10-aria-discului':                                     { descriere: 'Discul hașurat cu raza r (A = πr²)', render: () => circleFig(true) },
  'g10-aria-dreptunghiului':                               { descriere: 'Dreptunghi ABCD cu L, l și aria hașurată', render: () => rectangleFig(false) },
  'g10-aria-patratului':                                   { descriere: 'Pătrat cu latura a și aria hașurată', render: () => rectangleFig(true) },
  'g10-aria-figurii-plane':                                { descriere: 'Figură compusă: dreptunghi + triunghi + semidisc (A = A₁+A₂+A₃)', render: planeFigures },
  'g10-bisectoarea-triunghiului':                          { descriere: 'Bisectoarea din A și piciorul D pe BC (teorema bisectoarei)', render: triangleBisector },
  'g10-centrul-cercului-circumscris':                      { descriere: 'Cercul circumscris cu centrul O (intersecția mediatoarelor) și raza R', render: triangleCircumcircle },
  'g10-centrul-de-greutate-al-triunghiului':               { descriere: 'Medianele și centrul de greutate G', render: triangleCentroid },
  'g10-asemanarea-figurilor':                              { descriere: 'Două triunghiuri asemenea △ABC ~ △A₁B₁C₁', render: () => twoTriangles(true) },
  'g10-congruenta-triunghiurilor':                         { descriere: 'Două triunghiuri congruente △ABC ≡ △A₁B₁C₁', render: () => twoTriangles(false) },
};

export function getTheoryFigure(slug: string): TheoryFigure | null {
  return THEORY_FIGURES[slug] ?? null;
}
