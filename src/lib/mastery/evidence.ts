/**
 * evidence.ts — ETAPA 60: scrierea evidenței în concept_mastery.
 *
 * Formula (simplă, documentată, NU pretins-științifică):
 *   medie exponențială cu α = 0.3:
 *     mastery_nou = mastery_vechi + α · (țintă − mastery_vechi)
 *   unde țintă = 1 pentru răspuns corect, 0 pentru greșit.
 *   Rând nou pornește de la mastery_vechi = 0.
 *   Exemple: corect din 0 → 0.3; două corecte → 0.51; corect apoi greșit → 0.21.
 *
 * Pentru source='chat' fără corectitudine evaluată (correct === null):
 *   mastery NU se modifică (nu inventăm cunoaștere) — se incrementează doar
 *   evidence_count/last_evidence_at/source, ca urmă de expunere.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const MASTERY_ALPHA = 0.3;

export type EvidenceSource = 'diagnostic' | 'chat' | 'exercise';

interface ConceptRef { id: string; slug: string }

// Cache slug→id per proces (conceptele nu se schimbă în timpul unui deploy).
let slugCache: Map<string, string> | null = null;

async function resolveSlugs(
  service: SupabaseClient,
  slugs: string[]
): Promise<ConceptRef[]> {
  if (slugs.length === 0) return [];
  if (!slugCache) slugCache = new Map();
  const missing = slugs.filter((s) => !slugCache!.has(s));
  if (missing.length > 0) {
    const { data, error } = await service
      .from('concepts')
      .select('id, slug')
      .in('slug', missing);
    if (error) {
      console.error('[mastery/evidence] concepts lookup failed:', error.message);
      return [];
    }
    for (const row of data ?? []) slugCache.set(row.slug as string, row.id as string);
  }
  const resolved: ConceptRef[] = [];
  for (const s of slugs) {
    const id = slugCache.get(s);
    if (id) resolved.push({ id, slug: s });
    else console.error(`[mastery/evidence] slug inexistent în concepts, sărit (NU se inventează evidență): ${s}`);
  }
  return resolved;
}

/**
 * Scrie evidență pentru o listă de concepte (prin slug).
 * @param correct true/false → EMA spre 1/0; null → doar urmă de expunere (mastery neschimbat).
 */
export async function recordConceptEvidence(
  service: SupabaseClient,
  userId: string,
  conceptSlugs: string[],
  correct: boolean | null,
  source: EvidenceSource
): Promise<{ written: number; skipped: string[] }> {
  const concepts = await resolveSlugs(service, conceptSlugs);
  const skipped = conceptSlugs.filter((s) => !concepts.some((c) => c.slug === s));
  let written = 0;

  for (const c of concepts) {
    const { data: existing, error: readErr } = await service
      .from('concept_mastery')
      .select('mastery, evidence_count, source')
      .eq('user_id', userId)
      .eq('concept_id', c.id)
      .maybeSingle();
    if (readErr) {
      console.error('[mastery/evidence] read failed:', readErr.message);
      continue;
    }

    const old = (existing?.mastery as number | undefined) ?? 0;
    const target = correct === null ? old : correct ? 1 : 0;
    const next = correct === null ? old : old + MASTERY_ALPHA * (target - old);
    const sources = new Set<string>((existing?.source as string[] | undefined) ?? []);
    sources.add(source);

    const { error: upErr } = await service.from('concept_mastery').upsert(
      {
        user_id: userId,
        concept_id: c.id,
        mastery: Math.min(1, Math.max(0, next)),
        evidence_count: ((existing?.evidence_count as number | undefined) ?? 0) + 1,
        last_evidence_at: new Date().toISOString(),
        source: Array.from(sources),
      },
      { onConflict: 'user_id,concept_id' }
    );
    if (upErr) console.error('[mastery/evidence] upsert failed:', upErr.message);
    else written++;
  }
  return { written, skipped };
}
