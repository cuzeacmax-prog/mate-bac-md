/**
 * POST /api/simulare/submit — ETAPA 69: submit final, evaluare ETAPA 63,
 * expirarea verificată SERVER-side, evidență în concept_mastery (source=exam).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { submitExamAttempt } from '@/lib/simulare/exam';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { attemptId?: string; answers?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  if (!body.attemptId || !body.answers) {
    return NextResponse.json({ error: 'attemptId și answers sunt obligatorii' }, { status: 400 });
  }

  try {
    const result = await submitExamAttempt(createServiceClient(), user.id, body.attemptId, body.answers);
    if (result.expired) {
      return NextResponse.json({ error: 'Timpul a expirat — simularea s-a închis fără punctaj.', result }, { status: 410 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Eroare internă';
    console.error('[simulare/submit]', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
