import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runEmailCron } from '@/lib/notify/email-cron';

/**
 * ETAPA 78 C1 — cron-ul de email, o dată pe zi (Vercel: 15:00 UTC = 18:00
 * Chișinău vara / 17:00 iarna). Acoperă: streak rupt, trial expiră, plată
 * restantă; duminica și raportul săptămânal. Fără RESEND_API_KEY totul se
 * loghează 'pending-no-key' și nimic nu crapă.
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
  }
  const report = await runEmailCron(createServiceClient(), new Date());
  return NextResponse.json(report);
}
