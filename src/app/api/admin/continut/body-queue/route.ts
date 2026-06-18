import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { findBodyErrors } from "@/lib/content/body-render";

/**
 * ETAPA 79 FAZA B — coada umană de reparare body-uri LaTeX.
 *  GET  : lista enunțurilor cu erori KaTeX per-formulă (≠ 'rezolvat'), cu eroarea evidențiată.
 *  POST : {id, statement} → admin salvează enunțul corectat + marchează 'rezolvat', re-validează.
 * R5: modelul NU rescrie matematica; aici doar listăm + persistăm editarea OMULUI.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, msg: "Unauthorized" };
  const { data: profile } = await supabase.from("profiles").select("subscription_status").eq("id", user.id).single();
  if (profile?.subscription_status !== "admin") return { ok: false as const, status: 403, msg: "Admin access required" };
  return { ok: true as const };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.msg }, { status: guard.status });

  const svc = createServiceClient();
  const rows: Array<{ id: string; module: string | null; exercise_number: string | null; statement: string | null; human_body_status: string | null }> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await svc.from("exercise_raw")
      .select("id, module, exercise_number, statement, human_body_status").range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    rows.push(...(data as typeof rows));
    if (data.length < 1000) break;
    from += 1000;
  }

  const queue = rows
    .filter((r) => r.human_body_status !== "rezolvat")
    .map((r) => ({ ...r, errors: findBodyErrors(r.statement ?? "") }))
    .filter((r) => r.errors.length > 0)
    .sort((a, b) => (a.module ?? "").localeCompare(b.module ?? "") || (a.exercise_number ?? "").localeCompare(b.exercise_number ?? ""));

  return NextResponse.json({ count: queue.length, items: queue });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.msg }, { status: guard.status });

  let body: { id?: unknown; statement?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : null;
  const statement = typeof body.statement === "string" ? body.statement : null;
  if (!id || statement === null) return NextResponse.json({ error: "Missing id/statement" }, { status: 400 });

  const errors = findBodyErrors(statement);
  const { error } = await createServiceClient().from("exercise_raw")
    .update({ statement, human_body_status: errors.length === 0 ? "rezolvat" : "coada" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id, resolved: errors.length === 0, errors });
}
