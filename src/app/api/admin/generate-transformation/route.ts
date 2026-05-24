import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSymmetry } from '@/lib/transformations/symmetry';
import { generateTranslation } from '@/lib/transformations/translation';
import { generateRotation } from '@/lib/transformations/rotation';
import { generateHomothety } from '@/lib/transformations/homothety';
import { compileTikz } from '@/lib/tikz/compile';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  return p?.subscription_status === 'admin';
}

const VALID_TYPES = ['symmetry', 'translation', 'rotation', 'homothety'] as const;

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
      case 'symmetry': result = generateSymmetry(params as unknown as Parameters<typeof generateSymmetry>[0]); break;
      case 'translation': result = generateTranslation(params as unknown as Parameters<typeof generateTranslation>[0]); break;
      case 'rotation': result = generateRotation(params as unknown as Parameters<typeof generateRotation>[0]); break;
      case 'homothety': result = generateHomothety(params as unknown as Parameters<typeof generateHomothety>[0]); break;
      default: return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const compiled = await compileTikz(result.tikz);
    return NextResponse.json({ ...result, svg: compiled.svg });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
