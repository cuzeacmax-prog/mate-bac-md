import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateLinearFunctionPlot,
  generateQuadraticFunctionPlot,
  generatePowerFunctionPlot,
  generateRadicalFunctionPlot,
  generateExponentialFunctionPlot,
  generateLogarithmicFunctionPlot,
  generateModulusFunctionPlot,
  generateFunctionPlot,
} from '@/lib/analysis/functionElementary';
import { compileTikz } from '@/lib/tikz/compile';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  return p?.subscription_status === 'admin';
}

const VALID_TYPES = ['linear', 'quadratic', 'power', 'radical', 'exponential', 'logarithmic', 'modulus', 'generic'] as const;

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const body = await req.json() as { type: string; params: unknown };
    const { type, params } = body;

    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json({ error: `Invalid type. Valid: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    let result;
    switch (type) {
      case 'linear': result = generateLinearFunctionPlot(params as unknown as Parameters<typeof generateLinearFunctionPlot>[0]); break;
      case 'quadratic': result = generateQuadraticFunctionPlot(params as unknown as Parameters<typeof generateQuadraticFunctionPlot>[0]); break;
      case 'power': result = generatePowerFunctionPlot(params as unknown as Parameters<typeof generatePowerFunctionPlot>[0]); break;
      case 'radical': result = generateRadicalFunctionPlot(params as unknown as Parameters<typeof generateRadicalFunctionPlot>[0]); break;
      case 'exponential': result = generateExponentialFunctionPlot(params as unknown as Parameters<typeof generateExponentialFunctionPlot>[0]); break;
      case 'logarithmic': result = generateLogarithmicFunctionPlot(params as unknown as Parameters<typeof generateLogarithmicFunctionPlot>[0]); break;
      case 'modulus': result = generateModulusFunctionPlot(params as unknown as Parameters<typeof generateModulusFunctionPlot>[0]); break;
      case 'generic': result = generateFunctionPlot(params as unknown as Parameters<typeof generateFunctionPlot>[0]); break;
      default: return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const compiled = await compileTikz(result.tikz);
    return NextResponse.json({ ...result, svg: compiled.svg });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
