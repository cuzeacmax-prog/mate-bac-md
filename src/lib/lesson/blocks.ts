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

export const IntroBlockSchema = z.object({
  tip: z.literal('intro'),
  titlu: z.string().trim().min(1).max(80),
  ideea_mare: propozitii(2).and(z.string().max(280)),
});

export const StepBlockSchema = z.object({
  tip: z.literal('step'),
  titlu_scurt: z.string().trim().min(1).max(60),
  corp: propozitii(3).and(z.string().max(420)),
  /** UNA singură formulă, opțională */
  formula: latexScurt.optional(),
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

export const RecapBlockSchema = z.object({
  tip: z.literal('recap'),
  puncte: z.array(propozitii(1).and(z.string().max(160))).min(1).max(3),
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
  z.object({ tip: z.literal('recap'), puncte: z.array(z.string()) }),
]);

// FigureBlockSchema are .refine → nu poate intra direct în discriminatedUnion;
// îl validăm separat în parseLessonBlock.
const NON_FIGURE_SCHEMAS = z.discriminatedUnion('tip', [
  IntroBlockSchema,
  StepBlockSchema,
  FormulaBlockSchema,
  ExampleBlockSchema,
  QuizBlockSchema,
  TableBlockSchema,
  PlotBlockSchema,
  RecapBlockSchema,
]);

export type FigureBlock = z.infer<typeof FigureBlockSchema>;
export type PlotBlock = z.infer<typeof PlotBlockSchema>;
export type LessonBlock = z.infer<typeof NON_FIGURE_SCHEMAS> | FigureBlock;
export type QuizBlock = z.infer<typeof QuizBlockSchema>;
export type LessonBlockClient =
  | Exclude<LessonBlock, QuizBlock | PlotBlock>
  | (Omit<QuizBlock, 'corecta'> & { quiz_id: string })
  /** plotul ajunge la client CU svg-ul randat pe server */
  | (PlotBlock & { svg: string });

/**
 * Validează un bloc brut de la model. Întoarce blocul tipizat sau eroarea
 * Zod (folosită pentru re-cerere/log) — niciodată nu aruncă.
 */
export function parseLessonBlock(raw: unknown):
  | { ok: true; block: LessonBlock }
  | { ok: false; error: string } {
  const isFigure =
    typeof raw === 'object' && raw !== null && (raw as { tip?: unknown }).tip === 'figure';
  const result = isFigure ? FigureBlockSchema.safeParse(raw) : NON_FIGURE_SCHEMAS.safeParse(raw);
  if (result.success) return { ok: true, block: result.data };
  const issues = result.error.issues
    .map((i) => `${i.path.join('.') || '(rădăcină)'}: ${i.message}`)
    .join('; ');
  return { ok: false, error: issues };
}

/** quiz-ul către client: fără `corecta`, cu un id pentru verificarea pe server */
export function stripQuizAnswer(block: QuizBlock, quizId: string): LessonBlockClient {
  const rest: Omit<QuizBlock, 'corecta'> & { corecta?: string } = { ...block };
  delete rest.corecta;
  return { ...rest, quiz_id: quizId } as LessonBlockClient;
}
