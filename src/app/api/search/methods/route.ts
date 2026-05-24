import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateEmbeddingForQuery } from "@/lib/embeddings/gemini";

/**
 * GET /api/search/methods?q=...&grade=12&topic=algebra&limit=5
 *
 * Semantic search în solution_methods.
 * Dacă nu există embedding API key → fallback text search (ILIKE).
 * Backwards-compat: returnează [] dacă tabela nu există.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q")?.trim() ?? "";
  const grade  = searchParams.get("grade") ? parseInt(searchParams.get("grade")!, 10) : null;
  const topic  = searchParams.get("topic") ?? null;
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "5", 10), 10);

  const service = createServiceClient();

  // ── Semantic search (dacă avem Gemini key) ────────────────────────
  if (q && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const embedding = await generateEmbeddingForQuery(q);
      const { data, error } = await service.rpc("match_solution_methods", {
        query_embedding: embedding,
        match_threshold: 0.45,
        match_count: limit,
        filter_grade: grade,
        filter_topic: topic,
      });

      if (error) {
        // Tabela nu există — returnează []
        if (error.message?.includes("does not exist") || error.message?.includes("function")) {
          return NextResponse.json({ data: [], source: "none", reason: "table_not_found" });
        }
        throw error;
      }

      return NextResponse.json({
        data: data ?? [],
        source: "semantic",
        query: q,
      });
    } catch (e) {
      console.warn("[search/methods] semantic failed, fallback to text:", e instanceof Error ? e.message : e);
    }
  }

  // ── Fallback: text search (ILIKE) ─────────────────────────────────
  try {
    let query = service
      .from("solution_methods")
      .select("id,exercise_type,exercise_type_label,method_name,description,steps,notation_rules,grade_level,topic,importance_score")
      .eq("validated", true)
      .order("importance_score", { ascending: false })
      .limit(limit);

    if (q) {
      query = query.or(
        `method_name.ilike.%${q}%,exercise_type_label.ilike.%${q}%,description.ilike.%${q}%`
      );
    }
    if (grade) query = query.eq("grade_level", grade);
    if (topic) query = query.eq("topic", topic);

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes("does not exist")) {
        return NextResponse.json({ data: [], source: "none", reason: "table_not_found" });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [], source: "text", query: q });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare internă" },
      { status: 500 }
    );
  }
}
