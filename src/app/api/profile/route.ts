import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isGoal } from '@/lib/profile/goal';

/**
 * ETAPA 82 FAZA A — actualizarea clasei + obiectivului din profil.
 * Folosit de gate-ul de confirmare (A3) și de pagina de setări (editabil ulterior).
 * Scrie DOAR câmpurile trimise; validează strict (clasă 9–12, goal ∈ {bac,
 * note_clasa, explorare}, notă-țintă 7–10 sau null).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    grade_level?: unknown;
    goal?: unknown;
    target_bac_score?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: 'Corp invalid' }, { status: 400 });

  const patch: { grade_level?: number; goal?: string; target_bac_score?: number | null } = {};

  if (body.grade_level !== undefined) {
    const g = Number(body.grade_level);
    if (![9, 10, 11, 12].includes(g)) {
      return NextResponse.json({ error: 'Clasă invalidă' }, { status: 400 });
    }
    patch.grade_level = g;
  }

  if (body.goal !== undefined) {
    if (!isGoal(body.goal)) {
      return NextResponse.json({ error: 'Obiectiv invalid' }, { status: 400 });
    }
    patch.goal = body.goal;
  }

  if (body.target_bac_score !== undefined) {
    if (body.target_bac_score === null) {
      patch.target_bac_score = null;
    } else {
      const t = Number(body.target_bac_score);
      if (![7, 8, 9, 10].includes(t)) {
        return NextResponse.json({ error: 'Notă-țintă invalidă' }, { status: 400 });
      }
      patch.target_bac_score = t;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nimic de actualizat' }, { status: 400 });
  }

  const svc = createServiceClient();
  // UPSERT, nu UPDATE: unii elevi existenți (conturi 2026-05..06) încă n-au rând
  // în user_profiles; un UPDATE ar afecta 0 rânduri în tăcere → gate-ul A3 (goal
  // NULL → /onboarding/confirma) ar bucla la nesfârșit. Upsert garantează rândul.
  const { error } = await svc
    .from('user_profiles')
    .upsert({ id: user.id, ...patch }, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...patch });
}
