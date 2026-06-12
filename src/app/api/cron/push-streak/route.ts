import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runPushCron } from '@/lib/notify/push';

/**
 * ETAPA 78 B2 — cron de seară (Vercel: 16:30 UTC = 19:30 Chișinău vara,
 * 18:30 iarna — tot seară; regulile de liniște/limită sunt în lib, nu aici).
 * STREAK ÎN PERICOL: doar daily nefăcut + streak ≥ 2.
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
  }
  const report = await runPushCron(createServiceClient(), 'streak', new Date());
  return NextResponse.json(report);
}
