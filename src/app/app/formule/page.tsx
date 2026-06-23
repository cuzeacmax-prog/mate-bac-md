import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFormulaSheet } from "@/lib/formule/data";
import { MathText } from "@/components/MathText";
import { PrintButton } from "./PrintButton";

/**
 * /app/formule — ETAPA 83 FAZA I: foaia de formule a clasei (anexă servabilă,
 * construită determinist din lecțiile canonice — R5, zero formule inventate).
 * Printabilă/descărcabilă, cu status „de revizuit" → „verificat de profesor".
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Formular · Profesor Maxim" };

export default async function FormulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRow } = await supabase
    .from("user_profiles").select("grade_level").eq("id", user.id).maybeSingle();
  const grade = (profileRow?.grade_level as number | null) ?? 12;

  const { sheet, status, approvedBy } = await getFormulaSheet(createServiceClient(), grade);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="fluid-h1 font-semibold">{sheet.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sheet.count} formule cheie, din lecțiile verificate — ca anexa oficială de BAC. Printează sau salvează PDF.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* status: de revizuit → verificat de profesor */}
      <div className="print:hidden">
        {status === "verificat" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg text-success-foreground px-3 py-1 text-xs font-semibold">
            ✓ verificat de profesor{approvedBy ? ` (${approvedBy})` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg text-warning-foreground px-3 py-1 text-xs font-semibold">
            de revizuit — în curs de verificare
          </span>
        )}
      </div>

      {sheet.sections.length === 0 ? (
        <p className="text-muted-foreground">Încă nu sunt formule canonice pentru clasa ta — se construiesc din lecții.</p>
      ) : (
        <div className="printable-sheet space-y-5">
          {sheet.sections.map((sec) => (
            <section key={sec.slug} className="rounded-2xl border bg-card p-5 break-inside-avoid">
              <h2 className="fluid-h2 font-semibold mb-3 capitalize">{sec.name}</h2>
              <ul className="space-y-2">
                {sec.formulas.map((f, i) => (
                  <li key={i} className="rounded-xl bg-math-surface px-3 py-2 overflow-x-auto">
                    <MathText text={`$$${f}$$`} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
