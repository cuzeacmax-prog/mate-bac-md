/**
 * /api/admin/curriculum — ETAPA 83 A3: arbitrarea mapării concept→clasă.
 * Maxim e arbitrul. Acțiuni: accept (scrie clasa propusă), correct (scrie clasa
 * aleasă din dropdown 9-12), reject (păstrează clasa curentă), confirm_firm
 * (aplică TOATE schimbările ferme rămase). grade_level se scrie DOAR aici, la
 * apăsarea ownerului — niciodată automat, niciodată pe 'nesigur' fără clasă aleasă.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const GRADES = [9, 10, 11, 12];

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Neautentificat' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') {
    return { error: NextResponse.json({ error: 'Doar admin' }, { status: 403 }) };
  }
  return { user };
}

async function applyGrade(svc: ReturnType<typeof createServiceClient>, conceptId: string, grade: number) {
  const { error } = await svc.from('concepts').update({ grade_level: grade }).eq('id', conceptId);
  if (error) throw new Error(error.message);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const svc = createServiceClient();

  const body = (await req.json().catch(() => null)) as {
    action?: string; id?: string; grade?: number;
  } | null;
  if (!body?.action) return NextResponse.json({ error: 'action lipsă' }, { status: 400 });
  const stamp = { decided_by: auth.user.email ?? 'admin', decided_at: new Date().toISOString(), updated_at: new Date().toISOString() };

  // confirm_firm: aplică toate schimbările ferme încă pending (proposed != current)
  if (body.action === 'confirm_firm') {
    const { data: rows, error } = await svc
      .from('curriculum_proposals')
      .select('id, concept_id, current_grade, proposed_grade')
      .eq('status', 'pending').eq('confidence', 'firm');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const changes = (rows ?? []).filter((r) => r.proposed_grade != null && r.proposed_grade !== r.current_grade);
    for (const r of changes) {
      await applyGrade(svc, r.concept_id as string, r.proposed_grade as number);
      await svc.from('curriculum_proposals').update({ status: 'accepted', decided_grade: r.proposed_grade, ...stamp }).eq('id', r.id);
    }
    return NextResponse.json({ ok: true, applied: changes.length });
  }

  if (!body.id) return NextResponse.json({ error: 'id lipsă' }, { status: 400 });
  const { data: prop, error: pErr } = await svc
    .from('curriculum_proposals').select('id, concept_id, current_grade, proposed_grade').eq('id', body.id).single();
  if (pErr || !prop) return NextResponse.json({ error: 'propunere negăsită' }, { status: 404 });

  if (body.action === 'accept') {
    if (prop.proposed_grade == null) return NextResponse.json({ error: 'fără clasă propusă (folosește correct)' }, { status: 400 });
    await applyGrade(svc, prop.concept_id as string, prop.proposed_grade as number);
    await svc.from('curriculum_proposals').update({ status: 'accepted', decided_grade: prop.proposed_grade, ...stamp }).eq('id', prop.id);
    return NextResponse.json({ ok: true, grade: prop.proposed_grade });
  }
  if (body.action === 'correct') {
    if (!GRADES.includes(Number(body.grade))) return NextResponse.json({ error: 'clasă invalidă' }, { status: 400 });
    await applyGrade(svc, prop.concept_id as string, Number(body.grade));
    await svc.from('curriculum_proposals').update({ status: 'corrected', decided_grade: Number(body.grade), ...stamp }).eq('id', prop.id);
    return NextResponse.json({ ok: true, grade: Number(body.grade) });
  }
  if (body.action === 'reject') {
    await svc.from('curriculum_proposals').update({ status: 'rejected', decided_grade: prop.current_grade, ...stamp }).eq('id', prop.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'action necunoscută' }, { status: 400 });
}
