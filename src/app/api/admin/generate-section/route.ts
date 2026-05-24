import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { compileTikz } from '@/lib/tikz/compile';
import {
  generateCubeSectionAdvanced,
  generatePyramidSectionAdvanced,
  generateConeSectionAdvanced,
  generateSphereSectionAdvanced,
  generateCylinderSectionAdvanced,
  type CubeSectionInput,
  type PyramidSectionInput,
  type ConeSectionInput,
  type SphereSectionInput,
  type CylinderSectionInput,
} from '@/lib/geometry';
import {
  generateRegularTetrahedronAdvanced,
  type RegularTetrahedronInput,
} from '@/lib/geometry';
import {
  generateObliquePrismAdvanced,
  type ObliquePrismInput,
} from '@/lib/geometry';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  return p?.subscription_status === 'admin';
}

const VALID_SHAPES = ['cube', 'pyramid', 'cone', 'sphere', 'cylinder', 'tetrahedron', 'oblique_prism'];

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  let body: { shape?: string; input?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { shape, input } = body;
  if (!shape || !input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Missing shape or input' }, { status: 400 });
  }

  if (!VALID_SHAPES.includes(shape)) {
    return NextResponse.json({ error: `Unknown shape. Valid: ${VALID_SHAPES.join(', ')}` }, { status: 400 });
  }

  try {
    let result;
    switch (shape) {
      case 'cube':         result = generateCubeSectionAdvanced(input as CubeSectionInput); break;
      case 'pyramid':      result = generatePyramidSectionAdvanced(input as PyramidSectionInput); break;
      case 'cone':         result = generateConeSectionAdvanced(input as ConeSectionInput); break;
      case 'sphere':       result = generateSphereSectionAdvanced(input as SphereSectionInput); break;
      case 'cylinder':     result = generateCylinderSectionAdvanced(input as CylinderSectionInput); break;
      case 'tetrahedron':  result = generateRegularTetrahedronAdvanced(input as RegularTetrahedronInput); break;
      case 'oblique_prism': result = generateObliquePrismAdvanced(input as ObliquePrismInput); break;
      default: return NextResponse.json({ error: 'Unknown shape' }, { status: 400 });
    }

    const [compiled, ...stepResults] = await Promise.all([
      compileTikz(result.tikz),
      ...result.construction_steps.map((s) => compileTikz(s.cumulative_tikz).then((r) => r.svg).catch(() => null)),
    ]);

    return NextResponse.json({
      svg: compiled.svg,
      tikz: result.tikz,
      points: result.points,
      computed: result.computed,
      construction_steps: result.construction_steps.map((s, i) => ({ ...s, svg: stepResults[i] ?? null })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 });
  }
}
