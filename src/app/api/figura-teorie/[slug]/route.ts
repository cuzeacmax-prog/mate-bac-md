/**
 * GET /api/figura-teorie/[slug] — ETAPA 70 FAZA B1.
 * Servește figura CANONICĂ de teorie a unui concept, din registrul revizuit
 * de om (theory-figures) — SVG determinist, fără DB, fără AI.
 * Auth obligatoriu (ca /api/figura); cache privat 24h.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTheoryFigure } from '@/lib/lesson/theory-figures/registry';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  const { slug } = await params;
  const entry = getTheoryFigure(slug);
  if (!entry) {
    return NextResponse.json({ error: 'Concept fără figură canonică în registru' }, { status: 404 });
  }

  try {
    return new NextResponse(entry.render(), {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (err) {
    console.error('[api/figura-teorie] render failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Randarea figurii a eșuat' }, { status: 500 });
  }
}
