import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * ETAPA 46 — INTRARE web de autorat: condiție + (opțional) DESEN DORIT încărcat → Supabase Storage
 * (bucket figuri-dorite) → rând figura_autor (status: pending). Upload-ul se face server-side cu
 * service role (fără RLS pe storage din browser). Gard admin.
 */
const BUCKET = 'figuri-dorite';
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'caz';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  let body: { condition?: unknown; slug?: unknown; imageDataUrl?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const condition = typeof body.condition === 'string' ? body.condition.trim() : '';
  if (!condition) return NextResponse.json({ error: 'Lipsește condiția.' }, { status: 400 });
  const slug = `${typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(condition)}-${Date.now().toString(36)}`;

  const svc = createServiceClient();
  let desiredKind: string | null = null, desiredRef: string | null = null;

  // upload DESEN DORIT (data-URL base64) → storage public, dacă există
  const dataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
  const m = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (m) {
    const buf = Buffer.from(m[3], 'base64');
    if (buf.length > 6 * 1024 * 1024) return NextResponse.json({ error: 'Imagine prea mare (>6MB).' }, { status: 400 });
    const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
    const path = `${slug}.${ext}`;
    const { error: upErr } = await svc.storage.from(BUCKET).upload(path, buf, { contentType: m[1], upsert: true });
    if (upErr) return NextResponse.json({ error: `upload: ${upErr.message}` }, { status: 500 });
    desiredRef = svc.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    desiredKind = 'image';
  } else if (typeof body.imageDataUrl === 'string' && body.imageDataUrl) {
    return NextResponse.json({ error: 'Format imagine nesuportat (png/jpg/webp data-URL).' }, { status: 400 });
  }

  const { data, error } = await svc.from('figura_autor').insert({
    slug, condition, desired_kind: desiredKind, desired_ref: desiredRef, status: 'pending', iteratii: 0,
  }).select('id, slug').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, slug: data.slug, desired_ref: desiredRef });
}
