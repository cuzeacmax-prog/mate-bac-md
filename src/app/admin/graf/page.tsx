import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import ConceptGraph, { type GraphConcept, type GraphNodeLite, type GraphEdge } from "./ConceptGraph";

export const dynamic = "force-dynamic";

const GRADES = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

type Row = Record<string, unknown>;
async function readAll(
  q: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export default async function GrafPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const sp = await searchParams;
  const grade = Number(sp.grade) || 12;
  const supabase = createServiceClient();

  let concepts: GraphConcept[] = [];
  let allNodes: GraphNodeLite[] = [];
  let edges: GraphEdge[] = [];
  let errMsg = "";

  try {
    // Detaliu complet DOAR pentru clasa selectată (randată).
    const selRows = await readAll((from, to) =>
      supabase
        .from("concepts")
        .select("id, name, kind, module, subtopic, order_in_grade, sub_points, status")
        .eq("grade_level", grade)
        .order("order_in_grade", { ascending: true })
        .order("name", { ascending: true })
        .range(from, to),
    );
    concepts = selRows.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      kind: (c.kind as string) ?? "concept",
      module: (c.module as string | null) ?? null,
      subtopic: (c.subtopic as string | null) ?? null,
      order_in_grade: (c.order_in_grade as number) ?? 0,
      sub_points: Array.isArray(c.sub_points) ? (c.sub_points as string[]) : [],
      status: (c.status as string) ?? "extras",
    }));

    // Lightweight pentru TOATE clasele (cioturi cross-clasă + lanțul de prerechizite).
    const liteRows = await readAll((from, to) =>
      supabase.from("concepts").select("id, name, grade_level, kind").range(from, to),
    );
    allNodes = liteRows.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      grade: (c.grade_level as number) ?? 0,
      kind: (c.kind as string) ?? "concept",
    }));

    // TOATE muchiile (from REQUIRES to).
    const edgeRows = await readAll((from, to) =>
      supabase.from("concept_edge_proposals").select("from_concept, to_concept, confidence").range(from, to),
    );
    edges = edgeRows.map((e) => ({
      from: e.from_concept as string,
      to: e.to_concept as string,
      confidence: (e.confidence as string | null) ?? null,
    }));
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Graf concepte + prerechizite</h1>
          <p className="text-sm text-gray-500 mt-1">
            {errMsg ? (
              <span className="text-red-600">Eroare la citire: {errMsg}</span>
            ) : (
              <>
                Clasa {grade} · {concepts.length} concepte · {edges.length} muchii în graf (read-only).
                Click pe un nod → lanțul de prerechizite peste clase.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Clasă</label>
          <div className="flex flex-wrap gap-1">
            {GRADES.map((g) => (
              <Link
                key={g}
                href={`/admin/graf?grade=${g}`}
                className={`text-xs px-2 py-1 rounded border ${
                  g === grade
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {g}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {concepts.length === 0 ? (
        <div className="text-center text-gray-400 py-20 border border-dashed border-gray-300 rounded-lg">
          Niciun concept pentru clasa {grade}.
        </div>
      ) : (
        <ConceptGraph concepts={concepts} grade={grade} allNodes={allNodes} edges={edges} />
      )}
    </div>
  );
}
