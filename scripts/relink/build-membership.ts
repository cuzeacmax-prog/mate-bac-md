/**
 * ETAPA 61 PAS 1b — construiește concept_family_membership din concept_edges.
 * familia(rădăcină) = {rădăcina} ∪ {X : X depinde tranzitiv de rădăcină}
 * (muchii: from_concept = dependent → to_concept = prerechizit; deci descendenții
 * rădăcinii R se găsesc urmărind INVERS: to=R → from, recursiv).
 * Persistă apartenența (truncate + insert) — artefact auditabil.
 *   npx tsx --env-file=.env.local scripts/relink/build-membership.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { MODULE_CONCEPT_ROOTS, allRootSlugs } from '../../src/lib/library/module-concept-map';

async function main() {
  const svc = createServiceClient();

  // 1) slug→id pentru rădăcini (poarta: toate trebuie să existe)
  const slugs = allRootSlugs();
  const { data: roots, error: rErr } = await svc.from('concepts').select('id, slug').in('slug', slugs);
  if (rErr) { console.error(rErr.message); process.exit(1); }
  const idBySlug = new Map((roots ?? []).map((r) => [r.slug as string, r.id as string]));
  const missing = slugs.filter((s) => !idBySlug.has(s));
  if (missing.length) { console.error('✗ rădăcini inexistente: ' + missing.join(', ')); process.exit(1); }

  // 2) toate muchiile în memorie (3.2k) → adjacență inversă prereq→dependenți
  // PostgREST taie la 1000 rânduri/cerere → paginăm explicit cu range().
  const edges: Array<{ from_concept: string; to_concept: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error: eErr } = await svc
      .from('concept_edges')
      .select('from_concept, to_concept')
      .range(from, from + 999);
    if (eErr) { console.error(eErr.message); process.exit(1); }
    edges.push(...((page ?? []) as Array<{ from_concept: string; to_concept: string }>));
    if (!page || page.length < 1000) break;
  }
  const dependentsOf = new Map<string, string[]>();
  for (const e of edges) {
    const list = dependentsOf.get(e.to_concept) ?? [];
    list.push(e.from_concept);
    dependentsOf.set(e.to_concept, list);
  }
  console.log(`muchii încărcate: ${edges.length}`);
  if (edges.length < 3000) { console.error('✗ prea puține muchii — paginarea a eșuat?'); process.exit(1); }

  // 3) BFS per rădăcină → membri; agregat per modul
  const familyOfRoot = new Map<string, Set<string>>();
  for (const slug of slugs) {
    const rootId = idBySlug.get(slug)!;
    const seen = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const dep of dependentsOf.get(cur) ?? []) {
        if (!seen.has(dep)) { seen.add(dep); queue.push(dep); }
      }
    }
    familyOfRoot.set(slug, seen);
  }

  // 4) persistă (reset + insert)
  const { error: delErr } = await svc.from('concept_family_membership').delete().eq('created_by', 'etapa61');
  if (delErr) { console.error(delErr.message); process.exit(1); }

  let total = 0;
  for (const [module, rootSlugs] of Object.entries(MODULE_CONCEPT_ROOTS)) {
    const rows: Array<{ module: string; concept_id: string; root_slug: string }> = [];
    const dedup = new Set<string>();
    for (const rs of rootSlugs) {
      for (const cid of familyOfRoot.get(rs) ?? []) {
        const key = `${cid}|${rs}`;
        if (dedup.has(key)) continue;
        dedup.add(key);
        rows.push({ module, concept_id: cid, root_slug: rs });
      }
    }
    // insert în loturi de 1000
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await svc.from('concept_family_membership').insert(rows.slice(i, i + 1000));
      if (error) { console.error(`insert ${module}:`, error.message); process.exit(1); }
    }
    const distinctConcepts = new Set(rows.map((r) => r.concept_id)).size;
    console.log(`${module}: ${distinctConcepts} concepte în familie (${rows.length} rânduri rădăcină×concept)`);
    total += rows.length;
  }
  console.log(`✅ membership persistat: ${total} rânduri.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
