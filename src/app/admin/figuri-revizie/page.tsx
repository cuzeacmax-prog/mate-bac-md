import { createServiceClient } from "@/lib/supabase/service";
import FiguriReviziePanel, { type FigItem } from "./FiguriReviziePanel";
import type { FigureSpec2D } from "@/lib/figures/spec";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revizie figuri" };

type Row = Record<string, unknown>;

export default async function FiguriRevizuirePage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("exercise_figure_spec")
    .select("id, spec, classifier_verdict, valid, validation_error, human_status, exercise_raw!inner(module, exercise_number, statement)")
    .order("classifier_verdict")
    .limit(500);
  if (error) throw new Error(error.message);

  const items: FigItem[] = (data as Row[] ?? []).map((r) => {
    const ex = (r.exercise_raw ?? {}) as Record<string, unknown>;
    return {
      id: r.id as string,
      spec: (r.spec as FigureSpec2D | null) ?? null,
      verdict: (r.classifier_verdict as string) ?? "",
      valid: (r.valid as boolean | null) ?? null,
      validationError: (r.validation_error as string | null) ?? null,
      humanStatus: (r.human_status as string | null) ?? null,
      module: (ex.module as string | null) ?? null,
      exerciseNumber: (ex.exercise_number as string) ?? "",
      statement: (ex.statement as string) ?? "",
    };
  });

  return <FiguriReviziePanel items={items} />;
}
