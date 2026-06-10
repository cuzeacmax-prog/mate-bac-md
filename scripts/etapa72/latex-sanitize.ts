/**
 * latex-sanitize.ts — ETAPA 72 P3b: checker + sanitizer pe TOATE body-urile
 * din concepts.
 *
 * Detectează: delimitatori $$ nebalansați; $ singulare nebalansate pe linie;
 * formule suspecte (text românesc înghițit — isSuspectMath).
 * Repară AUTOMAT doar cazul mecanic CERT: număr impar de $$ și ultimul $$
 * deschide un bloc care curge până la FINALUL body-ului → se închide la final.
 * Restul se MARCHEAZĂ în concepts.body_latex_issues (revizuire umană, R5 —
 * nu rescriem conținut matematic din cap).
 *
 *   DRY_RUN=1 npx tsx --env-file=.env.local scripts/etapa72/latex-sanitize.ts
 *            npx tsx --env-file=.env.local scripts/etapa72/latex-sanitize.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { segmentDelimitedMath } from '../../src/lib/content-math';

const DRY = process.env.DRY_RUN === '1';
const RO_DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;

interface Issue {
  slug: string;
  name: string;
  issues: string[];
  autoFixed: boolean;
}

function analyze(body: string): { issues: string[]; fixed: string | null } {
  const issues: string[] = [];
  let fixed: string | null = null;

  const dd = (body.match(/\$\$/g) ?? []).length;
  if (dd % 2 === 1) {
    const lastIdx = body.lastIndexOf('$$');
    const after = body.slice(lastIdx + 2);
    if (!after.includes('$$')) {
      // mecanic CERT: ultimul $$ deschis curge până la final → închidem la final
      issues.push('delimitator $$ neînchis la finalul body-ului (auto-reparat)');
      fixed = body.trimEnd() + '\n$$';
    } else {
      issues.push('număr impar de $$');
    }
  }

  // $ singulare nebalansate per linie (excludem $$ și \$)
  const lines = body.split('\n');
  let oddDollarLines = 0;
  for (const line of lines) {
    const singles = (line.replace(/\$\$/g, '').replace(/\\\$/g, '').match(/\$/g) ?? []).length;
    if (singles % 2 === 1) oddDollarLines++;
  }
  if (oddDollarLines > 0) issues.push(`$ nebalansat pe ${oddDollarLines} linii`);

  // formule care au înghițit proză (pe textul deja reparat, dacă există)
  const segs = segmentDelimitedMath(fixed ?? body);
  const swallowed = segs.filter(
    (s) => s.type === 'text' && s.value.startsWith('$') && RO_DIACRITICS.test(s.value)
  ).length;
  if (swallowed > 0) issues.push(`${swallowed} formule suspecte (proză înghițită — randate defensiv ca text)`);

  return { issues, fixed };
}

async function main() {
  const svc = createServiceClient();
  const all: Array<{ id: string; slug: string; name: string; body: string | null }> = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await svc.from('concepts').select('id, slug, name, body').range(from, from + 499);
    if (error) throw error;
    all.push(...((data ?? []) as typeof all));
    if (!data || data.length < 500) break;
  }
  const withBody = all.filter((c) => (c.body ?? '').trim().length > 0);
  console.log(`concepts: ${all.length} total, ${withBody.length} cu body${DRY ? ' (DRY RUN)' : ''}`);

  const problems: Issue[] = [];
  let autoFixed = 0;
  for (const c of withBody) {
    const { issues, fixed } = analyze(c.body!);
    if (issues.length === 0) continue;
    problems.push({ slug: c.slug, name: c.name, issues, autoFixed: !!fixed });
    if (!DRY) {
      const update: Record<string, unknown> = { body_latex_issues: issues.join('; ') };
      if (fixed) { update.body = fixed; autoFixed++; }
      const { error } = await svc.from('concepts').update(update).eq('id', c.id);
      if (error) console.error(`update ${c.slug}: ${error.message}`);
    } else if (fixed) autoFixed++;
  }

  console.log(`\nbody-uri cu probleme: ${problems.length} / ${withBody.length}`);
  console.log(`auto-reparate (delimitator $$ neînchis la final): ${autoFixed}`);
  console.log(`marcate pentru revizuire (body_latex_issues): ${problems.length}`);
  console.log('\ntop 20 vinovați:');
  for (const p of problems.slice(0, 20)) {
    console.log(`  ${p.slug}${p.autoFixed ? ' [auto-fix]' : ''}: ${p.issues.join('; ')}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
