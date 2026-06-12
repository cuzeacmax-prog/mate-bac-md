import type { SupabaseClient } from '@supabase/supabase-js';
import { MODULE_DOMAINS } from '@/lib/map/domain-colors';
import { classifyDifficulty } from '@/lib/ai/difficulty';
import { hasUnrenderableMarkdown } from '@/lib/content/markdown-table';

/**
 * ETAPA 78 FAZA E — biblioteca de exerciții SERVIBILE (R5: doar conținutul cu
 * răspuns verificat CAS sau oficial din culegere; restul nu există aici).
 * Dificultatea e clasificatorul determinist din ETAPA 75 (zero LLM) aplicat
 * pe enunț — „accesibil" vs „avansat", etichetă derivată, nu curatoriată.
 */

export interface ExercitiuRow {
  id: string;
  statement: string;
  module: string | null;
  domainKey: string | null;
  domainLabel: string | null;
  tier: 'verificat' | 'sursa-oficiala';
  concept_slug: string | null;
  concept_name: string | null;
  grade_level: number | null;
  has_figure: boolean;
  difficulty: 'accesibil' | 'avansat';
}

export interface ExercitiiFilters {
  domeniu?: string; // cheia domeniului: i, ii, ...
  clasa?: number; // 10 | 11 | 12
  dificultate?: 'accesibil' | 'avansat';
  q?: string;
}

/** normalizare pentru căutare: litere mici, fără diacritice */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** .in() cu sute de UUID-uri sparge limita URL-ului PostgREST → loturi de 150 */
const IN_CHUNK = 150;
async function inChunks<T>(
  ids: string[],
  query: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data, error } = await query(ids.slice(i, i + IN_CHUNK));
    if (error) console.error('[exercitii] chunk query failed:', error.message);
    out.push(...(data ?? []));
  }
  return out;
}

export async function listServableExercises(svc: SupabaseClient): Promise<ExercitiuRow[]> {
  const { data: servable } = await svc.from('exercise_servable').select('exercise_id, tier');
  const ids = (servable ?? []).map((s) => s.exercise_id as string);
  if (ids.length === 0) return [];
  const tierById = new Map(
    (servable ?? []).map((s) => [s.exercise_id as string, s.tier as ExercitiuRow['tier']])
  );

  const [exRows, linkRows, figRows] = await Promise.all([
    inChunks(ids, (chunk) => svc.from('exercise_raw').select('id, statement, module').in('id', chunk)),
    inChunks(ids, (chunk) =>
      svc
        .from('exercise_concept_link')
        .select('exercise_id, rank, concepts(slug, name, grade_level)')
        .in('exercise_id', chunk)
        .order('rank', { ascending: true })
    ),
    inChunks(ids, (chunk) =>
      svc
        .from('figura_autor')
        .select('exercise_id')
        .in('exercise_id', chunk)
        .in('status', ['approved', 'auto-acceptat'])
    ),
  ]);
  const exRes = { data: exRows };
  const linkRes = { data: linkRows };
  const figRes = { data: figRows };

  // primul concept (rank minim) per exercițiu — ținta ancorării
  type LinkRow = {
    exercise_id: string;
    concepts: { slug: string; name: string; grade_level: number | null } | null;
  };
  const conceptByExercise = new Map<string, NonNullable<LinkRow['concepts']>>();
  for (const l of (linkRes.data ?? []) as unknown as LinkRow[]) {
    if (l.concepts && !conceptByExercise.has(l.exercise_id)) {
      conceptByExercise.set(l.exercise_id, l.concepts);
    }
  }
  const figSet = new Set((figRes.data ?? []).map((f) => f.exercise_id as string));

  const rows: ExercitiuRow[] = [];
  for (const ex of exRes.data ?? []) {
    const statement = (ex.statement as string | null) ?? '';
    // enunț nerandabil (markdown rupt) → nu-l servim stricat (regula din daily)
    if (!statement || hasUnrenderableMarkdown(statement)) continue;
    const concept = conceptByExercise.get(ex.id as string) ?? null;
    const moduleName = (ex.module as string | null) ?? null;
    const domain = moduleName ? (MODULE_DOMAINS[moduleName] ?? null) : null;
    rows.push({
      id: ex.id as string,
      statement,
      module: moduleName,
      domainKey: domain?.key ?? null,
      domainLabel: domain?.label ?? moduleName,
      tier: tierById.get(ex.id as string) ?? 'verificat',
      concept_slug: concept?.slug ?? null,
      concept_name: concept?.name ?? null,
      grade_level: concept?.grade_level ?? null,
      has_figure: figSet.has(ex.id as string),
      difficulty: classifyDifficulty(statement, concept?.slug ?? null).level === 'hard' ? 'avansat' : 'accesibil',
    });
  }
  // ordinea: domeniu, apoi clasă, apoi enunț scurt înainte (intrare blândă)
  rows.sort(
    (a, b) =>
      (a.module ?? 'zz').localeCompare(b.module ?? 'zz') ||
      (a.grade_level ?? 99) - (b.grade_level ?? 99) ||
      a.statement.length - b.statement.length
  );
  return rows;
}

export function filterExercises(rows: ExercitiuRow[], f: ExercitiiFilters): ExercitiuRow[] {
  const q = f.q ? norm(f.q) : null;
  return rows.filter((r) => {
    if (f.domeniu && r.domainKey !== f.domeniu) return false;
    if (f.clasa && r.grade_level !== f.clasa) return false;
    if (f.dificultate && r.difficulty !== f.dificultate) return false;
    if (q && !norm(`${r.statement} ${r.concept_name ?? ''}`).includes(q)) return false;
    return true;
  });
}
