import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// ── GET: list + filter ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("subscription_status").eq("id", user.id).single();
  if (profile?.subscription_status !== "admin") {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const grade    = searchParams.get("grade");
  const topic    = searchParams.get("topic");
  const validated = searchParams.get("validated");
  const page     = parseInt(searchParams.get("page") ?? "1", 10);
  const limit    = parseInt(searchParams.get("limit") ?? "20", 10);
  const offset   = (page - 1) * limit;

  const service = createServiceClient();
  let query = service
    .from("solution_methods")
    .select("id,exercise_type,exercise_type_label,method_name,grade_level,topic,subtopic,difficulty,importance_score,validated,validated_by,usage_count,created_at,updated_at", { count: "exact" })
    .order("importance_score", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (grade) query = query.eq("grade_level", parseInt(grade, 10));
  if (topic) query = query.eq("topic", topic);
  if (validated !== null && validated !== "") query = query.eq("validated", validated === "true");

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], count: count ?? 0, page, limit });
}

// ── POST: create new method ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("subscription_status").eq("id", user.id).single();
  if (profile?.subscription_status !== "admin") {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }

  const required = ["exercise_type", "exercise_type_label", "method_name", "grade_level", "topic"];
  for (const f of required) {
    if (!body[f]) return NextResponse.json({ error: `Câmp obligatoriu: ${f}` }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("solution_methods")
    .insert({
      exercise_type:       body.exercise_type,
      exercise_type_label: body.exercise_type_label,
      method_name:         body.method_name,
      grade_level:         body.grade_level,
      topic:               body.topic,
      subtopic:            body.subtopic ?? null,
      description:         body.description ?? null,
      steps:               body.steps ?? [],
      notation_rules:      body.notation_rules ?? {},
      required_elements:   body.required_elements ?? [],
      forbidden_shortcuts: body.forbidden_shortcuts ?? [],
      examples:            body.examples ?? [],
      common_mistakes:     body.common_mistakes ?? [],
      required_tools:      body.required_tools ?? [],
      difficulty:          body.difficulty ?? 3,
      importance_score:    body.importance_score ?? 5,
      validated:           body.validated ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
