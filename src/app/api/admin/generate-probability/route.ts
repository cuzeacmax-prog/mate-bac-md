import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateVenn2, generateVenn3 } from '@/lib/combinatorics/venn';
import { generateProbabilityTree } from '@/lib/combinatorics/probabilityTree';
import { compileTikz } from '@/lib/tikz/compile';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  return p?.subscription_status === 'admin';
}

const VALID_TYPES = ['venn2', 'venn3', 'tree'] as const;

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
      case 'venn2': result = generateVenn2(params as unknown as Parameters<typeof generateVenn2>[0]); break;
      case 'venn3': result = generateVenn3(params as unknown as Parameters<typeof generateVenn3>[0]); break;
      case 'tree': result = generateProbabilityTree(params as unknown as Parameters<typeof generateProbabilityTree>[0]); break;
      default: return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const compiled = await compileTikz(result.tikz);
    return NextResponse.json({ ...result, svg: compiled.svg });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
