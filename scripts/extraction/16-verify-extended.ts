/**
 * 16-verify-extended.ts — ETAPA 15: verificare CAS extinsă (primitive + integrale definite + arii/volume).
 *
 * Rulează:
 *   npm run extract:verify-ext -- --module "Modulul I" --retry-failed     # completează: verify_primitive
 *   npm run extract:verify-ext -- --module "Modulul II" --limit 20        # probă definite
 *   npm run extract:verify-ext -- --module "Modulul II"                   # tot modulul
 *
 * Claude (tool use) CLASIFICĂ fiecare subpunct și extrage câmpurile SymPy:
 *   - primitive   : {F, f, var}     → method='verify_primitive'  (d/dx F == f)
 *   - definite    : {integrand,var,lower,upper} → method='definite'   (simbolic vs numeric)
 *   - area_volume : idem definite   → method='area_volume'
 *   - none        : sărit (integralele NEDEFINITE le tratează scriptul 15).
 * SymPy verifică (verify_integrals.py, worker persistent + timeout 8s). param_used → notă.
 *
 * Idempotent pe metodele proprii. NU atinge concepts/concept_edges/exercise_raw. Doar exercise_verification.
 * Requires: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, python+sympy.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;
const SOURCE = 'culegere_12_2';
const PRICE_IN = 3, PRICE_OUT = 15;
const OWN_METHODS = ['verify_primitive', 'definite', 'area_volume', 'rotation_volume'];
const VERIFY_DIR = path.resolve(__dirname, '../verify');
const PY_SCRIPT = path.join(VERIFY_DIR, 'verify_integrals.py');

const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const slug = (m: string) => m.toLowerCase().replace(/[^a-z0-9]+/g, '_');

const SYSTEM_PROMPT =
  'Ești un clasificator+extractor pentru exerciții de ANALIZĂ (clasa 12, BAC MD). Pentru fiecare ' +
  'subpunct, identifică TASK-ul și extrage câmpurile ca expresii SymPy (sintaxă Python). REGULI: ' +
  '** pentru puteri, * înmulțire EXPLICITĂ, funcții sqrt() exp() log()(natural) sin() cos() tan() cot() ' +
  'asin() acos() atan(); pi, sqrt(3); lg = logaritm zecimal = log(arg,10); e^x→exp(x); tg→tan, ctg→cot; ' +
  'sin^2 x→sin(x)**2; \\dfrac{p}{q}→(p)/(q).\n' +
  'TASK-uri:\n' +
  '- "primitive": enunțul cere să se VERIFICE/ALEAGĂ dacă F e primitivă a lui f. Extrage F (funcția ' +
  'candidat din subpunct) și f (din enunț sau subpunct), plus var. Dacă enunțul dă un f COMUN iar ' +
  'subpunctele sunt variante de F, fiecare subpunct → un item cu acel F și f-ul comun.\n' +
  '- "definite": integrală DEFINITĂ ∫_a^b g dx. Extrage integrand=g, var, lower=a, upper=b.\n' +
  '- "area_volume": problemă de ARIE (subgrafic / între curbe) reductibilă la o integrală definită ' +
  'cu integrand+limite clare. Extrage integrand (ex. f-g pentru aria dintre curbe), var, lower, upper.\n' +
  '- "rotation_volume": OBLIGATORIU pentru orice enunț despre VOLUMUL corpului de ROTAȚIE / „rotația ' +
  'în jurul axei Ox" / „corpul de rotație" (NU folosi area_volume pentru acestea!). Formula este ' +
  'V=π·∫_a^b f(x)² dx, dar tu extragi DOAR funcția f în câmpul integrand (FĂRĂ pătrat, FĂRĂ π — le ' +
  'adaugă motorul), plus var, lower, upper.\n' +
  '- "none": orice altceva NEverificabil determinist AICI — în special integralele NEDEFINITE (∫ g dx ' +
  'fără limite), întrebări teoretice, sau date lipsă. (Integralele nedefinite sunt tratate de alt motor.)\n' +
  'Înregistrează TOT prin tool-ul record_tasks.';

const TOOL: Anthropic.Messages.Tool = {
  name: 'record_tasks',
  description: 'Clasifică și extrage câmpurile SymPy pentru fiecare subpunct.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Câte un item per subpunct (sau un singur item cu subpart="" pentru exercițiul întreg).',
        items: {
          type: 'object',
          properties: {
            subpart: { type: 'string', description: 'Litera subpunctului sau "".' },
            task: { type: 'string', enum: ['primitive', 'definite', 'area_volume', 'rotation_volume', 'none'] },
            F: { type: 'string', description: 'primitive: funcția F (candidat). Altfel gol.' },
            f: { type: 'string', description: 'primitive: funcția f. Altfel gol.' },
            integrand: { type: 'string', description: 'definite/area_volume: integrandul g. Altfel gol.' },
            var: { type: 'string', description: 'Variabila, de regulă "x".' },
            lower: { type: 'string', description: 'definite/area_volume: limita inferioară a (SymPy).' },
            upper: { type: 'string', description: 'definite/area_volume: limita superioară b (SymPy).' },
            note: { type: 'string', description: 'Observație scurtă (ex. motiv pentru none).' },
          },
          required: ['subpart', 'task', 'var'],
        },
      },
    },
    required: ['items'],
  },
};

interface ExRow { id: string; exercise_number: string; statement: string; subparts: string[] }
interface ModelItem { subpart?: string; task?: string; F?: string; f?: string; integrand?: string; var?: string; lower?: string; upper?: string; note?: string }
interface Processed { exercise_id: string; subpart: string | null; task: string; F: string; f: string; integrand: string; var: string; lower: string; upper: string; note: string }
interface PyResult { key: string; computed_latex: string | null; verified: boolean | null; note: string; param_used?: boolean }
interface VRow { exercise_id: string; subpart: string | null; method: string; computed_latex: string | null; verified: boolean | null; note: string | null }

function buildUserPrompt(ex: ExRow): string {
  const subs = ex.subparts.length
    ? 'Subpuncte:\n' + ex.subparts.map((s) => `  ${s}`).join('\n')
    : '(fără subpuncte — un singur item cu subpart="")';
  return `Enunț: ${ex.statement}\n\n${subs}\n\nClasifică și extrage prin record_tasks.`;
}

async function main() {
  const { values } = parseArgs({ options: {
    module: { type: 'string' }, limit: { type: 'string' },
    resume: { type: 'boolean' }, 'retry-failed': { type: 'boolean' },
  } });
  const targetModule = values.module;
  if (!targetModule) { console.error('Utilizare: --module "Modulul II" [--limit N] [--retry-failed] [--resume]'); process.exit(1); }
  const limitN = values.limit ? parseInt(values.limit, 10) : undefined;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = createClient(url, key);
  fs.mkdirSync(VERIFY_DIR, { recursive: true });
  const cacheFile = path.join(VERIFY_DIR, `_ext_${slug(targetModule)}.json`);
  const inJson = path.join(VERIFY_DIR, `_ext_${slug(targetModule)}_in.json`);
  const outJson = path.join(VERIFY_DIR, `_ext_${slug(targetModule)}_out.json`);

  // 1. Exercițiile modulului.
  const { data: exData, error: exErr } = await supabase.from('exercise_raw')
    .select('id, exercise_number, statement, subparts').eq('source', SOURCE).eq('module', targetModule)
    .order('pdf_page').order('exercise_number');
  if (exErr) throw new Error(`exercise_raw: ${exErr.message}`);
  let exercises: ExRow[] = (exData ?? []).map((e) => ({
    id: e.id as string, exercise_number: (e.exercise_number as string) ?? '',
    statement: (e.statement as string) ?? '', subparts: Array.isArray(e.subparts) ? (e.subparts as string[]) : [],
  }));
  const allModuleIds = exercises.map((e) => e.id);

  // --retry-failed: doar exercițiile FĂRĂ niciun rând verified=true (completare, cost mic).
  if (values['retry-failed']) {
    const { data: okRows } = await supabase.from('exercise_verification')
      .select('exercise_id').is('verified', true).in('exercise_id', allModuleIds);
    const verified = new Set((okRows ?? []).map((r) => r.exercise_id as string));
    exercises = exercises.filter((e) => !verified.has(e.id));
    console.log(`🔁 --retry-failed: ${exercises.length} exerciții fără verificare reușită încă.`);
  }
  if (limitN !== undefined) exercises = exercises.slice(0, limitN);
  console.log(`🎯 ${targetModule}: ${exercises.length} exerciții → clasific+extrag cu ${MODEL}…`);

  // 2. Claude (cu --resume refolosește cache-ul).
  let processed: Processed[] = [];
  let totalIn = 0, totalOut = 0, failed = 0;
  if (values.resume && fs.existsSync(cacheFile)) {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as { processed: Processed[]; totalIn: number; totalOut: number; failed: number };
    processed = c.processed; totalIn = c.totalIn; totalOut = c.totalOut; failed = c.failed ?? 0;
    console.log(`♻️  --resume: ${processed.length} subpuncte din cache.`);
  } else {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY.');
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const limit = pLimit(6);
    await Promise.all(exercises.map((ex) => limit(async () => {
      try {
        const msg = await anthropic.messages.create({
          model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
          tools: [TOOL], tool_choice: { type: 'tool', name: 'record_tasks' },
          messages: [{ role: 'user', content: buildUserPrompt(ex) }],
        });
        totalIn += msg.usage.input_tokens; totalOut += msg.usage.output_tokens;
        const tu = msg.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
        for (const it of (tu?.input as { items?: ModelItem[] } | undefined)?.items ?? []) {
          processed.push({
            exercise_id: ex.id,
            subpart: asStr(it.subpart).replace(/[).]/g, '').toLowerCase() || null,
            task: asStr(it.task) || 'none',
            F: asStr(it.F), f: asStr(it.f), integrand: asStr(it.integrand),
            var: asStr(it.var) || 'x', lower: asStr(it.lower), upper: asStr(it.upper), note: asStr(it.note),
          });
        }
      } catch (err) {
        failed++;
        console.error(`   ⚠ ex ${ex.exercise_number}: ${(err as Error).message}`);
      }
    })));
    fs.writeFileSync(cacheFile, JSON.stringify({ processed, totalIn, totalOut, failed }, null, 2));
  }

  // 3. Doar task-urile verificabile aici.
  const work = processed.filter((p) => OWN_METHODS.includes(methodOf(p.task)) && hasFields(p));
  const counts = processed.reduce((m, p) => { m[p.task] = (m[p.task] ?? 0) + 1; return m; }, {} as Record<string, number>);
  console.log(`   → ${processed.length} subpuncte · ${JSON.stringify(counts)} · de verificat: ${work.length}`);

  const keyOf = (p: { exercise_id: string; subpart: string | null }) => `${p.exercise_id}::${p.subpart ?? ''}`;
  fs.writeFileSync(inJson, JSON.stringify(work.map((p) => ({
    key: keyOf(p), task: p.task, var: p.var,
    F: p.F, f: p.f, integrand: p.integrand, lower: p.lower, upper: p.upper,
  })), null, 2));
  console.log(`🐍 SymPy: python ${path.basename(PY_SCRIPT)} …`);
  const py = spawnSync('python', [PY_SCRIPT, inJson, outJson], { encoding: 'utf-8' });
  if (py.stderr) process.stderr.write(py.stderr);
  if (py.status !== 0) throw new Error(`Python a eșuat (status ${py.status}). ${py.error?.message ?? ''}`);
  const byKey = new Map((JSON.parse(fs.readFileSync(outJson, 'utf-8')) as PyResult[]).map((r) => [r.key, r]));

  // 4. Rânduri DB.
  const rows: VRow[] = work.map((p) => {
    const r = byKey.get(keyOf(p));
    const detail = p.task === 'primitive' ? `F=${p.F}; f=${p.f}`
      : p.task === 'rotation_volume' ? `V=π·∫_{${p.lower}}^{${p.upper}} (${p.integrand})² d${p.var}`
      : `∫_{${p.lower}}^{${p.upper}} ${p.integrand} d${p.var}`;
    return {
      exercise_id: p.exercise_id, subpart: p.subpart, method: methodOf(p.task),
      computed_latex: r?.computed_latex ?? null, verified: r?.verified ?? null,
      note: `${detail}${r?.param_used ? ' | param-subst' : ''}${r?.note ? ` | ${r.note}` : ''}`,
    };
  });

  // 5. Idempotent pe metodele proprii, pentru exercițiile atinse.
  const touchedIds = [...new Set(work.map((p) => p.exercise_id))];
  for (let i = 0; i < touchedIds.length; i += 100) {
    const { error } = await supabase.from('exercise_verification').delete()
      .in('method', OWN_METHODS).in('exercise_id', touchedIds.slice(i, i + 100));
    if (error) throw new Error(`Ștergere: ${error.message}`);
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('exercise_verification').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Insert [${i}]: ${error.message}`);
  }

  // 6. VERIFICARE din DB (pe metodă).
  console.log('\n──────── VERIFICARE EXTINSĂ (din DB reală) ────────');
  console.log(`${targetModule} · exercise_verification (method ∈ {${OWN_METHODS.join(', ')}})`);
  for (const m of OWN_METHODS) {
    const base = () => supabase.from('exercise_verification').select('*', { count: 'exact', head: true }).eq('method', m).in('exercise_id', allModuleIds);
    const { count: tot } = await base();
    if (!tot) continue;
    const { count: vt } = await base().is('verified', true);
    const { count: vf } = await base().is('verified', false);
    console.log(`  ${m.padEnd(16)} total ${tot} · verified TRUE ${vt} · FALSE ${vf}`);
  }
  const { data: sample } = await supabase.from('exercise_verification')
    .select('subpart, method, computed_latex, verified, note, exercise_raw!inner(exercise_number, statement)')
    .in('method', OWN_METHODS).in('exercise_id', allModuleIds).is('verified', true).limit(5);

  const cost = (totalIn / 1e6) * PRICE_IN + (totalOut / 1e6) * PRICE_OUT;
  console.log(`Cost Claude: in ${totalIn} / out ${totalOut} tok · ~$${cost.toFixed(4)}`);
  console.log('\nEșantion (5 verificate):');
  for (const s of (sample ?? []) as unknown as Array<{ subpart: string | null; method: string; computed_latex: string; note: string; exercise_raw: { exercise_number: string; statement: string } }>) {
    const ex = s.exercise_raw;
    console.log(`\n  [${s.method}] nr.${ex.exercise_number}${s.subpart ? ` (${s.subpart})` : ''}`);
    console.log(`    ENUNȚ: ${ex.statement.slice(0, 80)}`);
    console.log(`    ${s.note.split(' | ')[0]}  →  ✅  rezultat: ${s.computed_latex}`);
  }
  console.log('\n✅ Doar exercise_verification. concepts / concept_edges / exercise_raw: neatinse.');
}

function methodOf(task: string): string {
  return task === 'primitive' ? 'verify_primitive'
    : task === 'definite' ? 'definite'
    : task === 'area_volume' ? 'area_volume'
    : task === 'rotation_volume' ? 'rotation_volume' : 'none';
}
function hasFields(p: Processed): boolean {
  if (p.task === 'primitive') return !!p.F && !!p.f;
  if (p.task === 'definite' || p.task === 'area_volume' || p.task === 'rotation_volume') return !!p.integrand && !!p.lower && !!p.upper;
  return false;
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
