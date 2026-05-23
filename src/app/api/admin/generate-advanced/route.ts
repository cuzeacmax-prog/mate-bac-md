import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { compileTikz } from '@/lib/tikz/compile';
import { generateTriangleAdvanced, type TriangleAdvancedInput } from '@/lib/geometry';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();
  if (profile?.subscription_status !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { shape?: unknown; input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { shape = 'triangle', input } = body;

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Missing or invalid input' }, { status: 400 });
  }

  if (shape !== 'triangle') {
    return NextResponse.json(
      { error: 'Only triangle supported in this version' },
      { status: 400 },
    );
  }

  try {
    const result = generateTriangleAdvanced(input as TriangleAdvancedInput);

    const [compiled, ...stepResults] = await Promise.all([
      compileTikz(result.tikz),
      ...result.construction_steps.map((s) =>
        compileTikz(s.cumulative_tikz)
          .then((r) => r.svg)
          .catch(() => null),
      ),
    ]);

    return NextResponse.json({
      svg: compiled.svg,
      tikz: result.tikz,
      points: result.points,
      angles: result.angles,
      computed: result.computed,
      construction_steps: result.construction_steps.map((s, i) => ({
        ...s,
        svg: stepResults[i] ?? null,
      })),
      compile_time_ms: compiled.compile_time_ms,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
