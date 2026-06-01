import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { validateSpec, type FigureSpec2D } from '@/lib/figures/spec';
import { solvePyramid, solvePerpFromVertex, type RegularPyramidSpec, type PerpFromVertexSpec } from '@/lib/figures/spec3d';

/**
 * ETAPA 27/28 — playground live enunț → figură. Admin-gated. FĂRĂ persistare, FĂRĂ căutare în DB:
 * extractorul rulează MEREU pe textul brut primit. Auto-reparare (max 2 runde) dacă validateSpec pică.
 * Diagnostic clar pe cazuri când nu se poate desena. ONESTITATE: 3D fără șablon → spune, nu fabrică.
 */
const MODEL = 'claude-sonnet-4-6';

export const SYSTEM_PROMPT =
  'Ești un extractor de FIGURI din enunțuri de geometrie (BAC MD). Clasifici și (dacă se poate) emiți o ' +
  'specificație, DOAR prin tool-ul record_figure_live.\n\n' +
  'PREFERĂ SĂ DESENEZI: dacă textul descrie o configurație geometrică PLANĂ (chiar parțial), alege ' +
  'figurabil_2d și emite ce poți. Folosește fara_figura DOAR pentru probleme pur algebrice/numerice fără desen.\n\n' +
  'CLASIFICARE:\n' +
  "- 'figurabil_2d' = geometrie PLANĂ (triunghi/patrulater/trapez/romb/pătrat/cerc în plan). Emite spec2d.\n" +
  "- '3d' = STEREOMETRIE. Șabloane disponibile (emite body3d):\n" +
  '    • PIRAMIDĂ REGULATĂ → {kind:"regularPyramid", baseSides, baseEdge, height, labels?}\n' +
  '    • TRIUNGHI în plan + segment PERPENDICULAR pe plan dintr-un vârf (ex. „din A se ridică AM⊥plan”; ' +
  'teorema celor 3 perpendiculare; distanța de la un punct la o dreaptă/latură) → ' +
  '{kind:"perpFromVertex", triangle:{sides:{AB,BC,CA}}, apexFrom, apexHeight, apexLabel?, labels?}. ' +
  'Calculează laturile din date (triunghi echilateral cu aria S → latura = sqrt(4·S/√3); ex. arie 4√3 → latura 4).\n' +
  '    Pentru ORICE alt corp (con/sferă/prismă/cub/piramidă neregulată…) NU emite body3d — pune body3d_name = tipul corpului.\n' +
  "- 'fara_figura' = fără desen (algebră, ecuații, combinatorică, probabilitate, „pătrat perfect” = număr).\n\n" +
  'SCHEMA spec2d (DOAR aceste kind-uri, constrângeri NU coordonate inventate):\n' +
  '{ points:[{id,x,y,label?}], elements:[…], intersections?:"detect"|"label-all"|[{of:[ref,ref],label?}] }\n' +
  'REGULĂ: `points` e GOL ([]) când nu există coordonate explicite — vârfurile vin din `ids`/`labels` ale generatorilor.\n' +
  '- triangleFromSides {ids:[A,B,C], sides:{AB,BC,CA}} (cheile EXACT AB, BC, CA — laturile A-B, B-C, C-A; NU „AC”) · quadFromConstraints {ids:[A,B,C,D], angleAt, angle, sideRatio:[r1,r2], scaleBy:{diagonal:"AC"|"BD"|"AB"|"AD", length}}\n' +
  '- polygon {points:[ids], shade?, hatch?} · segment {between:[a,b], label?, showLength?, id?} · midpoint {of:[a,b], label?, id?}\n' +
  '- pointOnSegment {on:[a,b], ratio?|distanceFromA?, label?, id?} · median|bisector|altitude|perpBisector {of:[A,B,C], from, label?, id?}\n' +
  '- circle {center, through?|radius?, centerLabel?, id?} · incircle|circumcircle {of:[A,B,C], centerLabel?}\n' +
  '- point {from:"incenter"|"circumcenter"|"centroid"|"orthocenter", of?:[A,B,C], label?, id?} · point {from:"intersection", of:[ref,ref], label?, id?}\n' +
  '- angle {at, from:[p1,p2], value?:true, label?} · rightAngle {at, from:[p1,p2]} · equalAngle {at, from, count?}\n' +
  '- perpendicular|parallel {through, toSegment:[a,b], id?} · parallelAtDistance {parallelTo:[a,b], offsetFrom, distance, id?}\n' +
  '- equalMark|parallelMark {on:[a,b], count?} · tangentLines {from, to:idCerc, pointLabels?}\n' +
  'ref = id de element SAU [idP,idP]. Dacă o relație cerută NU se poate exprima cu kind-urile de mai sus, ' +
  'pune unsupported_relation = descrierea ei (și emite restul figurii ce se poate).\n\n' +
  'EXEMPLE (enunț → spec2d):\n' +
  '1) „Triunghi ABC cu AB=7, BC=8, CA=9; mediana din A.” → {"points":[],"elements":[' +
  '{"kind":"triangleFromSides","ids":["A","B","C"],"sides":{"AB":7,"BC":8,"CA":9}},' +
  '{"kind":"polygon","points":["A","B","C"]},{"kind":"median","of":["A","B","C"],"from":"A"}]}\n' +
  '2) „Paralelogram ABCD, ∠A=60°, AB:AD=1:2, BD=3.” → {"points":[],"elements":[' +
  '{"kind":"quadFromConstraints","ids":["A","B","C","D"],"angleAt":"A","angle":60,"sideRatio":[1,2],"scaleBy":{"diagonal":"BD","length":3}},' +
  '{"kind":"polygon","points":["A","B","C","D"]},{"kind":"segment","between":["B","D"],"label":"BD"},' +
  '{"kind":"angle","at":"A","from":["B","D"],"value":true}]}\n' +
  '3) „Triunghi ABC (6,7,8) cu cercul înscris.” → {"points":[],"elements":[' +
  '{"kind":"triangleFromSides","ids":["A","B","C"],"sides":{"AB":6,"BC":7,"CA":8}},' +
  '{"kind":"polygon","points":["A","B","C"]},{"kind":"incircle","of":["A","B","C"],"centerLabel":"I"}]}';

export const TOOL: Anthropic.Messages.Tool = {
  name: 'record_figure_live',
  description: 'Clasifică enunțul și emite spec2d (2D) / body3d (piramidă regulată) / body3d_name (3D fără șablon).',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['figurabil_2d', '3d', 'fara_figura'] },
      reason: { type: 'string' },
      spec2d: { type: ['object', 'null'], properties: { points: { type: 'array' }, elements: { type: 'array' }, intersections: {} } },
      body3d: {
        type: ['object', 'null'],
        properties: {
          kind: { type: 'string', enum: ['regularPyramid', 'perpFromVertex'] },
          baseSides: { type: 'integer' }, baseEdge: { type: 'number' }, height: { type: 'number' },
          labels: { type: 'array', items: { type: 'string' } },
          triangle: { type: 'object', properties: { sides: { type: 'object', properties: { AB: { type: 'number' }, BC: { type: 'number' }, CA: { type: 'number' } } } } },
          apexFrom: { type: 'string' }, apexHeight: { type: 'number' }, apexLabel: { type: 'string' },
        },
      },
      body3d_name: { type: 'string', description: 'Tipul corpului 3D când NU e piramidă regulată.' },
      unsupported_relation: { type: 'string', description: 'Relație 2D care nu se poate exprima cu kind-urile date.' },
    },
    required: ['verdict', 'reason'],
  },
};

type Body3DOut = (RegularPyramidSpec | PerpFromVertexSpec) & { kind?: string };
interface ModelOut { verdict?: string; reason?: string; spec2d?: unknown; body3d?: Body3DOut | null; body3d_name?: string; unsupported_relation?: string }

async function callTool(anthropic: Anthropic, userContent: string): Promise<ModelOut> {
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 3000, system: SYSTEM_PROMPT,
    tools: [TOOL], tool_choice: { type: 'tool', name: 'record_figure_live' },
    messages: [{ role: 'user', content: userContent }],
  });
  const tu = msg.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
  return (tu?.input ?? {}) as ModelOut;
}

function check(spec: unknown): { valid: boolean; error: string | null } {
  try { const v = validateSpec(spec as FigureSpec2D); return { valid: v.errors.length === 0, error: v.errors.join(' · ') || null }; }
  catch (e) { return { valid: false, error: `validateSpec: ${(e as Error).message}` }; }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  let body: { text?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 4000) : '';
  if (!text) return NextResponse.json({ error: 'Lipsește enunțul.' }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Lipsește ANTHROPIC_API_KEY.' }, { status: 500 });

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // Rulează MEREU extractorul pe textul brut (fără căutare în DB).
    const out = await callTool(anthropic, `Enunț:\n${text}\n\nClasifică și extrage prin record_figure_live.`);
    const verdict = out.verdict ?? 'fara_figura';
    const reason = out.reason ?? '';
    const unsupportedRelation = out.unsupported_relation || null;

    if (verdict === 'figurabil_2d' && out.spec2d && typeof out.spec2d === 'object') {
      let spec = out.spec2d;
      let { valid, error } = check(spec);
      let repaired = 0;
      // AUTO-REPARARE: max 2 runde, retrimite specul + eroarea exactă.
      while (!valid && repaired < 2) {
        repaired++;
        const fix = await callTool(anthropic,
          `Enunț:\n${text}\n\nSpecul tău anterior A PICAT validarea cu erorile:\n${error}\n\n` +
          `Specul anterior:\n${JSON.stringify(spec)}\n\nCorectează-l (DOAR aceleași kind-uri, verdict="figurabil_2d") și re-emite prin record_figure_live.`);
        if (fix.spec2d && typeof fix.spec2d === 'object') { spec = fix.spec2d; ({ valid, error } = check(spec)); }
        else break;
      }
      const diagnostic = valid ? null : `validare eșuată după reparare (${repaired} runde): ${error}`;
      return NextResponse.json({ dim: '2d', verdict, reason, spec, valid, error, repaired, unsupportedRelation, diagnostic });
    }

    if (verdict === '3d') {
      const b = out.body3d;
      if (b && b.kind === 'regularPyramid') {
        try { solvePyramid(b as RegularPyramidSpec); return NextResponse.json({ dim: '3d', verdict, reason, spec: { body: b }, valid: true, error: null }); }
        catch (e) { return NextResponse.json({ dim: '3d', verdict, reason, valid: false, error: (e as Error).message, diagnostic: `parametri 3D invalizi: ${(e as Error).message}` }); }
      }
      if (b && b.kind === 'perpFromVertex') {
        try { solvePerpFromVertex(b as PerpFromVertexSpec); return NextResponse.json({ dim: '3d', verdict, reason, spec: { body: b }, valid: true, error: null }); }
        catch (e) { return NextResponse.json({ dim: '3d', verdict, reason, valid: false, error: (e as Error).message, diagnostic: `parametri 3D invalizi: ${(e as Error).message}` }); }
      }
      const name = out.body3d_name || 'necunoscut';
      return NextResponse.json({ dim: '3d', verdict, reason, unsupported: true, message: `3D detectat — corpul „${name}” nu are șablon (avem doar piramida regulată).`, diagnostic: `3D detectat — corpul „${name}” nu are șablon` });
    }

    if (unsupportedRelation) {
      return NextResponse.json({ dim: 'none', verdict, reason, message: `Relație neacoperită: ${unsupportedRelation}`, diagnostic: `relație neacoperită: ${unsupportedRelation}` });
    }
    return NextResponse.json({ dim: 'none', verdict: 'fara_figura', reason, message: `Fără figură${reason ? `: ${reason}` : ''}.`, diagnostic: `fără figură${reason ? `: ${reason}` : ''}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
