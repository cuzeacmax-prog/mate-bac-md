/**
 * GET /api/figura/[exerciseId] — ETAPA 60 PAS 6.
 * Servește figura ACCEPTATĂ (approved/auto-acceptat) legată de un exercițiu,
 * ca SVG randat server-side din spec_generat PERSISTAT (nu PNG base64).
 * Auth obligatoriu; cache privat 24h (figura e deterministă din spec).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { renderSVG } from '@/lib/figures/render-svg';
import type { FigureSpec3D } from '@/lib/figures/spec3d';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  const { exerciseId } = await params;
  const service = createServiceClient();
  const { data: fig, error } = await service
    .from('figura_autor')
    .select('spec_generat, status')
    .eq('exercise_id', exerciseId)
    .in('status', ['approved', 'auto-acceptat'])
    .not('spec_generat', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[api/figura] lookup failed:', error.message);
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 });
  }
  if (!fig?.spec_generat) {
    return NextResponse.json({ error: 'Nicio figură acceptată pentru acest exercițiu' }, { status: 404 });
  }

  try {
    const svg = renderSVG(fig.spec_generat as FigureSpec3D);
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (err) {
    console.error('[api/figura] render failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Randarea figurii a eșuat' }, { status: 500 });
  }
}
