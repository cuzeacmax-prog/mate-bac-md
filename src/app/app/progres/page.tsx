/**
 * /app/progres — ETAPA 68: dashboard-ul de progres al elevului.
 * Server component sub proxy. ZERO LLM; un singur batch paralel de query-uri
 * (lib/progres/data — aceeași funcție verificată de acceptanță).
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getProgressData } from "@/lib/progres/data";
import { ProgressMap } from "./ProgressMap";

export const metadata = { title: "Progres · Profesor Maxim" };

export const dynamic = "force-dynamic";

export default async function ProgresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // proxy-ul redirectează

  const service = createServiceClient();
  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("grade_level")
    .eq("id", user.id)
    .maybeSingle();
  const grade = (profileRow?.grade_level as number | null) ?? 12;

  const data = await getProgressData(service, user.id, grade);

  // empty state onest: fără nicio evidență → CTA spre diagnostic
  if (data.totals.mastered + data.totals.inProgress === 0 && data.exercisesSolved === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center space-y-4">
        <h1 className="fluid-h1 font-semibold">Progresul tău</h1>
        <p className="text-muted-foreground">
          Harta ta e încă goală — fă diagnosticul scurt ca să vedem de unde pornim,
          apoi fiecare lecție și exercițiu colorează câte o celulă.
        </p>
        <Link
          href="/onboarding/diagnostic-intro"
          className="inline-block rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium"
        >
          Fă diagnosticul
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 stagger-children">
      <div>
        <h1 className="fluid-h1 font-semibold">Progresul tău</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Harta conceptelor clasei {data.grade}, pe domeniile programei BAC.
        </p>
      </div>

      {/* cifrele */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Concepte stăpânite" value={`${data.totals.mastered}/${data.totals.total}`} />
        <StatCard label="În lucru" value={String(data.totals.inProgress)} />
        <StatCard label="Exerciții rezolvate" value={`${data.exercisesCorrect}/${data.exercisesSolved}`} hint="corecte / încercate" />
        <StatCard label="Streak" value={`🔥 ${data.streak}`} />
      </div>

      {/* predicția BAC — DOAR cu diagnostic terminat, ca interval onest */}
      {data.prediction && (
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
          <p className="text-xs font-semibold text-primary uppercase mb-1">Predicția BAC</p>
          <p className="text-2xl font-bold">
            {data.prediction.low.toFixed(1)} – {data.prediction.high.toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            estimare orientativă, din diagnostic — se rafinează pe măsură ce lucrezi
          </p>
        </div>
      )}

      {/* harta */}
      <ProgressMap domains={data.domains} />

      {/* ETAPA 70 G2: unde greșești des — top 3, cu link spre lecție */}
      {data.frequentMistakes.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold mb-3">Unde greșești des</h2>
          <ul className="space-y-2.5">
            {data.frequentMistakes.map((m) => (
              <li key={m.slug} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}· {m.wrongCount} {m.wrongCount === 1 ? "greșeală" : "greșeli"}
                    {m.module ? ` · ${m.module}` : ""}
                  </span>
                </span>
                <Link
                  href={`/app/chat?concept=${encodeURIComponent(m.slug)}`}
                  className="shrink-0 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium"
                >
                  Reia lecția →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ultimele activități */}
      {data.recent.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold mb-3">Ultimele activități</h2>
          <ul className="space-y-2">
            {data.recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className={r.correct === true ? "text-success" : r.correct === false ? "text-danger-foreground" : "text-muted-foreground"}>
                    {r.correct === true ? "✓" : r.correct === false ? "✗" : "•"}
                  </span>
                  {r.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.at).toLocaleDateString("ro-MD", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-1 rounded-2xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
