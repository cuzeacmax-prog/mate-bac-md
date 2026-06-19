/**
 * blocks.ts — ETAPA 67 FAZA A: CONTRACTUL DE BLOCURI al lecției structurate.
 *
 * AI-ul emite lecția ca secvență de blocuri tipizate; design-system-ul le
 * randează animat (LessonPlayer). Limitele de lungime sunt ÎN SCHEMĂ (Zod,
 * validate la primire) — nu rugăminți în prompt: blocul invalid se respinge
 * și se recere. Acesta e mecanismul care omoară „enciclopedia pe ecran".
 *
 * Numărarea propozițiilor: secvențe terminate cu . ! ? urmate de spațiu/final,
 * ignorând zecimalele (3.5) și punctele din notații matematice dintre $...$.
 */
import { z } from 'zod';

/** numără propozițiile dintr-un text (zecimale și math inline ignorate) */
export function countSentences(text: string): number {
  // scoate math-ul delimitat ca să nu numere punctele din formule
  const noMath = text.replace(/\$[^$]*\$/g, ' M ');
  // punct/!/? care NU e între cifre (3.5) și e urmat de spațiu/final
  const matches = noMath.match(/(?<!\d)[.!?]+(?=\s|$)/g);
  return matches ? matches.length : noMath.trim() ? 1 : 0;
}

const propozitii = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine((v) => countSentences(v) <= max, {
      message: `maxim ${max} propoziți${max === 1 ? 'e' : 'i'}`,
    });

/** o formulă LaTeX scurtă — UNA singură, fără text românesc lung în ea */
const latexScurt = z.string().trim().min(1).max(200);

/** ETAPA 81 FAZA C: registrul de vocabular al blocului (din mastery / comutator). */
export const VOCAB_LEVELS = ['comun', 'punte', 'barem'] as const;
export type VocabLevel = (typeof VOCAB_LEVELS)[number];
const vocabLevel = z.enum(VOCAB_LEVELS);
/** Variante CO-GENERATE ale prozei principale: comutatorul Simplu↔Riguros le
 *  schimbă fără re-apel LLM (C3). Textul de bază = registrul 'comun'/punte implicit. */
const variante = z
  .object({ comun: z.string().max(420).optional(), punte: z.string().max(420).optional(), barem: z.string().max(420).optional() })
  .optional();

export const IntroBlockSchema = z.object({
  tip: z.literal('intro'),
  titlu: z.string().trim().min(1).max(80),
  ideea_mare: propozitii(2).and(z.string().max(280)),
  vocab_level: vocabLevel.optional(),
  variante,
});

export const StepBlockSchema = z.object({
  tip: z.literal('step'),
  titlu_scurt: z.string().trim().min(1).max(60),
  corp: propozitii(3).and(z.string().max(420)),
  /** UNA singură formulă, opțională */
  formula: latexScurt.optional(),
  vocab_level: vocabLevel.optional(),
  variante,
});

export const FormulaBlockSchema = z.object({
  tip: z.literal('formula'),
  latex: latexScurt,
  explicatie: propozitii(1).and(z.string().max(160)),
});

export const ExampleBlockSchema = z.object({
  tip: z.literal('example'),
  enunt: z.string().trim().min(1).max(300),
  pasi: z
    .array(
      z.object({
        text: propozitii(1).and(z.string().max(200)),
        formula: latexScurt.optional(),
      })
    )
    .min(1)
    .max(4),
});

export const QuizBlockSchema = z.object({
  tip: z.literal('quiz'),
  intrebare: z.string().trim().min(1).max(280),
  optiuni: z.object({
    a: z.string().trim().min(1).max(120),
    b: z.string().trim().min(1).max(120),
    c: z.string().trim().min(1).max(120),
    d: z.string().trim().min(1).max(120),
  }),
  /** NU pleacă NICIODATĂ la client — stripat în server înainte de streaming */
  corecta: z.enum(['a', 'b', 'c', 'd']),
  /** ETAPA 70 C: indiciu țintit la prima greșeală (servit DOAR atunci) */
  indiciu: propozitii(1).and(z.string().max(160)).optional(),
  /** ETAPA 70 C: rezolvarea pas-cu-pas, dezvăluită la a doua greșeală */
  rezolvare: z.array(propozitii(1).and(z.string().max(200))).min(1).max(3).optional(),
});

export const TableBlockSchema = z.object({
  tip: z.literal('table'),
  titlu: z.string().trim().max(80).optional(),
  coloane: z.array(z.string().trim().min(1).max(60)).min(2).max(6),
  randuri: z.array(z.array(z.string().trim().max(80)).min(2).max(6)).min(1).max(8),
});

export const FigureBlockSchema = z
  .object({
    tip: z.literal('figure'),
    /** ETAPA 70 B1: 'exercise' = figura exercițiului (figura_autor);
     *  'theory' = figura canonică din registrul theory-figures */
    kind: z.enum(['theory', 'exercise']).default('exercise'),
    exercise_id: z.string().uuid().optional(),
    theory_slug: z.string().trim().min(1).max(120).optional(),
    /** până la ce strat se dezvăluie (FAZA F); lipsă = figura întreagă */
    layer_max: z.number().int().min(0).max(3).optional(),
    legenda: z.string().trim().max(160).optional(),
  })
  .refine((b) => (b.kind === 'exercise' ? !!b.exercise_id : !!b.theory_slug), {
    message: "figure: kind='exercise' cere exercise_id; kind='theory' cere theory_slug",
  });

/** ETAPA 70 B2: AI-ul CERE un grafic de funcție; serverul îl validează
 *  (mathjs whitelist) și îl randează determinist — AI-ul nu desenează nimic. */
export const PlotBlockSchema = z.object({
  tip: z.literal('plot'),
  expr: z.string().trim().min(1).max(120),
  domain: z.tuple([z.number(), z.number()]),
  puncte_marcate: z.array(z.number()).max(6).optional(),
  legenda: z.string().trim().max(160).optional(),
});

/** ETAPA 71 C2: AI-ul INVOCĂ un manipulativ cu parametri; serverul validează
 *  params pe schema kind-ului (lib/lesson/manipulatives) și randează SVG-ul.
 *  De la model params vine ca STRING JSON (limita de grammar) — îl parsăm aici. */
export const ManipulativeBlockSchema = z.object({
  tip: z.literal('manipulative'),
  kind: z.enum(['zaruri', 'monede', 'urna', 'persoane', 'carti', 'dreapta-numerica', 'bare-fractii', 'venn']),
  params: z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  }, z.record(z.string(), z.unknown())),
  legenda: z.string().trim().max(160).optional(),
});

export const RecapBlockSchema = z.object({
  tip: z.literal('recap'),
  puncte: z.array(propozitii(1).and(z.string().max(160))).min(1).max(3),
});

// ═══════════════════ ETAPA 81 FAZA A — BLOCURI INTERACTIVE v2 ═══════════════════
// R5: AI-ul CERE vizualuri cu parametri VALIDAȚI (limite în schemă); motoarele
// deterministe randează; AI-ul nu desenează. Bloc invalid → respins, recerut.

/** Straturi dezvăluite sincron cu pașii lecției (generalizează L0-L3 din 67). */
export const RevealFigureBlockSchema = z
  .object({
    tip: z.literal('reveal_figure'),
    figure_kind: z.enum(['theory', 'exercise']).default('exercise'),
    theory_slug: z.string().trim().min(1).max(120).optional(),
    exercise_id: z.string().uuid().optional(),
    layers: z
      .array(
        z.object({
          step_index: z.number().int().min(0).max(11),
          elements: z.array(z.string().trim().min(1).max(48)).min(1).max(16),
          caption: propozitii(1).and(z.string().max(160)).optional(),
        })
      )
      .min(1)
      .max(8),
    legenda: z.string().trim().max(160).optional(),
    vocab_level: vocabLevel.optional(),
  })
  .refine((b) => (b.figure_kind === 'exercise' ? !!b.exercise_id : !!b.theory_slug), {
    message: "reveal_figure: kind='exercise' cere exercise_id; kind='theory' cere theory_slug",
  });

/** Tabel completat celulă-cu-celulă pe pași (Viète, semn, variație). */
export const ProgressiveTableBlockSchema = z.object({
  tip: z.literal('progressive_table'),
  titlu: z.string().trim().max(80).optional(),
  coloane: z.array(z.string().trim().min(1).max(60)).min(2).max(6),
  randuri: z
    .array(
      z.object({
        cells: z.array(z.string().trim().max(80)).min(2).max(6),
        reveal_at_step: z.number().int().min(0).max(11),
        highlight_cell: z.number().int().min(0).max(5).optional(),
      })
    )
    .min(1)
    .max(10),
  vocab_level: vocabLevel.optional(),
});

/** Manipulativele din 71 + interacțiune TACTILĂ (zar aruncabil, urnă, persoane). */
export const InteractiveManipulativeBlockSchema = z.object({
  tip: z.literal('interactive_manipulative'),
  // subsetul cu interacțiune cu sens (venn/dreapta/bare rămân statice → blocul 'manipulative')
  kind: z.enum(['zaruri', 'monede', 'urna', 'persoane', 'carti']),
  params: z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  }, z.record(z.string(), z.unknown())),
  mode: z.literal('tactile').default('tactile'),
  legenda: z.string().trim().max(160).optional(),
  vocab_level: vocabLevel.optional(),
});

/** Elevul trage parametrul, vede efectul prin plot-ul determinist re-randat. */
export const ParameterSliderBlockSchema = z
  .object({
    tip: z.literal('parameter_slider'),
    /** expresie cu numele parametrului în ea, ex. „a*x^2 + 1" cu param „a" */
    expr_template: z.string().trim().min(1).max(120),
    param: z.string().trim().min(1).max(8),
    /** [min, max, step] */
    range: z.tuple([z.number(), z.number(), z.number()]),
    /** domeniul x al plot-ului (lipsă → [-5,5]) */
    domain: z.tuple([z.number(), z.number()]).optional(),
    /** ce mărime urmărește elevul (vârf, Δ, nr. rădăcini) */
    observe: z.string().trim().min(1).max(80),
    legenda: z.string().trim().max(160).optional(),
    vocab_level: vocabLevel.optional(),
  })
  .refine((b) => b.range[0] < b.range[1] && b.range[2] > 0, { message: 'range invalid: cere [min < max, step > 0]' })
  .refine((b) => b.expr_template.includes(b.param), { message: 'expr_template trebuie să conțină parametrul' });

/** Pasul „încearcă tu": elevul răspunde înainte ca lecția să continue; evaluat
 *  determinist (ETAPA 63); greșit → hint, NU blochează. */
export const TryStepBlockSchema = z.object({
  tip: z.literal('try_step'),
  prompt: z.string().trim().min(1).max(280),
  /** răspunsul corect — verificat determinist cu compareAnswers (NU pleacă la client) */
  expected: z.string().trim().min(1).max(120),
  hint: propozitii(2).and(z.string().max(240)),
  vocab_level: vocabLevel.optional(),
});

/**
 * Schema STRUCTURALĂ pentru model (Output.array element): aceleași forme,
 * FĂRĂ refine-urile de propoziții — refine nu se serializează în JSON Schema,
 * iar validarea SDK per element ar omorî stream-ul la prima limită depășită.
 * Limitele stricte le aplică serverul cu parseLessonBlock; invalidul se recere.
 */
export const LessonBlockModelSchema = z.discriminatedUnion('tip', [
  z.object({ tip: z.literal('intro'), titlu: z.string(), ideea_mare: z.string() }),
  z.object({ tip: z.literal('step'), titlu_scurt: z.string(), corp: z.string(), formula: z.string().optional() }),
  z.object({ tip: z.literal('formula'), latex: z.string(), explicatie: z.string() }),
  z.object({
    tip: z.literal('example'),
    enunt: z.string(),
    pasi: z.array(z.object({ text: z.string(), formula: z.string().optional() })),
  }),
  z.object({
    tip: z.literal('quiz'),
    intrebare: z.string(),
    optiuni: z.object({ a: z.string(), b: z.string(), c: z.string(), d: z.string() }),
    corecta: z.enum(['a', 'b', 'c', 'd']),
    indiciu: z.string().optional(),
    rezolvare: z.array(z.string()).optional(),
  }),
  z.object({
    tip: z.literal('table'),
    titlu: z.string().optional(),
    coloane: z.array(z.string()),
    randuri: z.array(z.array(z.string())),
  }),
  z.object({
    tip: z.literal('figure'),
    kind: z.enum(['theory', 'exercise']).optional(),
    exercise_id: z.string().optional(),
    theory_slug: z.string().optional(),
    layer_max: z.number().optional(),
    legenda: z.string().optional(),
  }),
  z.object({
    tip: z.literal('plot'),
    expr: z.string(),
    domain: z.array(z.number()),
    puncte_marcate: z.array(z.number()).optional(),
    legenda: z.string().optional(),
  }),
  z.object({
    tip: z.literal('manipulative'),
    kind: z.string(),
    // STRING JSON, nu obiect: schema cu chei dinamice/multe opționale nu trece
    // de grammar-ul structured output (limita Anthropic: 24 opționale).
    // Serverul parsează stringul și validează pe schema kind-ului (R5 intact).
    params: z.string(),
    legenda: z.string().optional(),
  }),
  z.object({ tip: z.literal('recap'), puncte: z.array(z.string()) }),
  // ── ETAPA 81 interactiv (model-facing, fără refine; params/JSON ca string) ──
  z.object({
    tip: z.literal('reveal_figure'), figure_kind: z.enum(['theory', 'exercise']).optional(),
    theory_slug: z.string().optional(), exercise_id: z.string().optional(),
    layers: z.array(z.object({ step_index: z.number(), elements: z.array(z.string()), caption: z.string().optional() })),
    legenda: z.string().optional(), vocab_level: z.string().optional(),
  }),
  z.object({
    tip: z.literal('progressive_table'), titlu: z.string().optional(),
    coloane: z.array(z.string()),
    randuri: z.array(z.object({ cells: z.array(z.string()), reveal_at_step: z.number(), highlight_cell: z.number().optional() })),
    vocab_level: z.string().optional(),
  }),
  z.object({
    tip: z.literal('interactive_manipulative'), kind: z.string(), params: z.string(),
    mode: z.string().optional(), legenda: z.string().optional(), vocab_level: z.string().optional(),
  }),
  z.object({
    tip: z.literal('parameter_slider'), expr_template: z.string(), param: z.string(),
    range: z.array(z.number()), domain: z.array(z.number()).optional(), observe: z.string(),
    legenda: z.string().optional(), vocab_level: z.string().optional(),
  }),
  z.object({
    tip: z.literal('try_step'), prompt: z.string(), expected: z.string(), hint: z.string(),
    vocab_level: z.string().optional(),
  }),
]);

// Schemele cu .refine nu pot intra în discriminatedUnion → validate separat în parseLessonBlock.
const NON_FIGURE_SCHEMAS = z.discriminatedUnion('tip', [
  IntroBlockSchema,
  StepBlockSchema,
  FormulaBlockSchema,
  ExampleBlockSchema,
  QuizBlockSchema,
  TableBlockSchema,
  PlotBlockSchema,
  ManipulativeBlockSchema,
  RecapBlockSchema,
  ProgressiveTableBlockSchema,
  InteractiveManipulativeBlockSchema,
  TryStepBlockSchema,
]);

/** blocurile cu .refine (validate prin schema lor specifică, nu prin union) */
const REFINED_SCHEMAS: Record<string, z.ZodTypeAny> = {
  figure: FigureBlockSchema,
  reveal_figure: RevealFigureBlockSchema,
  parameter_slider: ParameterSliderBlockSchema,
};

export type FigureBlock = z.infer<typeof FigureBlockSchema>;
export type PlotBlock = z.infer<typeof PlotBlockSchema>;
export type ManipulativeBlock = z.infer<typeof ManipulativeBlockSchema>;
export type RevealFigureBlock = z.infer<typeof RevealFigureBlockSchema>;
export type ProgressiveTableBlock = z.infer<typeof ProgressiveTableBlockSchema>;
export type InteractiveManipulativeBlock = z.infer<typeof InteractiveManipulativeBlockSchema>;
export type ParameterSliderBlock = z.infer<typeof ParameterSliderBlockSchema>;
export type TryStepBlock = z.infer<typeof TryStepBlockSchema>;
export type LessonBlock = z.infer<typeof NON_FIGURE_SCHEMAS> | FigureBlock | RevealFigureBlock | ParameterSliderBlock;
export type QuizBlock = z.infer<typeof QuizBlockSchema>;
export type LessonBlockClient =
  | Exclude<LessonBlock, QuizBlock | PlotBlock | ManipulativeBlock | TryStepBlock>
  | (Omit<QuizBlock, 'corecta'> & { quiz_id: string })
  /** plotul/manipulativul (static) ajung la client CU svg-ul randat pe server */
  | (PlotBlock & { svg: string })
  | (ManipulativeBlock & { svg: string })
  /** try_step ajunge FĂRĂ `expected` (verificat pe server, ca quiz-ul) + un id */
  | (Omit<TryStepBlock, 'expected'> & { try_id: string });

/**
 * Validează un bloc brut de la model. Întoarce blocul tipizat sau eroarea
 * Zod (folosită pentru re-cerere/log) — niciodată nu aruncă.
 */
export function parseLessonBlock(raw: unknown):
  | { ok: true; block: LessonBlock }
  | { ok: false; error: string } {
  const tip = typeof raw === 'object' && raw !== null ? (raw as { tip?: unknown }).tip : undefined;
  const refined = typeof tip === 'string' ? REFINED_SCHEMAS[tip] : undefined;
  const result = refined ? refined.safeParse(raw) : NON_FIGURE_SCHEMAS.safeParse(raw);
  if (result.success) return { ok: true, block: result.data as LessonBlock };
  const issues = result.error.issues
    .map((i) => `${i.path.join('.') || '(rădăcină)'}: ${i.message}`)
    .join('; ');
  return { ok: false, error: issues };
}

/** quiz-ul către client: fără `corecta`/`indiciu`/`rezolvare` (se servesc DOAR
 *  de mașina de stări la greșeală), cu un id pentru verificarea pe server */
export function stripQuizAnswer(block: QuizBlock, quizId: string): LessonBlockClient {
  const rest: Omit<QuizBlock, 'corecta'> & { corecta?: string; indiciu?: string; rezolvare?: string[] } = { ...block };
  delete rest.corecta;
  delete rest.indiciu;
  delete rest.rezolvare;
  return { ...rest, quiz_id: quizId } as LessonBlockClient;
}

/** try_step către client: FĂRĂ `expected` (verificat pe server, ETAPA 63), cu un id. */
export function stripTryStepAnswer(block: TryStepBlock, tryId: string): LessonBlockClient {
  const rest: Omit<TryStepBlock, 'expected'> & { expected?: string } = { ...block };
  delete rest.expected;
  return { ...rest, try_id: tryId } as LessonBlockClient;
}
