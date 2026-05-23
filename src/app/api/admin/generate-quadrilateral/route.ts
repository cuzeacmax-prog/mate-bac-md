import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { compileTikz } from '@/lib/tikz/compile';
import {
  generateParallelogramAdvanced,
  generateTrapezoidAdvanced,
  type ParallelogramInput,
  type TrapezoidInput,
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

  const { type = 'parallelogram', input } = body;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Missing input' }, { status: 400 });
  }

  try {
    let result;
    if (type === 'trapezoid') {
      result = generateTrapezoidAdvanced(input as TrapezoidInput);
    } else {
      result = generateParallelogramAdvanced(input as ParallelogramInput);
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
