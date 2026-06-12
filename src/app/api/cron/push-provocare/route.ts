import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runPushCron } from '@/lib/notify/push';

/**
 * ETAPA 78 B2 — cron de dimineață (Vercel: 05:30 UTC = 08:30 Chișinău vara,
 * 07:30 iarna; fereastra 08–10 din lib oprește trimiterea prea devreme iarna —
 * onest: iarna notificarea poate sări o zi până ajustăm cron-ul sezonier).
 * PROVOCAREA E GATA: DOAR opt-in explicit din setări.
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
  }
  const report = await runPushCron(createServiceClient(), 'provocare', new Date());
  return NextResponse.json(report);
}
