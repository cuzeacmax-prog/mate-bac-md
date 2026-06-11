/**
 * ETAPA 74 FAZA B1 — RANDARE-AUDIT AUTOMAT (clasa, nu instanța).
 *
 * Randează headless TOT ce se servește elevului prin StatementText/MathText:
 *   1. enunțurile SERVIBILE (exercise_servable → exercise_raw.statement);
 *   2. body-urile conceptelor cu figură de teorie (registrul theory-figures);
 *   3. provocările (daily_challenges → exercițiile alese);
 *   4. itemii de simulare (pool-ul strict-bijectiv din exam.ts).
 *
 * Pipeline-ul e EXACT cel din produs: extractMarkdownTable → segmentDelimitedMath
 * → katex.renderToString (fallback raw la eroare). „Vizibil" = segmentele text +
 * fallback-urile — pe textul vizibil căutăm SCURGERI: \begin{, \[, \hline,
 * |---|, $ rămas, & multiplu.
 *
 * Raport: count per sursă + per clasă de scurgere; lista completă în
 * scripts/verify/_etapa74_render_audit.json.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa74-render-audit.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { createServiceClient } from '../../src/lib/supabase/service';
import { segmentDelimitedMath } from '../../src/lib/content-math';
import { extractMarkdownTable } from '../../src/lib/content/markdown-table';
import { KATEX_MACROS, tabularToArray } from '../../src/lib/content/katex-macros';
import { THEORY_FIGURES } from '../../src/lib/lesson/theory-figures/registry';

interface Leak {
  source: string;
  id: string;
  classes: string[];
  excerpt: string;
}

const LEAK_CLASSES: Array<{ name: string; re: RegExp }> = [
  { name: 'begin{', re: /\\begin\{/ },
  { name: 'display-[', re: /\\\[/ },
  { name: 'hline', re: /\\hline/ },
  { name: '|---|', re: /\|\s*:?-{3,}/ },
  { name: '$-ramas', re: /\$/ },
  // ≥2 ampersanzi pe aceeași linie = aliniere de mediu scursă ca text
  { name: '&-multiplu', re: /^[^\n]*&[^&\n]*&/m },
];

/** ce VEDE elevul după MathText: text + fallback-urile formulelor eșuate */
function mathTextVisible(text: string): string {
  let out = '';
  for (const seg of segmentDelimitedMath(text)) {
    if (seg.type === 'text') {
      out += seg.value;
    } else {
      try {
        katex.renderToString(tabularToArray(seg.value), {
          displayMode: seg.display,
          throwOnError: true,
          strict: false,
          trust: false,
          macros: KATEX_MACROS,
        });
        // randat OK → nu apare în textul vizibil brut
      } catch {
        out += seg.raw ?? seg.value; // fallback-ul din MathText = potențială scurgere
      }
    }
  }
  return out;
}

/** pipeline-ul StatementText: tabelul extras nativ, restul prin MathText */
function statementVisible(text: string): string {
  const t = extractMarkdownTable(text);
  if (!t) return mathTextVisible(text);
  const parts: string[] = [];
  if (t.before) parts.push(mathTextVisible(t.before));
  parts.push(...t.columns.map(mathTextVisible));
  for (const row of t.rows) parts.push(...row.map(mathTextVisible));
  if (t.after) parts.push(mathTextVisible(t.after));
  return parts.join('\n');
}

function leakClasses(visible: string): string[] {
  return LEAK_CLASSES.filter((c) => c.re.test(visible)).map((c) => c.name);
}

async function fetchStatements(
  svc: ReturnType<typeof createServiceClient>,
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await svc
      .from('exercise_raw')
      .select('id, statement')
      .in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`exercise_raw: ${error.message}`);
    for (const r of data ?? []) map.set(r.id as string, (r.statement as string) ?? '');
  }
  return map;
}

async function main() {
  const svc = createServiceClient();
  const leaks: Leak[] = [];
  const counts: Record<string, { total: number; leaky: number; perClass: Record<string, number> }> = {};

  const audit = (source: string, id: string, text: string) => {
    const c = (counts[source] ??= { total: 0, leaky: 0, perClass: {} });
    c.total++;
    const visible = statementVisible(text);
    const classes = leakClasses(visible);
    if (classes.length > 0) {
      c.leaky++;
      for (const cls of classes) c.perClass[cls] = (c.perClass[cls] ?? 0) + 1;
      leaks.push({ source, id, classes, excerpt: visible.replace(/\s+/g, ' ').slice(0, 220) });
    }
  };

  // ── 1) enunțurile servibile ───────────────────────────────────────────────
  const { data: servable, error: e1 } = await svc
    .from('exercise_servable')
    .select('exercise_id, tier');
  if (e1) throw new Error(`exercise_servable: ${e1.message}`);
  const servableIds = (servable ?? []).map((s) => s.exercise_id as string);
  const stmts = await fetchStatements(svc, servableIds);
  for (const id of servableIds) audit('servabile', id, stmts.get(id) ?? '');

  // ── 2) body-urile conceptelor cu figură de teorie ─────────────────────────
  const theorySlugs = Object.keys(THEORY_FIGURES);
  const { data: theoryConcepts, error: e2 } = await svc
    .from('concepts')
    .select('slug, body')
    .in('slug', theorySlugs);
  if (e2) throw new Error(`concepts: ${e2.message}`);
  for (const c of theoryConcepts ?? []) {
    if (c.body) audit('figuri-teorie', c.slug as string, c.body as string);
  }

  // ── 3) provocările (daily_challenges persistate — enunțul EXACT servit) ───
  const { data: dailies, error: e3 } = await svc
    .from('daily_challenges')
    .select('exercises')
    .limit(2000);
  if (e3) throw new Error(`daily_challenges: ${e3.message}`);
  const seen = new Set<string>();
  for (const d of dailies ?? []) {
    for (const ex of (d.exercises as Array<{ exercise_id: string; statement: string }>) ?? []) {
      if (seen.has(ex.exercise_id)) continue;
      seen.add(ex.exercise_id);
      audit('provocari', ex.exercise_id, ex.statement ?? '');
    }
  }

  // ── 4) itemii de simulare (pool-ul strict-bijectiv) ───────────────────────
  const { data: links, error: e4 } = await svc
    .from('exercise_answer_link')
    .select('exercise_id')
    .eq('match_confidence', 'strict-bijectiv');
  if (e4) throw new Error(`exercise_answer_link: ${e4.message}`);
  const examIds = [...new Set((links ?? []).map((l) => l.exercise_id as string))];
  const examStmts = await fetchStatements(svc, examIds.filter((id) => !stmts.has(id)));
  for (const id of examIds) audit('simulare', id, stmts.get(id) ?? examStmts.get(id) ?? '');

  // ── raport ────────────────────────────────────────────────────────────────
  console.log('\n══ RANDARE-AUDIT ETAPA 74 B1 — scurgeri pe textul VIZIBIL ══');
  let totalLeaky = 0;
  for (const [src, c] of Object.entries(counts)) {
    totalLeaky += c.leaky;
    const per = Object.entries(c.perClass).map(([k, v]) => `${k}:${v}`).join('  ') || '—';
    console.log(`  ${src.padEnd(14)} ${String(c.leaky).padStart(4)}/${String(c.total).padEnd(4)} cu scurgeri   [${per}]`);
  }
  const out = join(process.cwd(), 'scripts', 'verify', '_etapa74_render_audit.json');
  writeFileSync(out, JSON.stringify({ counts, leaks }, null, 2));
  console.log(`\nlista completă (${leaks.length} intrări): ${out}`);
  if (totalLeaky > 0) {
    console.log(`\n✗ ${totalLeaky} texte cu scurgeri de randare (per sursă mai sus).`);
    process.exitCode = 2;
  } else {
    console.log('\n✅ 0 scurgeri pe tot ce se servește.');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
