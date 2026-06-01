import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { validateSpec, type FigureSpec2D } from '@/lib/figures/spec';
import { solvePyramid, type RegularPyramidSpec } from '@/lib/figures/spec3d';

/**
 * ETAPA 27 — playground live enunț → figură. Admin-gated. FĂRĂ persistare (DB neatins).
 * Claude clasifică {2d|3d|fara} → spec → validare. ONESTITATE: 3D fără șablon → spune clar, nu fabrica.
 */
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT =
  'Ești un extractor de FIGURI din enunțuri de geometrie (BAC MD). Clasifici și (dacă se poate) emiți o ' +
  'specificație, DOAR prin tool-ul record_figure_live.\n\n' +
  'CLASIFICARE:\n' +
  "- 'figurabil_2d' = geometrie PLANĂ (triunghi/patrulater/trapez/romb/pătrat/cerc în plan). Emite spec2d.\n" +
  "- '3d' = STEREOMETRIE (piramidă, con, sferă, prismă, cub, cilindru, tetraedru…). Dacă e o PIRAMIDĂ " +
  'REGULATĂ (bază poligon regulat + înălțime), emite body3d {kind:"regularPyramid", baseSides, baseEdge, height, ' +
  'labels?}. ALTFEL (con/sferă/prismă/piramidă neregulată…) NU emite body3d — pune doar body3d_name = tipul corpului.\n' +
  "- 'fara_figura' = fără desen (algebră, ecuații, combinatorică, probabilitate, „pătrat perfect” = număr).\n\n" +
  'SCHEMA spec2d (DOAR aceste kind-uri, constrângeri NU coordonate inventate):\n' +
  '{ points:[{id,x,y,label?}], elements:[…], intersections?:"detect"|"label-all"|[{of:[ref,ref],label?}] }\n' +
  'REGULĂ: `points` e GOL ([]) când nu există coordonate explicite în enunț — NU pune nume de vârf ca string acolo; ' +
  'vârfurile vin din `ids`/`labels` ale generatorilor.\n' +
  '- triangleFromSides {ids:[A,B,C], sides:{AB,BC,CA}}  (cheile EXACT AB, BC, CA — laturile A-B, B-C, C-A; NU folosi „AC”) · quadFromConstraints {ids:[A,B,C,D], angleAt, angle, sideRatio:[r1,r2], scaleBy:{diagonal:"AC"|"BD"|"AB"|"AD", length}}\n' +
  '- polygon {points:[ids], shade?, hatch?} · segment {between:[a,b], label?, showLength?, id?} · midpoint {of:[a,b], label?, id?}\n' +
  '- pointOnSegment {on:[a,b], ratio?|distanceFromA?, label?, id?} · median|bisector|altitude|perpBisector {of:[A,B,C], from, label?, id?}\n' +
  '- circle {center, through?|radius?, centerLabel?, id?} · incircle|circumcircle {of:[A,B,C], centerLabel?}\n' +
  '- point {from:"incenter"|"circumcenter"|"centroid"|"orthocenter", of?:[A,B,C], label?, id?} · point {from:"intersection", of:[ref,ref], label?, id?}\n' +
  '- angle {at, from:[p1,p2], value?:true, label?} · rightAngle {at, from:[p1,p2]} · equalAngle {at, from, count?}\n' +
  '- perpendicular|parallel {through, toSegment:[a,b], id?} · parallelAtDistance {parallelTo:[a,b], offsetFrom, distance, id?}\n' +
  '- equalMark|parallelMark {on:[a,b], count?} · tangentLines {from, to:idCerc, pointLabels?}\n' +
  'ref = id de element SAU [idP,idP]. Folosește id-urile din enunț (A,B,C…), marchează unghiurile date.';

const TOOL: Anthropic.Messages.Tool = {
  name: 'record_figure_live',
  description: 'Clasifică enunțul și emite spec2d (2D) sau body3d (piramidă regulată) sau body3d_name (3D fără șablon).',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['figurabil_2d', '3d', 'fara_figura'] },
      reason: { type: 'string' },
      spec2d: { type: ['object', 'null'], properties: { points: { type: 'array' }, elements: { type: 'array' }, intersections: {} } },
      body3d: {
        type: ['object', 'null'],
        properties: {
          kind: { type: 'string', enum: ['regularPyramid'] },
          baseSides: { type: 'integer' }, baseEdge: { type: 'number' }, height: { type: 'number' },
          labels: { type: 'array', items: { type: 'string' } },
        },
      },
      body3d_name: { type: 'string', description: 'Tipul corpului 3D când NU e piramidă regulată (con, sferă, prismă…).' },
    },
    required: ['verdict', 'reason'],
  },
};

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
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 3000, system: SYSTEM_PROMPT,
      tools: [TOOL], tool_choice: { type: 'tool', name: 'record_figure_live' },
      messages: [{ role: 'user', content: `Enunț:\n${text}\n\nClasifică și extrage prin record_figure_live.` }],
    });
    const tu = msg.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
    const out = (tu?.input ?? {}) as { verdict?: string; reason?: string; spec2d?: unknown; body3d?: RegularPyramidSpec | null; body3d_name?: string };
    const verdict = out.verdict ?? 'fara_figura';
    const reason = out.reason ?? '';

    if (verdict === 'figurabil_2d' && out.spec2d && typeof out.spec2d === 'object') {
      let valid = false, err: string | null = null;
      try { const v = validateSpec(out.spec2d as FigureSpec2D); valid = v.errors.length === 0; err = v.errors.join(' · ') || null; }
      catch (e) { err = `validateSpec: ${(e as Error).message}`; }
      return NextResponse.json({ dim: '2d', verdict, reason, spec: out.spec2d, valid, error: err });
    }
    if (verdict === '3d') {
      if (out.body3d && out.body3d.kind === 'regularPyramid') {
        try { solvePyramid(out.body3d); return NextResponse.json({ dim: '3d', verdict, reason, spec: { body: out.body3d }, valid: true, error: null }); }
        catch (e) { return NextResponse.json({ dim: '3d', verdict, reason, valid: false, error: (e as Error).message }); }
      }
      const name = out.body3d_name || 'necunoscut';
      return NextResponse.json({ dim: '3d', verdict, reason, unsupported: true, message: `3D detectat — șablonul „${name}” nu e implementat încă (avem doar piramida regulată).` });
    }
    return NextResponse.json({ dim: 'none', verdict: 'fara_figura', reason, message: 'Fără figură (enunț ne-geometric).' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
