/**
 * index.ts — ETAPA 71 FAZA C2: schema + validarea + randarea manipulativelor.
 *
 * Serverul VALIDEAZĂ params pe schema fiecărui kind (limite, valori legale);
 * invalid → blocul e respins (logat), lecția continuă. AI-ul invocă, nu
 * desenează (R5). Folosit de /api/lesson/start ȘI de acceptanță.
 */
import { z } from 'zod';
import {
  zaruri,
  monede,
  urna,
  persoane,
  carti,
  dreaptaNumerica,
  bareFractii,
  venn,
} from './render';

export const MANIPULATIVE_KINDS = [
  'zaruri', 'monede', 'urna', 'persoane', 'carti', 'dreapta-numerica', 'bare-fractii', 'venn',
] as const;
export type ManipulativeKind = (typeof MANIPULATIVE_KINDS)[number];

const ZaruriSchema = z
  .object({ n: z.number().int().min(1).max(4), fete: z.array(z.number().int().min(1).max(6)).min(1).max(4) })
  .refine((p) => p.fete.length === p.n, { message: 'fete trebuie să aibă exact n valori' });

const MonedeSchema = z
  .object({ n: z.number().int().min(1).max(8), rezultate: z.array(z.enum(['B', 'S'])).max(8).optional() })
  .refine((p) => !p.rezultate || p.rezultate.length === p.n, { message: 'rezultate trebuie să aibă exact n valori' });

const UrnaSchema = z
  .object({
    bile: z
      .array(z.object({ culoare: z.string().trim().min(1).max(12), n: z.number().int().min(1).max(20) }))
      .min(1)
      .max(5),
    extrase: z.array(z.string().trim().min(1).max(12)).max(6).optional(),
  })
  .refine((p) => p.bile.reduce((s, b) => s + b.n, 0) <= 20, { message: 'maxim 20 de bile în urnă' })
  .refine((p) => (p.extrase ?? []).every((c) => p.bile.some((b) => b.culoare === c)), { message: 'extrasele trebuie să fie culori din urnă' });

const PersoaneSchema = z
  .object({
    n: z.number().int().min(1).max(10),
    evidentiati: z.array(z.number().int().min(1).max(10)).max(10).optional(),
    ordonat: z.boolean().optional(),
  })
  .refine((p) => (p.evidentiati ?? []).every((i) => i <= p.n), { message: 'evidențiații trebuie să fie ≤ n' });

const CartiSchema = z
  .object({ n: z.number().int().min(1).max(8), valori: z.array(z.string().trim().min(1).max(4)).max(8).optional() })
  .refine((p) => !p.valori || p.valori.length === p.n, { message: 'valori trebuie să aibă exact n elemente' });

const DreaptaSchema = z
  .object({
    min: z.number().min(-1000).max(1000),
    max: z.number().min(-1000).max(1000),
    puncte: z.array(z.number()).max(10).optional(),
    intervale: z.array(z.object({ de_la: z.number(), pana_la: z.number() })).max(4).optional(),
  })
  .refine((p) => p.max > p.min, { message: 'max trebuie > min' })
  .refine((p) => (p.puncte ?? []).every((v) => v >= p.min && v <= p.max), { message: 'punctele trebuie să fie în [min, max]' })
  .refine((p) => (p.intervale ?? []).every((i) => i.de_la < i.pana_la && i.de_la >= p.min && i.pana_la <= p.max), { message: 'intervale invalide' });

const BareSchema = z
  .object({ numitor: z.number().int().min(2).max(12), evidentiate: z.number().int().min(0).max(12) })
  .refine((p) => p.evidentiate <= p.numitor, { message: 'evidențiate ≤ numitor' });

const VennSchema = z.object({
  eticheta_a: z.string().trim().min(1).max(24),
  eticheta_b: z.string().trim().min(1).max(24),
  zone: z.array(z.enum(['A', 'B', 'AB'])).max(3).optional(),
});

const SCHEMAS: Record<ManipulativeKind, z.ZodTypeAny> = {
  zaruri: ZaruriSchema,
  monede: MonedeSchema,
  urna: UrnaSchema,
  persoane: PersoaneSchema,
  carti: CartiSchema,
  'dreapta-numerica': DreaptaSchema,
  'bare-fractii': BareSchema,
  venn: VennSchema,
};

/** validează params pe schema kind-ului și randează SVG-ul determinist */
export function renderManipulative(
  kind: string,
  params: unknown
): { ok: true; svg: string } | { ok: false; error: string } {
  if (!MANIPULATIVE_KINDS.includes(kind as ManipulativeKind)) {
    return { ok: false, error: `kind necunoscut: ${kind}` };
  }
  const parsed = SCHEMAS[kind as ManipulativeKind].safeParse(params);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(rădăcină)'}: ${i.message}`).join('; ');
    return { ok: false, error: issues };
  }
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const p = parsed.data as any;
    const svg =
      kind === 'zaruri' ? zaruri(p)
      : kind === 'monede' ? monede(p)
      : kind === 'urna' ? urna(p)
      : kind === 'persoane' ? persoane(p)
      : kind === 'carti' ? carti(p)
      : kind === 'dreapta-numerica' ? dreaptaNumerica(p)
      : kind === 'bare-fractii' ? bareFractii(p)
      : venn(p);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return { ok: true, svg };
  } catch (e) {
    return { ok: false, error: `randare eșuată: ${e instanceof Error ? e.message : e}` };
  }
}
