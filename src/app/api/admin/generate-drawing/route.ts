import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { compileTikz } from '@/lib/tikz/compile';
import { applyTemplate, type TemplateValue } from '@/lib/templates/engine';
import * as Geometry from '@/lib/geometry';

type ParamMap = Record<string, TemplateValue>;
type Calculator = (params: ParamMap) => ParamMap;

function toNumber(v: TemplateValue, name: string): number {
  if (typeof v !== 'number') throw new Error(`Parameter "${name}" must be a number, got: ${typeof v}`);
  return v;
}

const CALCULATORS: Record<string, Calculator> = {
  triangle_from_sides: (params) => {
    const a = toNumber(params.a, 'a');
    const b = toNumber(params.b, 'b');
    const c = toNumber(params.c, 'c');

    const triangle = Geometry.triangleVerticesFromSides(a, b, c);
    const I = Geometry.incenter(triangle);
    const r = Geometry.inradius(triangle);
    const O = Geometry.circumcenter(triangle);
    const R = Geometry.circumradius(triangle);
    const G = Geometry.centroid(triangle);

    return {
      A: triangle.A,
      B: triangle.B,
      C: triangle.C,
      incenter: I,
      inradius: r,
      circumcenter: O,
      circumradius: R,
      centroid: G,
      a, b, c,
    };
  },
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  if (profile?.subscription_status !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { template_name?: unknown; params?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { template_name, params } = body;

  if (!template_name || typeof template_name !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid template_name' }, { status: 400 });
  }

  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return NextResponse.json({ error: 'Missing or invalid params object' }, { status: 400 });
  }

  const { data: template, error: tplError } = await supabase
    .from('tikz_templates')
    .select('name, latex_source, calculator_function')
    .eq('name', template_name)
    .eq('is_active', true)
    .single();

  if (tplError || !template) {
    return NextResponse.json({ error: `Template not found: ${template_name}` }, { status: 404 });
  }

  let computedParams: ParamMap = params as ParamMap;

  if (template.calculator_function) {
    const calc = CALCULATORS[template.calculator_function];
    if (!calc) {
      return NextResponse.json(
        { error: `Unknown calculator: ${template.calculator_function}` },
        { status: 400 },
      );
    }
    try {
      const calculated = calc(computedParams);
      computedParams = { ...computedParams, ...calculated };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Calculator error';
      return NextResponse.json({ error: `Calculator error: ${message}` }, { status: 400 });
    }
  }

  const latex = applyTemplate(template.latex_source, computedParams);

  try {
    const result = await compileTikz(latex);
    return NextResponse.json({
      svg: result.svg,
      latex_used: latex,
      compile_time_ms: result.compile_time_ms,
      cached: result.cached,
      computed_params: computedParams,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Compile failed';
    console.error('[/api/admin/generate-drawing] Error:', message);
    return NextResponse.json(
      { error: `Compile failed: ${message}`, latex_used: latex },
      { status: 500 },
    );
  }
}
