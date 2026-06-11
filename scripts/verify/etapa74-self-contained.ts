/**
 * ETAPA 74 B3 — scanarea exercițiilor NE-AUTONOME (detector pe fraze+structură).
 *
 * Dry-run (default): raport per modul + per clasă de problemă + eșantioane.
 * APPLY=1: marchează self_contained=false în exercise_raw (vederea
 * exercise_servable + pool-ul simulării le exclud automat — migrarea 000022).
 * NU rescrie enunțuri (R5).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa74-self-contained.ts
 *   APPLY=1 npx tsx --env-file=.env.local scripts/verify/etapa74-self-contained.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { selfContainedIssues } from '../../src/lib/content/self-contained';

async function main() {
  const svc = createServiceClient();
  const apply = process.env.APPLY === '1';

  // toate exercițiile cu figură servibilă (aprobate) — partea de „structură"
  const { data: figs, error: fe } = await svc
    .from('figura_autor')
    .select('exercise_id')
    .in('status', ['approved', 'auto-acceptat']);
  if (fe) throw new Error(`figura_autor: ${fe.message}`);
  const figSet = new Set((figs ?? []).map((f) => f.exercise_id as string));

  // tot exercise_raw, paginat
  const flagged: Array<{ id: string; module: string; issues: string[]; excerpt: string }> = [];
  let total = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await svc
      .from('exercise_raw')
      .select('id, module, statement')
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`exercise_raw: ${error.message}`);
    if (!data || data.length === 0) break;
    total += data.length;
    for (const r of data) {
      const issues = selfContainedIssues((r.statement as string) ?? '', figSet.has(r.id as string));
      if (issues.length > 0) {
        flagged.push({
          id: r.id as string,
          module: (r.module as string) ?? '(fără modul)',
          issues,
          excerpt: ((r.statement as string) ?? '').replace(/\s+/g, ' ').slice(0, 140),
        });
      }
    }
    if (data.length < 1000) break;
  }

  // câte dintre cele marcate sunt azi SERVIBILE (impact real)
  const { data: servable } = await svc.from('exercise_servable').select('exercise_id');
  const servableSet = new Set((servable ?? []).map((s) => s.exercise_id as string));
  const flaggedServable = flagged.filter((f) => servableSet.has(f.id));

  console.log(`\n══ ETAPA 74 B3 — exerciții ne-autonome: ${flagged.length}/${total} (${flaggedServable.length} azi servibile) ══`);
  const perModule = new Map<string, number>();
  const perIssue = new Map<string, number>();
  for (const f of flagged) {
    perModule.set(f.module, (perModule.get(f.module) ?? 0) + 1);
    for (const i of f.issues) perIssue.set(i, (perIssue.get(i) ?? 0) + 1);
  }
  console.log('per modul: ', [...perModule.entries()].map(([m, n]) => `${m}: ${n}`).join(' · ') || '—');
  console.log('per clasă: ', [...perIssue.entries()].map(([m, n]) => `${m}: ${n}`).join(' · ') || '—');
  console.log('\neșantioane (max 15):');
  for (const f of flagged.slice(0, 15)) {
    console.log(`  [${f.issues.join(',')}]${servableSet.has(f.id) ? ' [SERVIBIL]' : ''} ${f.excerpt}`);
  }

  if (!apply) {
    console.log('\n(dry-run — rulează cu APPLY=1 ca să marchezi self_contained=false)');
    return;
  }
  const ids = flagged.map((f) => f.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await svc
      .from('exercise_raw')
      .update({ self_contained: false })
      .in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`update: ${error.message}`);
  }
  console.log(`\n✅ ${ids.length} exerciții marcate self_contained=false (excluse din servire prin view).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
