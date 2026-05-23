import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { compileTikz } from '@/lib/tikz/compile';
import {
  generateCubeAdvanced, generateRectangularPrismAdvanced,
  type CubeInput, type RectangularPrismInput,
} from '@/lib/geometry';
import { generateRegularPyramidAdvanced, type RegularPyramidInput } from '@/lib/geometry';
import {
  generateCylinderAdvanced, generateConeAdvanced, generateSphereAdvanced,
  type CylinderInput, type ConeInput, type SphereInput,
} from '@/lib/geometry';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  return p?.subscription_status === 'admin';
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  let body: { type?: string; input?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { type, input } = body;
  if (!type || !input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Missing type or input' }, { status: 400 });
  }

  const VALID_TYPES = ['cube', 'prism', 'pyramid', 'cylinder', 'cone', 'sphere'];
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `Unknown type. Valid: ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }

  try {
    let result;
    switch (type) {
      case 'cube':     result = generateCubeAdvanced(input as CubeInput); break;
      case 'prism':    result = generateRectangularPrismAdvanced(input as RectangularPrismInput); break;
      case 'pyramid':  result = generateRegularPyramidAdvanced(input as RegularPyramidInput); break;
      case 'cylinder': result = generateCylinderAdvanced(input as CylinderInput); break;
      case 'cone':     result = generateConeAdvanced(input as ConeInput); break;
      case 'sphere':   result = generateSphereAdvanced(input as SphereInput); break;
      default: return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const [compiled, ...stepResults] = await Promise.all([
      compileTikz(result.tikz),
      ...result.construction_steps.map((s) => compileTikz(s.cumulative_tikz).then((r) => r.svg).catch(() => null)),
    ]);
    return NextResponse.json({
      svg: compiled.svg, tikz: result.tikz, points: result.points, computed: result.computed,
      construction_steps: result.construction_steps.map((s, i) => ({ ...s, svg: stepResults[i] ?? null })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 });
  }
}
