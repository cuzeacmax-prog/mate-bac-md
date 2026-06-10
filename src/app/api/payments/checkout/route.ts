/**
 * POST /api/payments/checkout — ETAPA 71 E3: pornește plata.
 * Providerul (mock azi, Hub.md mâine — aceeași interfață) întoarce URL-ul
 * de checkout; clientul navighează acolo.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPaymentProvider } from '@/lib/payments/provider';
import { getPlanConfig } from '@/lib/payments/state';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  const plan = await getPlanConfig(createServiceClient());
  const session = await getPaymentProvider().createCheckout(plan, user.id);
  return NextResponse.json(session);
}
