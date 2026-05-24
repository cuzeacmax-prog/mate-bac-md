import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Neautentificat", status: 401, user: null };
  const { data: profile } = await supabase
    .from("profiles").select("subscription_status").eq("id", user.id).single();
  if (profile?.subscription_status !== "admin") return { error: "Acces interzis", status: 403, user: null };
  return { error: null, status: 200, user };
}

// ── GET: single method ────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await checkAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const service = createServiceClient();
  const { data, error: dbErr } = await service
    .from("solution_methods").select("*").eq("id", id).single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 404 });
  return NextResponse.json({ data });
}

// ── PATCH: update method ──────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status, user } = await checkAdmin();
  if (error || !user) return NextResponse.json({ error }, { status });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }

  // If marking as validated, stamp the validator
  if (body.validated === true) body.validated_by = user.email ?? user.id;
  if (body.validated === false) body.validated_by = null;

  // Strip read-only fields
  const { id: _id, created_at: _ca, updated_at: _ua, embedding: _emb, ...safe } = body as Record<string, unknown>;
  void _id; void _ca; void _ua; void _emb;

  const service = createServiceClient();
  const { data, error: dbErr } = await service
    .from("solution_methods").update(safe).eq("id", id).select().single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ data });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await checkAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const service = createServiceClient();
  const { error: dbErr } = await service
    .from("solution_methods").delete().eq("id", id);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
