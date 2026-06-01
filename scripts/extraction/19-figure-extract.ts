/**
 * 19-figure-extract.ts — ETAPA 25: extractor enunț → FigureSpec2D (PROBĂ pe felie).
 *
 * Rulează:  npm run extract:figures
 *
 * Claude citește enunțul → CLASIFICĂ {figurabil_2d | 3d | fara_figura} → pentru 2D emite o FigureSpec2D
 * prin CONSTRÂNGERI (nu coordonate) → validateSpec (ACELAȘI ca în renderer) → propunere în
 * exercise_figure_spec. ONESTITATE: stereometria 3D (piramidă/con/sferă…) e REFUZATĂ, nu fabricată 2D.
 *
 * NU atinge concepts/concept_edges/exercise_raw/exercise_verification/exercise_concept_link.
 * Requires: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import { validateSpec, type FigureSpec2D } from '../../src/lib/figures/spec';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 3000;
const PRICE_IN = 3, PRICE_OUT = 15;

const SYSTEM_PROMPT =
  'Ești un extractor de FIGURI de geometrie PLANĂ din enunțuri (clasa 12, BAC MD). Întâi CLASIFICI, apoi ' +
  '(doar pentru plan) emiți o FigureSpec2D prin CONSTRÂNGERI. Apelezi DOAR tool-ul record_figure.\n\n' +
  'CLASIFICARE (verdict):\n' +
  "- '3d' = STEREOMETRIE: piramidă, con, sferă, prismă, tetraedru, paralelipiped, cub în spațiu, corp de " +
  'rotație, unghi diedru, plan în spațiu, muchie/față laterală. → spec=null. NU fabrica o figură 2D greșită.\n' +
  "- 'fara_figura' = nu implică un desen plan: algebră, ecuații, logaritmi, combinatorică, probabilitate, " +
  "'pătrat perfect' (= NUMĂR, nu pătrat geometric), șiruri etc. → spec=null.\n" +
  "- 'figurabil_2d' = geometrie PLANĂ: triunghi/patrulater/trapez/romb/pătrat/dreptunghi/cerc în plan, cu " +
  'puncte, laturi, unghiuri, mediane, bisectoare. → emite spec.\n\n' +
  'SCHEMA FigureSpec2D (folosește DOAR aceste kind-uri, NIMIC inventat):\n' +
  '{ points:[{id,x,y,label?}], elements:[…], framing?:{baseEdge?:[id,id]}, intersections?:"detect"|"label-all"|[{of:[ref,ref],label?}] }\n' +
  'points = DOAR dacă enunțul dă coordonate explicite; ALTFEL points:[] și folosește GENERATORI. ref = id de element SAU [idP,idP].\n' +
  '- triangleFromSides {ids:[A,B,C], sides:{AB,BC,CA}}\n' +
  "- quadFromConstraints {ids:[A,B,C,D], angleAt, angle, sideRatio:[r1,r2], scaleBy:{diagonal:'AC'|'BD'|'AB'|'AD', length}}\n" +
  '- polygon {points:[ids], shade?, hatch?}\n' +
  '- segment {between:[a,b], label?, showLength?, id?}\n' +
  '- pointOnSegment {on:[a,b], ratio? | distanceFromA?, label?, id?}\n' +
  '- midpoint {of:[a,b], label?, id?}\n' +
  '- median|bisector|altitude|perpBisector {of:[A,B,C], from:VÂRF, label?, id?, (altitude: markRightAngle?)}\n' +
  '- circle {center, through? | radius?, centerLabel?, id?} · incircle|circumcircle {of:[A,B,C], centerLabel?}\n' +
  "- point {from:'incenter'|'circumcenter'|'centroid'|'orthocenter', of?:[A,B,C], label?, id?}  SAU  point {from:'intersection', of:[ref,ref], label?, id?}\n" +
  "- angle {at, from:[p1,p2], value?:true, reflex?, label?}  SAU  angle {between:[[a,b],[c,d]], value?}  (value:true → motorul afișează gradele)\n" +
  '- rightAngle {at, from:[p1,p2]} · equalAngle {at, from:[p1,p2], count?}\n' +
  '- perpendicular|parallel {through, toSegment:[a,b], id?} · parallelAtDistance {parallelTo:[a,b], offsetFrom, distance, id?}\n' +
  '- tangentLines {from, to:idCerc, pointLabels?} · equalMark|parallelMark {on:[a,b], count?}\n\n' +
  'REGULI: emite CONSTRÂNGERILE din enunț (laturi, unghiuri, rapoarte), NU coordonate inventate. Folosește ' +
  'id-urile din enunț (A,B,C…). Marchează unghiurile date (angle label:"60°" sau value:true). Etichetează ' +
  'punctele construite (M,N,O,E…). Dacă enunțul cere intersecții (diagonale, ceviene), folosește point intersection / intersections.';

const TOOL: Anthropic.Messages.Tool = {
  name: 'record_figure',
  description: 'Înregistrează clasificarea + (pentru 2D) FigureSpec2D extrasă din enunț.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['figurabil_2d', '3d', 'fara_figura'] },
      reason: { type: 'string', description: 'Motiv scurt al clasificării.' },
      spec: {
        type: ['object', 'null'],
        description: 'FigureSpec2D dacă verdict=figurabil_2d; altfel null.',
        properties: {
          points: { type: 'array' },
          elements: { type: 'array' },
          framing: { type: 'object' },
          intersections: {},
        },
      },
    },
    required: ['verdict', 'reason'],
  },
};

interface ExRow { id: string; module: string | null; exercise_number: string; statement: string }
interface ModelOut { verdict?: string; reason?: string; spec?: unknown }
interface VRow { exercise_id: string; spec: unknown; classifier_verdict: string; valid: boolean | null; validation_error: string | null; human_status: null }

async function main() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey) throw new Error('Lipsește ANTHROPIC_API_KEY.');
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = createClient(url, key);

  // 1. Pool: ~14 candidați de geometrie PLANĂ + ~6 stereometrie (ca să PROBĂM refuzul 3D).
  const planeKw = ['triunghi', 'trapez', 'paralelogram', 'romb', 'dreptunghi', 'pătrat', 'patrulater', 'cerc', 'bisect'];
  const orFilter = planeKw.map((k) => `statement.ilike.%${k}%`).join(',');
  const { data: planeData, error: e1 } = await supabase.from('exercise_raw')
    .select('id, module, exercise_number, statement')
    .in('module', ['Modulul VII', 'Modulul IV', 'Modulul III', 'Modulul VIII'])
    .or(orFilter).limit(40);
  if (e1) throw new Error(`pool plan: ${e1.message}`);
  const plane = (planeData ?? []).filter((r) => !/piramid|sfer|prism|tetraedr|cilindr|poliedr|paralelipiped|diedr|volum|rotați/i.test(r.statement as string)).slice(0, 14);
  const { data: solidData, error: e2 } = await supabase.from('exercise_raw')
    .select('id, module, exercise_number, statement').in('module', ['Modulul V', 'Modulul VI']).limit(6);
  if (e2) throw new Error(`pool 3d: ${e2.message}`);
  const pool: ExRow[] = [...plane, ...(solidData ?? [])].map((r) => ({ id: r.id as string, module: (r.module as string | null) ?? null, exercise_number: (r.exercise_number as string) ?? '', statement: (r.statement as string) ?? '' }));
  console.log(`🎯 Pool: ${pool.length} exerciții (${plane.length} plan-candidate + ${(solidData ?? []).length} stereometrie).`);

  // 2. Claude clasifică + (pt. 2D) generează spec.
  const limit = pLimit(5);
  let totalIn = 0, totalOut = 0, failed = 0;
  const rows: VRow[] = [];
  await Promise.all(pool.map((ex) => limit(async () => {
    try {
      const msg = await anthropic.messages.create({
        model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
        tools: [TOOL], tool_choice: { type: 'tool', name: 'record_figure' },
        messages: [{ role: 'user', content: `Enunț:\n${ex.statement}\n\nClasifică și (dacă e plan) extrage FigureSpec2D prin record_figure.` }],
      });
      totalIn += msg.usage.input_tokens; totalOut += msg.usage.output_tokens;
      const tu = msg.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
      const out = (tu?.input ?? {}) as ModelOut;
      const verdict = (out.verdict === 'figurabil_2d' || out.verdict === '3d' || out.verdict === 'fara_figura') ? out.verdict : 'fara_figura';
      let spec: unknown = null, valid: boolean | null = null, err: string | null = null;
      if (verdict === 'figurabil_2d' && out.spec && typeof out.spec === 'object') {
        spec = out.spec;
        try {
          const v = validateSpec(spec as FigureSpec2D);
          valid = v.errors.length === 0;
          err = v.errors.length ? v.errors.join(' · ') : (v.warnings.length ? `(avert.) ${v.warnings.join(' · ')}` : null);
        } catch (ve) { valid = false; err = `validateSpec a aruncat: ${(ve as Error).message}`; }
      }
      rows.push({ exercise_id: ex.id, spec, classifier_verdict: verdict, valid, validation_error: err, human_status: null });
    } catch (e) {
      failed++;
      console.error(`   ⚠ ex ${ex.exercise_number}: ${(e as Error).message}`);
    }
  })));

  // 3. Idempotent: șterge propunerile pool-ului, apoi insert.
  const ids = pool.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from('exercise_figure_spec').delete().in('exercise_id', ids.slice(i, i + 100));
    if (error) throw new Error(`Ștergere: ${error.message}`);
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('exercise_figure_spec').insert(rows.slice(i, i + 200));
    if (error) throw new Error(`Insert [${i}]: ${error.message}`);
  }

  // 4. RAPORT.
  const c2d = rows.filter((r) => r.classifier_verdict === 'figurabil_2d');
  const cValid = c2d.filter((r) => r.valid === true).length;
  const cost = (totalIn / 1e6) * PRICE_IN + (totalOut / 1e6) * PRICE_OUT;
  console.log('\n──────── VERIFICARE EXTRACȚIE FIGURI (din DB reală) ────────');
  console.log(`Procesate: ${rows.length}  ·  apeluri eșuate: ${failed}`);
  console.log(`  figurabil_2d: ${c2d.length}  (din care spec VALID: ${cValid})`);
  console.log(`  3d (refuzat): ${rows.filter((r) => r.classifier_verdict === '3d').length}`);
  console.log(`  fără figură:  ${rows.filter((r) => r.classifier_verdict === 'fara_figura').length}`);
  console.log(`Cost Claude: in ${totalIn} / out ${totalOut} tok · ~$${cost.toFixed(4)}`);

  const exById = new Map(pool.map((p) => [p.id, p]));
  console.log('\nEșantion 2D valide (enunț → kind-uri din spec):');
  for (const r of c2d.filter((x) => x.valid).slice(0, 5)) {
    const ex = exById.get(r.exercise_id);
    const kinds = ((r.spec as FigureSpec2D)?.elements ?? []).map((e) => e.kind).join(', ');
    console.log(`  [${ex?.module} nr.${ex?.exercise_number}] ${ex?.statement.slice(0, 70)}`);
    console.log(`      → ${kinds}`);
  }
  const bad = c2d.filter((x) => x.valid === false);
  if (bad.length) {
    console.log('\n2D INVALIDE (spec respins de validateSpec):');
    for (const r of bad) { const ex = exById.get(r.exercise_id); console.log(`  nr.${ex?.exercise_number}: ${r.validation_error}`); }
  }
  console.log('\n✅ Doar exercise_figure_spec. Restul: neatins.');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
