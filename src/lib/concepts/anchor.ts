/**
 * anchor.ts — ETAPA 60 PAS 5: ancorarea chat-ului într-un concept din graf.
 * Teoria vine din concepts.body (max ~2000 chars); exercițiile DOAR dintre cele
 * cu verificare PASS în exercise_verification (nimic neverificat nu ajunge la elev).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AnchorExercise {
  id: string;
  statement: string;
  module: string | null;
  /** id-ul figurii acceptate legate de exercițiu (ETAPA 60 PAS 6), dacă există */
  has_figure: boolean;
}

export interface ConceptAnchor {
  id: string;
  slug: string;
  name: string;
  grade_level: number | null;
  /** teoria din graf, tăiată la maxTheoryChars */
  theory: string;
  exercises: AnchorExercise[];
}

const MAX_THEORY_CHARS = 2000;

export async function getConceptAnchor(
  service: SupabaseClient,
  slug: string,
  maxExercises = 2
): Promise<ConceptAnchor | null> {
  const { data: concept, error } = await service
    .from('concepts')
    .select('id, slug, name, grade_level, body')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !concept) {
    if (error) console.error('[concepts/anchor] lookup failed:', error.message);
    return null;
  }

  // exerciții legate de concept, DOAR cu verificare PASS
  const { data: links, error: linkErr } = await service
    .from('exercise_concept_link')
    .select('exercise_id, rank, similarity')
    .eq('concept_id', concept.id)
    .order('rank', { ascending: true })
    .limit(40);
  if (linkErr) console.error('[concepts/anchor] links failed:', linkErr.message);

  const exerciseIds = [...new Set((links ?? []).map((l) => l.exercise_id as string))];
  const exercises: AnchorExercise[] = [];
  if (exerciseIds.length > 0) {
    const { data: verified } = await service
      .from('exercise_verification')
      .select('exercise_id')
      .in('exercise_id', exerciseIds)
      .eq('verified', true);
    const verifiedSet = new Set((verified ?? []).map((v) => v.exercise_id as string));
    const orderedVerified = exerciseIds.filter((id) => verifiedSet.has(id)).slice(0, maxExercises);

    if (orderedVerified.length > 0) {
      const { data: exRows } = await service
        .from('exercise_raw')
        .select('id, statement, module')
        .in('id', orderedVerified);
      // figurile acceptate legate (coloana figura_autor.exercise_id, PAS 6)
      const { data: figs } = await service
        .from('figura_autor')
        .select('exercise_id')
        .in('exercise_id', orderedVerified)
        .in('status', ['approved', 'auto-acceptat']);
      const figSet = new Set((figs ?? []).map((f) => f.exercise_id as string));
      for (const id of orderedVerified) {
        const row = (exRows ?? []).find((r) => r.id === id);
        if (row) {
          exercises.push({
            id: row.id as string,
            statement: row.statement as string,
            module: (row.module as string | null) ?? null,
            has_figure: figSet.has(id),
          });
        }
      }
    }
  }

  return {
    id: concept.id as string,
    slug: concept.slug as string,
    name: concept.name as string,
    grade_level: (concept.grade_level as number | null) ?? null,
    theory: ((concept.body as string | null) ?? '').slice(0, MAX_THEORY_CHARS),
    exercises,
  };
}

/** Fragmentul de system prompt pentru un chat ancorat în concept. */
export function buildConceptSystemAddendum(anchor: ConceptAnchor): string {
  const exercisesBlock = anchor.exercises.length
    ? anchor.exercises
        .map((e, i) => `Exercițiul ${i + 1} (verificat, ${e.module ?? 'modul necunoscut'}):\n${e.statement}`)
        .join('\n\n')
    : '(nu există exerciții verificate pentru acest concept — lucrează doar pe teorie)';
  return `
---
SESIUNE ANCORATĂ ÎN CONCEPT (din graful programei):
Concept: ${anchor.name} (clasa ${anchor.grade_level ?? '?'}, slug: ${anchor.slug})
Teorie de referință (folosește-o ca sursă de adevăr, nu o contrazice):
${anchor.theory}

Exerciții de lucru (din culegere, cu răspuns VERIFICAT — propune-le în această ordine):
${exercisesBlock}

Reguli pentru această sesiune: rămâi pe acest concept; dacă elevul deviază, readu-l blând la subiect.`;
}

/** Primul mesaj al asistentului (template determinist, ZERO LLM). */
export function buildIntroMessage(anchor: ConceptAnchor): string {
  const theoryExcerpt = anchor.theory.slice(0, 600);
  const first = anchor.exercises[0];
  const intro = `**${anchor.name}** (clasa ${anchor.grade_level ?? '?'})

${theoryExcerpt}${anchor.theory.length > 600 ? '…' : ''}`;
  if (!first) {
    return `${intro}

Pentru acest concept nu am încă exerciții verificate în bibliotecă — putem lucra pe teorie: pune-mi orice întrebare despre el.`;
  }
  const figura = first.has_figure ? `\n\n![Figura exercițiului](/api/figura/${first.id})` : '';
  return `${intro}

Hai să exersăm. Primul exercițiu (verificat din culegere):

> ${first.statement}${figura}

Încearcă să-l rezolvi și scrie-mi pașii tăi — te corectez pe parcurs.`;
}
