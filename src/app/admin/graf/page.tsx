import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import ConceptGraph, { type GraphConcept } from "./ConceptGraph";

export const dynamic = "force-dynamic";

// Clasele pregătite pentru viitor; momentan doar 12 are concepte extrase.
const GRADES = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export default async function GrafPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const sp = await searchParams;
  const grade = Number(sp.grade) || 12;

  // Citire SERVER-SIDE cu service client — cheia service_role NU ajunge la client.
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("concepts")
    .select("id, name, kind, module, subtopic, order_in_grade, sub_points, status")
    .eq("grade_level", grade)
    .order("order_in_grade", { ascending: true })
    .order("name", { ascending: true });

  const concepts: GraphConcept[] = (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    kind: (c.kind as string) ?? "concept",
    module: (c.module as string | null) ?? null,
    subtopic: (c.subtopic as string | null) ?? null,
    order_in_grade: (c.order_in_grade as number) ?? 0,
    sub_points: Array.isArray(c.sub_points) ? (c.sub_points as string[]) : [],
    status: (c.status as string) ?? "extras",
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Graf concepte</h1>
          <p className="text-sm text-gray-500 mt-1">
            {error ? (
              <span className="text-red-600">Eroare la citire: {error.message}</span>
            ) : (
              <>
                Clasa {grade} · {concepts.length} concepte (read-only). Grupare derivată
                din module/subteme (best-effort din metadatele sursă).
              </>
            )}
          </p>
        </div>
        {/* Selector de clasă — pregătit pentru viitor (server-driven prin ?grade). */}
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
          Niciun concept pentru clasa {grade}. (Doar clasa 12 are concepte extrase momentan.)
        </div>
      ) : (
        <ConceptGraph concepts={concepts} grade={grade} />
      )}
    </div>
  );
}
