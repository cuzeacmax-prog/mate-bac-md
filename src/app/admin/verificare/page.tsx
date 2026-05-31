import { createServiceClient } from "@/lib/supabase/service";
import VerificarePanel, { type VItem } from "./VerificarePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verificare CAS — revizie" };

type Row = Record<string, unknown>;

export default async function VerificarePage() {
  const supabase = createServiceClient();

  // Citește toate rândurile de verificare + enunțul exercițiului (paginat).
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("exercise_verification")
      .select("id, subpart, method, computed_latex, verified, note, human_status, human_note, exercise_raw!inner(exercise_number, module, section, statement)")
      .order("method")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
  }

  const items: VItem[] = rows.map((r) => {
    const ex = (r.exercise_raw ?? {}) as Record<string, unknown>;
    return {
      id: r.id as string,
      subpart: (r.subpart as string | null) ?? null,
      method: (r.method as string) ?? "",
      computed_latex: (r.computed_latex as string | null) ?? null,
      verified: (r.verified as boolean | null) ?? null,
      note: (r.note as string | null) ?? null,
      human_status: (r.human_status as string | null) ?? null,
      human_note: (r.human_note as string | null) ?? null,
      exercise_number: (ex.exercise_number as string) ?? "",
      module: (ex.module as string | null) ?? null,
      section: (ex.section as string | null) ?? null,
      statement: (ex.statement as string) ?? "",
    };
  });

  return <VerificarePanel items={items} />;
}
