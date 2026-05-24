import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAsymptotePlot } from '@/lib/analysis/asymptotes';
import { generateLimitVisualization } from '@/lib/analysis/limits';
import { generateTangentLine } from '@/lib/analysis/tangent';
import { generateMonotonicityPlot } from '@/lib/analysis/derivativeApplications';
import { generateIntegralVisualization } from '@/lib/analysis/integral';
import { generateRotationVolume } from '@/lib/analysis/rotationVolume';
import { compileTikz } from '@/lib/tikz/compile';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  return p?.subscription_status === 'admin';
}

const VALID_TYPES = ['asymptotes', 'limit', 'tangent', 'monotonicity', 'integral', 'rotation_volume'] as const;

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
      case 'asymptotes': result = generateAsymptotePlot(params as unknown as Parameters<typeof generateAsymptotePlot>[0]); break;
      case 'limit': result = generateLimitVisualization(params as unknown as Parameters<typeof generateLimitVisualization>[0]); break;
      case 'tangent': result = generateTangentLine(params as unknown as Parameters<typeof generateTangentLine>[0]); break;
      case 'monotonicity': result = generateMonotonicityPlot(params as unknown as Parameters<typeof generateMonotonicityPlot>[0]); break;
      case 'integral': result = generateIntegralVisualization(params as unknown as Parameters<typeof generateIntegralVisualization>[0]); break;
      case 'rotation_volume': result = generateRotationVolume(params as unknown as Parameters<typeof generateRotationVolume>[0]); break;
      default: return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const compiled = await compileTikz(result.tikz);
    return NextResponse.json({ ...result, svg: compiled.svg });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
