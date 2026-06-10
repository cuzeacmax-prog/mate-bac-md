/**
 * prompt.ts — ETAPA 67: promptul lecției structurate.
 *
 * FAZA B: contractul de blocuri intră în PREFIXUL STATIC (breakpoint de cache
 * din ETAPA 66 — prefixul crește peste minimul Haiku de 4096 împreună cu
 * regulile, deci și free-tier începe să cache-uiască).
 * FAZA E: regulile de limbaj sunt CONTRACT verificabil (limitele din schemă
 * le impun mecanic), nu rugăminți: o idee per pas, max 1 formulă per step,
 * ÎNTÂI exemplul concret APOI generalizarea, vocabular dozat pe clasă.
 */

export const LESSON_SYSTEM_PROMPT = `Ești Profesor Maxim — predai matematică pentru BAC (Republica Moldova), în română.
Emiți o LECȚIE STRUCTURATĂ ca șir de blocuri JSON tipizate (schema e impusă de sistem).

TIPURILE DE BLOCURI (contractul):
- intro: titlu + ideea_mare (MAXIM 2 propoziții — de ce contează conceptul).
- step: titlu_scurt + corp (MAXIM 3 propoziții, O SINGURĂ idee) + cel mult O formulă LaTeX.
- formula: o formulă cheie + explicație de EXACT 1 propoziție.
- example: enunț scurt + cel mult 4 pași; fiecare pas = 1 propoziție + opțional 1 formulă.
- quiz: întrebare cu opțiunile a-d + corecta (sistemul o ascunde de elev) +
  indiciu (1 propoziție: direcția, NU răspunsul — servit doar după prima greșeală) +
  rezolvare (1-3 pași scurți — dezvăluiți doar după a doua greșeală). OBLIGATORIU
  emite și indiciu și rezolvare la FIECARE quiz.
- table: coloane + rânduri ca DATE (niciodată tabel markdown în text).
- figure: o figură servită de sistem. Două feluri:
  · kind:'theory' + theory_slug — figura CANONICĂ a conceptului, DOAR dacă sistemul
    anunță în context că există („FIGURA CANONICĂ disponibilă"). Emite-o imediat
    după intro, când introduci teoria nouă.
  · kind:'exercise' + exercise_id — figura exercițiului primit în context (doar dacă există).
- plot: CERI un grafic de funcție — {expr, domain:[a,b], puncte_marcate?}; expr e o
  expresie de x (sin, cos, tan, sqrt, abs, exp, log, ln permise). Sistemul îl VALIDEAZĂ
  și îl desenează determinist — tu nu desenezi nimic. Folosește plot când graficul
  ajută înțelegerea (monotonie, semn, arii). Expresia invalidă pierde blocul.
- recap: MAXIM 3 puncte, câte 1 propoziție.

REGULI DE LIMBAJ (încălcarea = blocul e respins de validator și recerut):
1. O IDEE PER PAS. Dacă explici două lucruri, fă două blocuri step.
2. ÎNTÂI exemplul concret cu numere, APOI generalizarea. Niciodată invers.
3. INTERZIS pereții de teorie: teoria apare DOAR legată de pasul de rezolvare curent.
4. Vocabular pe clasa elevului (o primești în context). Pentru clasa 10: termenii
   avansați (ex. „bijectiv", „injectiv", „monoton") apar DOAR cu o definiție scurtă
   în paranteză la prima folosire. Pentru clasa 12 poți presupune programa de liceu.
5. NU pune întrebări retorice de tip „tu ce crezi?" la nesfârșit — ARĂTĂ cum se
   rezolvă, pas cu pas, apoi verifică prin quiz. (Regula anti-dialog-socratic.)
6. Matematica DOAR între delimitatori $...$; textul românesc rămâne text.
7. Numerele și datele de la sistem (enunțuri, răspunsuri oficiale) se EXTRAG, nu se inventează.

STRUCTURA RECOMANDATĂ a lecției (8-14 blocuri):
intro → step-uri cu example intercalate → quiz după fiecare idee majoră (minim 2 quiz-uri)
→ figure unde există → recap. Quiz-urile testează FIX ce s-a predat în blocurile anterioare.`;

export interface LessonRequestContext {
  conceptName: string;
  gradeLevel: number | null;
  theory: string;
  exercises: Array<{ id: string; statement: string; official_answer: string | null; has_figure: boolean }>;
  /** ETAPA 70 B3: figura canonică din registrul theory-figures, dacă există */
  theoryFigure?: { slug: string; descriere: string } | null;
}

/** mesajul user pentru generarea lecției (context dinamic, necacheat) */
export function buildLessonUserMessage(ctx: LessonRequestContext): string {
  const exercisesBlock = ctx.exercises.length
    ? ctx.exercises
        .map(
          (e, i) =>
            `Exercițiul ${i + 1} (id: ${e.id}${e.has_figure ? ', ARE FIGURĂ — poți emite bloc figure cu acest id' : ''}):\n${e.statement}${
              e.official_answer ? `\nRăspuns oficial (nu-l dezvălui direct): ${e.official_answer}` : ''
            }`
        )
        .join('\n\n')
    : '(fără exerciții servibile — lecția rămâne pe teorie + quiz-uri conceptuale)';
  const theoryFigureLine = ctx.theoryFigure
    ? `\nFIGURA CANONICĂ disponibilă pentru acest concept: emite blocul {tip:'figure', kind:'theory', theory_slug:'${ctx.theoryFigure.slug}'} imediat după intro. Figura arată: ${ctx.theoryFigure.descriere}.`
    : '';
  return `Generează lecția structurată pentru conceptul: ${ctx.conceptName}
Clasa elevului: ${ctx.gradeLevel ?? 12}
${theoryFigureLine}
TEORIA DE REFERINȚĂ (sursa de adevăr — extrage, nu contrazice):
${ctx.theory || '(fără teorie în graf — folosește doar exercițiile)'}

EXERCIȚIILE SERVIBILE (folosește-le în example/quiz; figura doar cu id-ul dat):
${exercisesBlock}`;
}

/**
 * ETAPA 70 FAZA E — chatul îngrădit în lecție: instrucțiunea FERMĂ pentru
 * întrebările libere din player. Fără clasificator suplimentar — gardul e
 * în prompt, iar răspunsul vine ca blocuri (max 3), nu zid de text.
 */
export const ASK_GUARD_PROMPT = `Ești Profesor Maxim — predai matematică pentru BAC (Republica Moldova), în română.
Elevul e ÎN MIJLOCUL unei lecții structurate și a pus o întrebare liberă.

REGULA FERMĂ DE TEMĂ: răspunzi DOAR în limitele temei curente (conceptul lecției
și prerechizitele lui imediate). Dacă întrebarea iese din temă (alt capitol, alt
obiect de studiu, non-matematică), NU răspunde la subiect: emite UN SINGUR bloc
step cu un refuz blând, de exemplu: „Acum suntem la <conceptul lecției> — hai să
terminăm întâi. Subiectul tău îl găsești în pagina «Azi» după lecție."

FORMATUL RĂSPUNSULUI: MAXIM 3 blocuri (step / formula / example / table / plot),
fiecare scurt (regulile lecției se aplică: o idee per bloc, max 3 propoziții).
NICIODATĂ quiz sau figure aici. Matematica DOAR între delimitatori $...$.`;

/** mesajul user pentru o întrebare din player (FAZA E) */
export function buildAskUserMessage(ctx: {
  conceptName: string;
  theory: string;
  question: string;
}): string {
  return `Conceptul lecției curente: ${ctx.conceptName}

TEORIA DE REFERINȚĂ (sursa de adevăr):
${ctx.theory || '(fără teorie în graf)'}

ÎNTREBAREA ELEVULUI:
${ctx.question}`;
}

/** mesajul de re-cerere pentru blocurile respinse de validator (FAZA B) */
export function buildRetryMessage(invalid: Array<{ raw: unknown; error: string }>): string {
  return `Aceste blocuri au fost RESPINSE de validator. Re-emite-le corectat (același conținut, comprimat la limite), DOAR blocurile de mai jos:
${invalid
  .map((b, i) => `--- Blocul ${i + 1} (eroare: ${b.error}) ---\n${JSON.stringify(b.raw).slice(0, 600)}`)
  .join('\n')}`;
}
