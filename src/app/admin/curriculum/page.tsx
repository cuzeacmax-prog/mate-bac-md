import { createServiceClient } from "@/lib/supabase/service";
import { CurriculumQueue, type Proposal } from "./CurriculumQueue";

/**
 * /admin/curriculum — ETAPA 83 A3: coada de revizuire a mapării concept→clasă.
 * Gating-ul admin e în layout-ul /admin. Maxim arbitrează; grade_level se scrie
 * doar prin acțiunile lui (vezi /api/admin/curriculum). ZERO LLM.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Curriculum — mapare clase — Admin" };

export default async function AdminCurriculumPage() {
  const svc = createServiceClient();
  const { data } = await svc
    .from("curriculum_proposals")
    .select("id, concept_slug, concept_name, current_grade, proposed_grade, confidence, source, reason, candidates, status, decided_grade")
    .order("confidence", { ascending: true })
    .order("current_grade", { ascending: true })
    .limit(2000);
  const rows = (data ?? []) as Proposal[];

  const firmChanges = rows.filter((r) => r.confidence === "firm" && r.proposed_grade != null && r.proposed_grade !== r.current_grade);
  const firmConfirm = rows.filter((r) => r.confidence === "firm" && (r.proposed_grade == null || r.proposed_grade === r.current_grade));
  const nesigure = rows.filter((r) => r.confidence === "nesigur");
  const pendingFirmChanges = firmChanges.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mapare concept → clasă (din manuale)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Extras VERBATIM din cuprinsul manualelor (R5). Propunerile FERME au potrivire clară și unică;
          cele NESIGURE rămân pentru tine — nu se scrie nimic automat. Tu ești arbitrul.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total concepte (9-12)" value={String(rows.length)} />
        <Stat label="Schimbări ferme" value={String(firmChanges.length)} />
        <Stat label="Confirmări ferme" value={String(firmConfirm.length)} />
        <Stat label="Nesigure (tu decizi)" value={String(nesigure.length)} />
      </div>

      <CurriculumQueue
        firmChanges={firmChanges}
        nesigure={nesigure}
        pendingFirmChanges={pendingFirmChanges}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
