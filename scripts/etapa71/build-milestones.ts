/**
 * build-milestones.ts — ETAPA 71 A1: generează PROPUNEREA de borne
 * (src/lib/map/milestones.ts) din semnale existente. Regula în 3 rânduri
 * (documentată și în fișierul generat):
 *   1. concept de clasa 10 → Baza (fundament pentru nota 5-6);
 *   2. concept de liceu cu ≥3 exerciții servibile → Solid (frecvent la BAC, 7-8);
 *   3. restul → Performanță (avansat sau rar în culegere, 9-10).
 * NICIUN coeficient — doar pragul de frecvență 3, vizibil aici.
 *
 *   npx tsx --env-file=.env.local scripts/etapa71/build-milestones.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServiceClient } from '../../src/lib/supabase/service';

const SERVABLE_SOLID_MIN = 3;

async function main() {
  const svc = createServiceClient();

  // conceptele domeniilor (harta ETAPA 61) + clasa
  const { data: membership } = await svc
    .from('concept_family_membership')
    .select('module, concepts(id, slug, name, grade_level)')
    .limit(2000);

  // exerciții servibile per concept (prin linkuri)
  const { data: serv } = await svc.from('exercise_servable').select('exercise_id').limit(20000);
  const servIds = new Set((serv ?? []).map((s) => s.exercise_id as string));
  const servableByConcept = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data: links } = await svc
      .from('exercise_concept_link')
      .select('exercise_id, concepts(slug)')
      .range(from, from + 999);
    for (const l of links ?? []) {
      const slug = (l.concepts as unknown as { slug: string } | null)?.slug;
      if (slug && servIds.has(l.exercise_id as string)) {
        servableByConcept.set(slug, (servableByConcept.get(slug) ?? 0) + 1);
      }
    }
    if (!links || links.length < 1000) break;
  }

  type Row = { slug: string; name: string; grade: number | null; servable: number; borna: string };
  const byModule = new Map<string, Row[]>();
  const seen = new Set<string>();
  for (const m of membership ?? []) {
    const c = m.concepts as unknown as { slug: string; name: string; grade_level: number | null } | null;
    if (!c || seen.has(`${m.module}|${c.slug}`)) continue;
    seen.add(`${m.module}|${c.slug}`);
    const servable = servableByConcept.get(c.slug) ?? 0;
    const borna =
      (c.grade_level ?? 12) <= 10 ? 'baza'
      : servable >= SERVABLE_SOLID_MIN ? 'solid'
      : 'performanta';
    const arr = byModule.get(m.module as string) ?? [];
    arr.push({ slug: c.slug, name: c.name, grade: c.grade_level, servable, borna });
    byModule.set(m.module as string, arr);
  }

  const modules = [...byModule.keys()].sort();
  let entries = '';
  let tables = '';
  const emitted = new Set<string>();
  for (const mod of modules) {
    const rows = byModule.get(mod)!.sort((a, b) => a.slug.localeCompare(b.slug));
    tables += ` * ${mod} (${rows.length} concepte):\n`;
    tables += ` * | concept | clasa | servibile | bornă |\n * |---|---|---|---|\n`;
    for (const r of rows) tables += ` * | ${r.slug} | ${r.grade ?? '?'} | ${r.servable} | ${r.borna} |\n`;
    tables += ' *\n';
    entries += `  // ── ${mod} ──\n`;
    for (const r of rows) {
      if (emitted.has(r.slug)) {
        entries += `  // '${r.slug}' apare și aici (bornă definită mai sus)\n`;
        continue;
      }
      emitted.add(r.slug);
      entries += `  '${r.slug}': '${r.borna}',\n`;
    }
  }

  const file = `/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  REVIZUIRE UMANĂ NECESARĂ (Maxim) — bornele hărții cunoașterii (E71 A1)  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Borne: 'baza' (nota 5-6) < 'solid' (7-8) < 'performanta' (9-10).
 * PROPUNERE AUTOMATĂ din semnale existente — regula, în 3 rânduri:
 *   1. concept de clasa 10 → baza (fundament);
 *   2. concept de liceu cu ≥${SERVABLE_SOLID_MIN} exerciții servibile → solid (frecvent la BAC);
 *   3. restul → performanta (avansat sau rar în culegere).
 * Fără coeficienți pretins-științifici. Corectează direct valorile de mai jos;
 * poarta \`npm run verify:milestones\` validează fișierul contra grafului.
 *
 * Tabelul per domeniu (generat ${new Date().toISOString().slice(0, 10)}):
${tables} * Regenerare propunere: npx tsx --env-file=.env.local scripts/etapa71/build-milestones.ts
 */

export type Milestone = 'baza' | 'solid' | 'performanta';

export const MILESTONE_LABELS: Record<Milestone, string> = {
  baza: 'Baza (5-6)',
  solid: 'Solid (7-8)',
  performanta: 'Performanță (9-10)',
};

export const CONCEPT_MILESTONES: Record<string, Milestone> = {
${entries}};

export function milestoneOf(slug: string): Milestone | null {
  return CONCEPT_MILESTONES[slug] ?? null;
}
`;
  mkdirSync(join(process.cwd(), 'src', 'lib', 'map'), { recursive: true });
  const out = join(process.cwd(), 'src', 'lib', 'map', 'milestones.ts');
  writeFileSync(out, file, 'utf8');
  const total = [...byModule.values()].reduce((s, r) => s + r.length, 0);
  console.log(`scris ${out}: ${total} concepte în ${modules.length} domenii`);
  for (const mod of modules) {
    const rows = byModule.get(mod)!;
    const c = (b: string) => rows.filter((r) => r.borna === b).length;
    console.log(`  ${mod}: ${rows.length} (baza=${c('baza')}, solid=${c('solid')}, performanta=${c('performanta')})`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
