/**
 * 15-integrals-parse.ts — ETAPA 14: probă verificare CAS (SymPy) pe integralele Modulului I.
 *
 * Rulează:  npm run extract:verify-integrals
 *
 * (1) Ia din exercise_raw integralele Modulului I (source='culegere_12_2', module='Modulul I').
 *     Pentru fiecare exercițiu/subpunct, convertește enunțul/LaTeX în {integrand, var} parsabil
 *     SymPy, cu claude-sonnet-4-6 (TOOL USE, sarcină mică structurată). Marchează ce nu se parsează.
 * (2) Cheamă scripts/verify/verify_integrals.py (SymPy): F=integrate; self_check = d/dx F==integrand.
 *     Python rulat SEPARAT, date prin JSON pe disc.
 * (3) Scrie rezultatele în exercise_verification (method='cas_sympy_integral'). Idempotent.
 * (4) VERIFICARE din DB + costul părții Claude.
 *
 * NU atinge concepts / concept_edges / exercise_raw.
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
const MODULE = 'Modulul I';
const METHOD = 'cas_sympy_integral';
const PRICE_IN = 3, PRICE_OUT = 15; // $/Mtok (fără batch — apeluri imediate)
const VERIFY_DIR = path.resolve(__dirname, '../verify');
const IN_JSON = path.join(VERIFY_DIR, '_integrals.json');
const OUT_JSON = path.join(VERIFY_DIR, '_integrals_verified.json');
const PROCESSED_JSON = path.join(VERIFY_DIR, '_processed.json'); // cache pt. --resume (evită re-plata Claude)
const PY_SCRIPT = path.join(VERIFY_DIR, 'verify_integrals.py');

const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const SYSTEM_PROMPT =
  'Ești un convertor LaTeX→SymPy pentru integrale nedefinite / primitive (clasa 12, BAC MD). ' +
  'Pentru fiecare subpunct primit, dacă sarcina e să se calculeze o integrală nedefinită SAU o ' +
  'primitivă/antiderivată a unei funcții, extrage INTEGRANDUL ca expresie parsabilă SymPy (sintaxă Python) ' +
  'și variabila. REGULI STRICTE de sintaxă:\n' +
  '- puteri cu **: x**2, x**(1/3) (rădăcina cubică), x**(3/2)\n' +
  '- înmulțire EXPLICITĂ cu *: 3*x, x*exp(x), (x**2+4)*exp(x**3+12*x)\n' +
  '- funcții: sqrt(), exp(), log() (logaritm natural), sin(), cos(), tan(), cot(), asin(), acos(), atan()\n' +
  '- e^x → exp(x); a^x → a**x; tg→tan, ctg→cot; sin^2 x → sin(x)**2; \\dfrac{p}{q} → (p)/(q)\n' +
  '- constante simbolice (m, n, a, b) rămân litere; variabila de integrare e de regulă x.\n' +
  'NU rezolva integrala — dă DOAR integrandul + variabila. Dacă enunțul cere primitiva unei funcții f ' +
  'DATE în enunț iar subpunctele sunt VARIANTE de răspuns (alegere multiplă), pune UN singur item cu ' +
  'subpart="" și integrandul = f din enunț. Dacă un subpunct NU e o integrală/primitivă de calculat ' +
  '(întrebare teoretică, variantă de răspuns fără sens ca integrand), pune parsable=false cu motiv scurt. ' +
  'Înregistrează TOT prin tool-ul record_integrands.';

const TOOL: Anthropic.Messages.Tool = {
  name: 'record_integrands',
  description: 'Înregistrează integrandul SymPy pentru fiecare subpunct (sau pentru exercițiul întreg).',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Câte un item per subpunct, în ordine (sau un singur item cu subpart="" pentru exercițiul întreg).',
        items: {
          type: 'object',
          properties: {
            subpart: { type: 'string', description: 'Litera subpunctului (a/b/c/...) sau "" pentru exercițiul întreg.' },
            parsable: { type: 'boolean', description: 'true dacă există un integrand clar de calculat.' },
            integrand: { type: 'string', description: 'Integrandul ca expresie SymPy (Python), ex. "exp(3*x)". Gol dacă parsable=false.' },
            var: { type: 'string', description: 'Variabila de integrare, de regulă "x".' },
            note: { type: 'string', description: 'Motiv scurt dacă parsable=false; altfel gol.' },
          },
          required: ['subpart', 'parsable', 'integrand', 'var'],
        },
      },
    },
    required: ['items'],
  },
};

interface ExRow { id: string; exercise_number: string; statement: string; subparts: string[] }
interface ModelItem { subpart?: string; parsable?: boolean; integrand?: string; var?: string; note?: string }
interface Processed { exercise_id: string; subpart: string | null; parsable: boolean; integrand: string; var: string; note: string }
interface PyResult { key: string; computed_latex: string | null; verified: boolean | null; note: string; param_used?: boolean }
const METHOD_PARAM = 'self_check_param';
interface VRow { exercise_id: string; subpart: string | null; method: string; computed_latex: string | null; verified: boolean | null; note: string | null }

function buildUserPrompt(ex: ExRow): string {
  const subs = ex.subparts.length
    ? 'Subpuncte:\n' + ex.subparts.map((s) => `  ${s}`).join('\n')
    : '(fără subpuncte — un singur item cu subpart="")';
  return `Enunț: ${ex.statement}\n\n${subs}\n\nReturnează integrandul SymPy pentru fiecare, prin record_integrands.`;
}

async function main() {
  const { values } = parseArgs({ options: { resume: { type: 'boolean' } } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = createClient(url, key);
  fs.mkdirSync(VERIFY_DIR, { recursive: true });

  // 1. Exercițiile Modulului I.
  const { data: exData, error: exErr } = await supabase.from('exercise_raw')
    .select('id, exercise_number, statement, subparts').eq('source', SOURCE).eq('module', MODULE)
    .order('pdf_page').order('exercise_number');
  if (exErr) throw new Error(`exercise_raw: ${exErr.message}`);
  const exercises: ExRow[] = (exData ?? []).map((e) => ({
    id: e.id as string, exercise_number: (e.exercise_number as string) ?? '',
    statement: (e.statement as string) ?? '', subparts: Array.isArray(e.subparts) ? (e.subparts as string[]) : [],
  }));

  // 2. Claude: LaTeX → integrand SymPy. Cu --resume refolosește cache-ul (NU re-plătește Claude).
  let processed: Processed[] = [];
  let totalIn = 0, totalOut = 0, failed = 0;
  const canResume = values.resume && fs.existsSync(PROCESSED_JSON);
  if (canResume) {
    const cache = JSON.parse(fs.readFileSync(PROCESSED_JSON, 'utf-8')) as { processed: Processed[]; totalIn: number; totalOut: number; failed: number };
    processed = cache.processed; totalIn = cache.totalIn; totalOut = cache.totalOut; failed = cache.failed ?? 0;
    console.log(`♻️  --resume: reîncarc ${processed.length} subpuncte din cache (fără re-plată Claude).`);
  } else {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY (rulează cu --env-file=.env.local).');
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    console.log(`🎯 ${MODULE}: ${exercises.length} exerciții → convertesc integranzii cu ${MODEL} (tool use)…`);
    const limit = pLimit(6);
    await Promise.all(exercises.map((ex) => limit(async () => {
      try {
        const msg = await anthropic.messages.create({
          model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
          tools: [TOOL], tool_choice: { type: 'tool', name: 'record_integrands' },
          messages: [{ role: 'user', content: buildUserPrompt(ex) }],
        });
        totalIn += msg.usage.input_tokens; totalOut += msg.usage.output_tokens;
        const tu = msg.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
        const items = (tu?.input as { items?: ModelItem[] } | undefined)?.items ?? [];
        for (const it of items) {
          const subRaw = asStr(it.subpart).replace(/[).]/g, '').toLowerCase();
          processed.push({
            exercise_id: ex.id,
            subpart: subRaw || null,
            parsable: it.parsable === true && !!asStr(it.integrand),
            integrand: asStr(it.integrand),
            var: asStr(it.var) || 'x',
            note: asStr(it.note),
          });
        }
      } catch (err) {
        failed++;
        console.error(`   ⚠ ex ${ex.exercise_number} (${ex.id.slice(0, 8)}): ${(err as Error).message}`);
      }
    })));
    fs.writeFileSync(PROCESSED_JSON, JSON.stringify({ processed, totalIn, totalOut, failed }, null, 2));
  }

  const parsable = processed.filter((p) => p.parsable);
  console.log(`   → ${processed.length} subpuncte procesate · ${parsable.length} parsabile · apeluri eșuate ${failed}`);

  // 3. Scrie input pentru SymPy + rulează Python SEPARAT.
  const keyOf = (p: { exercise_id: string; subpart: string | null }) => `${p.exercise_id}::${p.subpart ?? ''}`;
  fs.mkdirSync(VERIFY_DIR, { recursive: true });
  fs.writeFileSync(IN_JSON, JSON.stringify(parsable.map((p) => ({ key: keyOf(p), task: 'indefinite', integrand: p.integrand, var: p.var })), null, 2));
  console.log(`🐍 Rulez SymPy: python ${path.basename(PY_SCRIPT)} …`);
  const py = spawnSync('python', [PY_SCRIPT, IN_JSON, OUT_JSON], { encoding: 'utf-8' });
  if (py.stderr) process.stderr.write(py.stderr);
  if (py.status !== 0) throw new Error(`Python a eșuat (status ${py.status}). ${py.error?.message ?? ''}`);
  const pyResults: PyResult[] = JSON.parse(fs.readFileSync(OUT_JSON, 'utf-8'));
  const byKey = new Map(pyResults.map((r) => [r.key, r]));

  // 4. Construiește rândurile pentru DB (TOATE subpunctele procesate).
  const rows: VRow[] = processed.map((p) => {
    if (!p.parsable) {
      return { exercise_id: p.exercise_id, subpart: p.subpart, method: METHOD, computed_latex: null, verified: null, note: `NEPARSABIL: ${p.note || 'fără integrand clar'}` };
    }
    const r = byKey.get(keyOf(p));
    return {
      exercise_id: p.exercise_id, subpart: p.subpart,
      method: r?.param_used ? METHOD_PARAM : METHOD, // rescuit prin substituție de parametri → self_check_param
      computed_latex: r?.computed_latex ?? null,
      verified: r?.verified ?? null,
      note: `integrand: ${p.integrand}${r?.note ? ` | ${r.note}` : ''}`,
    };
  });

  // 5. Idempotent: șterge rezultatele acestor metode pentru exercițiile modulului, apoi insert.
  const exIds = [...new Set(processed.map((p) => p.exercise_id))];
  for (let i = 0; i < exIds.length; i += 100) {
    const { error } = await supabase.from('exercise_verification').delete()
      .in('method', [METHOD, METHOD_PARAM]).in('exercise_id', exIds.slice(i, i + 100));
    if (error) throw new Error(`Ștergere: ${error.message}`);
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('exercise_verification').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Insert [${i}]: ${error.message}`);
  }

  // 6. VERIFICARE din DB (peste ambele metode de integrand indefinit).
  const mod1Ids = exercises.map((e) => e.id);
  const METHODS = [METHOD, METHOD_PARAM];
  const q = () => supabase.from('exercise_verification').select('*', { count: 'exact', head: true }).in('method', METHODS).in('exercise_id', mod1Ids);
  const { count: cProcessed } = await q();
  const { count: cParsed } = await q().not('note', 'ilike', 'NEPARSABIL%');
  const { count: cVerified } = await q().is('verified', true);
  const { count: cFalse } = await q().is('verified', false);
  const { count: cParam } = await supabase.from('exercise_verification').select('*', { count: 'exact', head: true }).eq('method', METHOD_PARAM).in('exercise_id', mod1Ids);

  const { data: sample } = await supabase.from('exercise_verification')
    .select('subpart, computed_latex, verified, note, exercise_raw!inner(exercise_number, statement, subparts)')
    .in('method', METHODS).in('exercise_id', mod1Ids).is('verified', true).limit(5);

  const cost = (totalIn / 1e6) * PRICE_IN + (totalOut / 1e6) * PRICE_OUT;
  console.log('\n──────── VERIFICARE CAS (din DB reală) ────────');
  console.log(`${MODULE} · integrand indefinit (method ∈ {${METHODS.join(', ')}})`);
  console.log(`  integrale PROCESATE (subpuncte): ${cProcessed}`);
  console.log(`  PARSATE SymPy:                   ${cParsed}`);
  console.log(`  self_check = TRUE:               ${cVerified}  (din care prin substituție param.: ${cParam})`);
  console.log(`  self_check = FALSE:              ${cFalse}`);
  console.log(`  neparsabile:                     ${(cProcessed ?? 0) - (cParsed ?? 0)}`);
  console.log(`Cost Claude (parsare): in ${totalIn} / out ${totalOut} tok · ~$${cost.toFixed(4)}`);

  console.log('\nEșantion (5 × enunț → F → verificat):');
  for (const s of (sample ?? []) as unknown as Array<{ subpart: string | null; computed_latex: string; note: string; exercise_raw: { exercise_number: string; statement: string; subparts: string[] } }>) {
    const ex = s.exercise_raw;
    const integ = s.note.replace(/^integrand:\s*/, '').split(' |')[0];
    const subTxt = s.subpart ? ` (${s.subpart})` : '';
    console.log(`\n  nr.${ex.exercise_number}${subTxt} · integrand=${integ}`);
    console.log(`    F = ${s.computed_latex}   →  ✅ d/dx F = integrand`);
  }
  console.log('\n✅ Doar exercise_verification. concepts / concept_edges / exercise_raw: neatinse.');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
