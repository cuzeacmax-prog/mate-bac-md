import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTrigFunctionPlot } from '@/lib/analysis/functionTrig';
import { generateTrigCircle } from '@/lib/trigonometry/trigCircle';
import { generateRightTriangleTrig } from '@/lib/trigonometry/triangleTrig';
import { generateAngleReduction } from '@/lib/trigonometry/reduction';
import { compileTikz } from '@/lib/tikz/compile';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  return p?.subscription_status === 'admin';
}

const VALID_TYPES = ['sin', 'cos', 'tan', 'cot', 'trig_circle', 'right_triangle', 'reduction'] as const;

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
      case 'sin':
      case 'cos':
      case 'tan':
      case 'cot':
        result = generateTrigFunctionPlot({ ...(params as object), type } as unknown as Parameters<typeof generateTrigFunctionPlot>[0]); break;
      case 'trig_circle': result = generateTrigCircle(params as unknown as Parameters<typeof generateTrigCircle>[0]); break;
      case 'right_triangle': result = generateRightTriangleTrig(params as unknown as Parameters<typeof generateRightTriangleTrig>[0]); break;
      case 'reduction': result = generateAngleReduction(params as unknown as Parameters<typeof generateAngleReduction>[0]); break;
      default: return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const compiled = await compileTikz(result.tikz);
    return NextResponse.json({ ...result, svg: compiled.svg });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
