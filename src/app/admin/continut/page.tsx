import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import ContentReview, { type ReviewItem } from "./ContentReview";

export const dynamic = "force-dynamic";

const GRADES = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

type Row = Record<string, unknown>;

export default async function ContinutPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const sp = await searchParams;
  const grade = Number(sp.grade) || 12;
  const supabase = createServiceClient();

  let items: ReviewItem[] = [];
  let errMsg = "";
  try {
    // concept_content_proposals JOIN concepts (inner, filtrat pe clasă). O clasă ≤ 736 rânduri → o pagină.
    const { data, error } = await supabase
      .from("concept_content_proposals")
      .select(
        "concept_id, definitie, formule_latex, conditii, exemplu, confidence, note, " +
          "concepts!inner(name, subtopic, module, kind, order_in_grade, grade_level)",
      )
      .eq("concepts.grade_level", grade)
      .range(0, 999);
    if (error) throw new Error(error.message);
    items = ((data ?? []) as unknown as Row[]).map((r) => {
      const c = (r.concepts ?? {}) as Row;
      return {
        id: r.concept_id as string,
        name: (c.name as string) ?? "",
        subtopic: (c.subtopic as string | null) ?? null,
        module: (c.module as string | null) ?? null,
        kind: (c.kind as string) ?? "concept",
        order_in_grade: (c.order_in_grade as number) ?? 0,
        confidence: (r.confidence as string) ?? "low",
        note: (r.note as string | null) ?? null,
        definitie: (r.definitie as string | null) ?? "",
        formule_latex: Array.isArray(r.formule_latex) ? (r.formule_latex as string[]) : [],
        conditii: (r.conditii as string | null) ?? "",
        exemplu: (r.exemplu as string | null) ?? "",
      };
    });
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revizuire conținut</h1>
          <p className="text-sm text-gray-500 mt-1">
            {errMsg ? (
              <span className="text-red-600">Eroare la citire: {errMsg}</span>
            ) : (
              <>
                Clasa {grade} · {items.length} concepte (read-only). Formule randate cu KaTeX;
                cele cu erori și confidence „low” sunt evidențiate — revizuiește-le primele.
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
                href={`/admin/continut?grade=${g}`}
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

      {items.length === 0 ? (
        <div className="text-center text-gray-400 py-20 border border-dashed border-gray-300 rounded-lg">
          Niciun conținut pentru clasa {grade}.
        </div>
      ) : (
        <ContentReview items={items} grade={grade} />
      )}
    </div>
  );
}
