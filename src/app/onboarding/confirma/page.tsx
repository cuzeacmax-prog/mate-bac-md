import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isGoal } from '@/lib/profile/goal';
import { ConfirmaForm } from './ConfirmaForm';

/**
 * ETAPA 82 FAZA A3 — gate de o-singură-dată pentru elevii fără obiectiv setat.
 * Ajung aici din app/layout când goal IS NULL. Confirmă clasa + obiectivul,
 * apoi intră normal în aplicație. Dacă obiectivul e deja setat, nu mai apare.
 */
export const metadata = { title: 'Confirmă-ți profilul — Profesor Maxim' };

export default async function ConfirmaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('grade_level, goal')
    .eq('id', user.id)
    .maybeSingle();

  // Deja confirmat → nu repetăm pasul.
  if (isGoal((profile as { goal: string | null } | null)?.goal)) {
    redirect('/app');
  }

  const initialGrade = ((profile as { grade_level: number | null } | null)?.grade_level ?? null);
  return <ConfirmaForm initialGrade={initialGrade} />;
}
