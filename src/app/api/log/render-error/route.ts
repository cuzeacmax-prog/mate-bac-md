/**
 * POST /api/log/render-error — ETAPA 72 P2: erorile de randare ale clientului
 * ajung în tabela de log existentă (katex_error_report, source='client-render')
 * ca să vedem CE conținut sparge randarea. Auth obligatoriu, payload limitat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { error?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from('katex_error_report').insert({
    source: 'client-render',
    error: (body.error ?? 'necunoscut').slice(0, 500),
    raw: (body.content ?? '').slice(0, 2000),
    concept_name: `user:${user.id.slice(0, 8)}`,
  });
  if (error) {
    console.error('[log/render-error] insert failed:', error.message);
    return NextResponse.json({ error: 'Eroare la logare' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
