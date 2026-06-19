/**
 * prompt.ts — ETAPA 67: promptul lecției structurate.
 *
 * ETAPA 75 FAZA A (defectul de cache dovedit): minimul cacheabil pe Haiku e
 * 2048 tokeni; contractul singur are ~1100 → cache_control era IGNORAT tăcut
 * (cached_input_tokens=0 pe toate lecțiile free). Acum contextul conceptului
 * (teoria + exercițiile — semi-static per concept, identic cross-useri) e al
 * DOILEA bloc system cache-uit: prefixul cumulat trece de minim, iar re-cererea
 * blocurilor respinse + lecțiile repetate pe același concept citesc din cache.
 * FAZA E (67): regulile de limbaj sunt CONTRACT verificabil (limitele din
 * schemă le impun mecanic), nu rugăminți.
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
- manipulative: INVOCI o componentă vizuală deterministă — {kind, params, legenda?}.
  Kinds și parametrii lor (sistemul validează; invalid = blocul se pierde):
  · zaruri{n≤4, fete:[1..6] exact n} · monede{n≤8, rezultate?:['B'|'S'] exact n}
  · urna{bile:[{culoare,n}] total≤20, extrase?:[culori]} · persoane{n≤10, evidentiati?:[poziții 1-based], ordonat?:bool}
  · carti{n≤8, valori?:[text scurt] exact n} · dreapta-numerica{min, max, puncte?:[..], intervale?:[{de_la,pana_la}]}
  · bare-fractii{numitor 2-12, evidentiate≤numitor} · venn{eticheta_a, eticheta_b, zone?:['A'|'B'|'AB']}
  OBLIGATORIU la probabilitate/combinatorică/fracții/mulțimi: invocă manipulativul
  potrivit cu numerele EXACTE din exercițiu (cei 4 copii din problemă = persoane{n:4},
  nu o ilustrație generică). Tu invoci — sistemul desenează. Câmpul params e un
  STRING JSON cu parametrii kind-ului, NICIODATĂ gol. Exemplu COMPLET de bloc valid:
  {"tip":"manipulative","kind":"urna","params":"{\\"bile\\":[{\\"culoare\\":\\"rosii\\",\\"n\\":3},{\\"culoare\\":\\"albe\\",\\"n\\":2}],\\"extrase\\":[\\"rosii\\"]}","legenda":"3 bile roșii și 2 albe; extragem una."}
- recap: MAXIM 3 puncte, câte 1 propoziție.

BLOCURI INTERACTIVE (ETAPA 81 — elevul ATINGE, nu doar privește; sistemul le validează):
- parameter_slider: {expr_template, param, range:[min,max,step], observe, domain?} — elevul
  TRAGE parametrul și vede graficul re-randat. expr_template conține param (ex. „a*x^2"),
  observe = ce urmărește („nr. rădăcini", „vârful"). Folosește-l la FUNCȚII cu parametru
  (efectul lui a pe parabolă, multiplicitate). Tu ceri — motorul desenează.
- progressive_table: {coloane, randuri:[{cells, reveal_at_step, highlight_cell?}]} — tabel
  completat CELULĂ-CU-CELULĂ pe pași (tabel de semn, de variație, Viète). highlight_cell =
  celula activă. Folosește-l ÎN LOC de table acolo unde tabelul se construiește pas cu pas.
- reveal_figure: {figure_kind, theory_slug?|exercise_id?, layers:[{step_index, elements, caption}]}
  — figura cu straturi dezvăluite pe pași (întâi axele, apoi graficul, apoi tangenta).
- interactive_manipulative: {kind, params (STRING JSON), mode:'tactile'} — manipulativ TACTIL
  (kind ∈ zaruri/monede/urna/persoane/carti): zar aruncabil, urnă din care extragi (P se
  actualizează), persoane rearanjabile. La PROBABILITATE/COMBINATORICĂ cu acțiune repetată
  preferă-l manipulativului static, cu numerele EXACTE din problemă.
- try_step: {prompt, expected, hint} — pasul „încearcă tu": elevul răspunde ÎNAINTE să
  continue lecția; sistemul verifică determinist; greșit → arată hint, NU blochează.
  Pune UNUL la un pas de calcul cheie (nu la fiecare). expected = răspunsul scurt verificabil.

MANDATUL DE VIZUAL (ETAPA 77+81 — lecția ARATĂ și SE ATINGE, nu doar povestește):
- la FUNCȚII cu parametru: parameter_slider (efectul parametrului SE VEDE trăgând);
  la FUNCȚII/ANALIZĂ/POLINOAME fără parametru: plot (multiplicitatea pe grafic);
- la TABELE care se construiesc pas cu pas (semn, variație, Viète): progressive_table;
- la GEOMETRIE cu figură anunțată: reveal_figure pe straturi (sau figure);
- la PROBABILITĂȚI/COMBINATORICĂ: interactive_manipulative TACTIL cu numerele EXACTE;
- la un pas de calcul cheie: un try_step ocazional;
- conceptul permite un vizual/interactiv → lecția FĂRĂ el e respinsă de validator.

REGULA DE NOTAȚIE (încălcare dovedită: „^(m+1)" brut pe ecran): TOATĂ
matematica — inclusiv exponenți și indici scurți ca x^2, a_n — stă DOAR între
delimitatori $...$. Nicio notație matematică în text brut.

REGULI DE LIMBAJ (încălcarea = blocul e respins de validator și recerut):
1. O IDEE PER PAS. Dacă explici două lucruri, fă două blocuri step.
2. ÎNTÂI exemplul concret cu numere, APOI generalizarea. Niciodată invers.
3. INTERZIS pereții de teorie: teoria apare DOAR legată de pasul de rezolvare curent.
4. PUNTEA PROGRESIVĂ (ETAPA 81 C2 — regulă fermă, verificabilă): PRIMA apariție a
   unui termen STRICT/de barem (ex. „bijectiv", „injectiv", „monoton", „asimptotă",
   „discriminant") = termenul comun + definiția scurtă în paranteză sau „se numește X";
   aparițiile ULTERIOARE = termenul direct (nu repeta definiția). Niciodată jargon
   gol la prima folosire. Registrul de bază urmează nivelul anunțat de sistem.
5. NU pune întrebări retorice de tip „tu ce crezi?" la nesfârșit — ARĂTĂ cum se
   rezolvă, pas cu pas, apoi verifică prin quiz. (Regula anti-dialog-socratic.)
6. Matematica DOAR între delimitatori $...$; textul românesc rămâne text.
7. Numerele și datele de la sistem (enunțuri, răspunsuri oficiale) se EXTRAG, nu se inventează.

STRUCTURA RECOMANDATĂ a lecției (8-14 blocuri):
intro → step-uri cu example intercalate → quiz după fiecare idee majoră (minim 2 quiz-uri)
→ figure unde există → manipulative la conceptele vizuale → recap.
Quiz-urile testează FIX ce s-a predat în blocurile anterioare.`;

export interface LessonRequestContext {
  conceptName: string;
  gradeLevel: number | null;
  theory: string;
  exercises: Array<{ id: string; statement: string; official_answer: string | null; has_figure: boolean }>;
  /** ETAPA 70 B3: figura canonică din registrul theory-figures, dacă există */
  theoryFigure?: { slug: string; descriere: string } | null;
}

/**
 * ETAPA 75 FAZA A: contextul CONCEPTULUI (teorie + exerciții + figura canonică
 * + instrucțiunea vizuală) — SEMI-STATIC: identic pentru orice user pe același
 * concept → al doilea bloc system cu cache:true (prefix cumulat > minimul Haiku).
 */
export function buildLessonConceptBlock(ctx: LessonRequestContext): string {
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
  // ETAPA 71 C3: conceptele vizuale primesc instrucțiunea fermă de manipulativ
  const visualHint = /probabilitat|eveniment|combinat|permut|aranjament|fract|multim|statistic/i.test(ctx.conceptName)
    ? `\nCONCEPT VIZUAL: emite OBLIGATORIU cel puțin un bloc manipulative (urna/zaruri/monede/persoane/carti/venn/bare-fractii/dreapta-numerica) cu numerele EXACTE din exemplul folosit — imediat după exemplul pe care îl ilustrează.`
    : '';
  return `CONCEPTUL LECȚIEI: ${ctx.conceptName}
${theoryFigureLine}${visualHint}
TEORIA DE REFERINȚĂ (sursa de adevăr — extrage, nu contrazice):
${ctx.theory || '(fără teorie în graf — folosește doar exercițiile)'}

EXERCIȚIILE SERVIBILE (folosește-le în example/quiz; figura doar cu id-ul dat):
${exercisesBlock}`;
}

/** mesajul user — DOAR partea per-elev (dinamică, necacheată) */
export function buildLessonUserMessage(ctx: Pick<LessonRequestContext, 'conceptName' | 'gradeLevel'>): string {
  return `Generează lecția structurată pentru conceptul: ${ctx.conceptName}
Clasa elevului: ${ctx.gradeLevel ?? 12}`;
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
