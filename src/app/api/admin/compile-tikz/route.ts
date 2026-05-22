import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { compileTikz, checkTikzServiceHealth } from '@/lib/tikz/compile';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  if (profile?.subscription_status !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { latex?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { latex } = body;

  if (!latex || typeof latex !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid latex field' }, { status: 400 });
  }

  try {
    const result = await compileTikz(latex);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Compilation failed';
    console.error('[/api/admin/compile-tikz] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const isHealthy = await checkTikzServiceHealth();
  return NextResponse.json({
    service_healthy: isHealthy,
    timestamp: new Date().toISOString(),
  });
}
