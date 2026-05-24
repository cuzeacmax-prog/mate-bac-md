import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateProjection3D } from '@/lib/spatial/projections3D';
import { generateDihedralAngle } from '@/lib/spatial/dihedralAngle';
import { generateThreePerp } from '@/lib/spatial/threePerp';
import { compileTikz } from '@/lib/tikz/compile';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  return p?.subscription_status === 'admin';
}

const VALID_TYPES = ['projection', 'dihedral', 'three_perp'] as const;

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
      case 'projection': result = generateProjection3D(params as unknown as Parameters<typeof generateProjection3D>[0]); break;
      case 'dihedral': result = generateDihedralAngle(params as unknown as Parameters<typeof generateDihedralAngle>[0]); break;
      case 'three_perp': result = generateThreePerp(params as unknown as Parameters<typeof generateThreePerp>[0]); break;
      default: return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const compiled = await compileTikz(result.tikz);
    return NextResponse.json({ ...result, svg: compiled.svg });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
