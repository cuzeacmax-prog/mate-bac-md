/**
 * /app/azi — „Ce înveți azi" (ETAPA 60 PAS 4).
 * Server component sub proxy-ul de auth. ZERO LLM: doar frontier_concepts (RPC)
 * + numele prerechizitelor. Fără diagnostic făcut → empty state cu CTA.
 */
import Link from "next/link";
import { MathText } from "@/components/MathText";
import { domainKeyForSlug } from "@/lib/map/layouts";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { chisinauToday, computeStreak, getOrCreateDailyChallenge } from "@/lib/daily/daily";
import { DailyCard } from "./DailyCard";

export const dynamic = "force-dynamic";

interface FrontierRow {
  concept_id: string;
  slug: string;
  name: string;
  grade_level: number;
  mastery: number;
  verified_exercises: number;
  /** ETAPA 64: verificat CAS ∪ sursă-oficială (link strict-bijectiv) */
  servable_exercises: number;
  prereq_total: number;
  prereq_ok: number;
}

export default async function AziPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // proxy-ul redirectează; gardă defensivă

  const service = createServiceClient();

  // are vreo evidență? (fără diagnostic → empty state)
  const { count: evidenceCount } = await service
    .from("concept_mastery")
    .select("concept_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!evidenceCount) {
    return (
      <div className="relative max-w-2xl mx-auto px-6 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold">Ce înveți azi</h1>
        <p className="text-muted-foreground">
          Încă nu știm de unde să începem — fă întâi diagnosticul scurt (5–8 întrebări),
          ca să-ți găsim frontiera de învățare pe graful de concepte.
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

  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("grade_level")
    .eq("id", user.id)
    .maybeSingle();
  const grade = profileRow?.grade_level ?? 12;

  // ETAPA 14: daily challenge determinist (seed user+dată) + streak (zero LLM)
  const today = chisinauToday();
  const [daily, streak] = await Promise.all([
    getOrCreateDailyChallenge(service, user.id, grade, today),
    computeStreak(service, user.id, today),
  ]);

  const { data: frontier, error } = await service.rpc("frontier_concepts", {
    p_user_id: user.id,
    p_grade: grade,
    p_limit: 5,
  });
  if (error) {
    console.error("[azi] frontier_concepts error:", error.message);
  }
  const rows = (frontier ?? []) as FrontierRow[];

  // prerechizitele directe ale conceptelor afișate (pentru „de ce e următorul")
  const ids = rows.map((r) => r.concept_id);
  const prereqNames = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: edges } = await service
      .from("concept_edges")
      .select("from_concept, to_concept")
      .in("from_concept", ids);
    const prereqIds = [...new Set((edges ?? []).map((e) => e.to_concept as string))];
    const { data: prereqConcepts } = prereqIds.length
      ? await service.from("concepts").select("id, name").in("id", prereqIds)
      : { data: [] as Array<{ id: string; name: string }> };
    const nameById = new Map((prereqConcepts ?? []).map((c) => [c.id as string, c.name as string]));
    for (const e of edges ?? []) {
      const list = prereqNames.get(e.from_concept as string) ?? [];
      const n = nameById.get(e.to_concept as string);
      if (n) list.push(n);
      prereqNames.set(e.from_concept as string, list);
    }
  }

  return (
    <div className="relative max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ce înveți azi</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Frontiera ta de învățare: concepte pentru care ai deja fundamentul, alese din graful
            programei (clasa {grade}).
          </p>
        </div>
        <Link
          href="/app/harta"
          className="shrink-0 rounded-xl border border-primary/40 text-primary px-3.5 py-2 text-sm font-medium"
        >
          Vezi harta →
        </Link>
      </div>

      {daily && (
        <DailyCard exercises={daily.exercises} completed={daily.completed} streak={streak} />
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          Nu am găsit concepte de frontieră — fie totul e acoperit, fie e nevoie de mai multe
          răspunsuri la diagnostic.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const prereqs = prereqNames.get(r.concept_id) ?? [];
            // ETAPA 71 D: conceptul își poartă culoarea domeniului
            const dk = domainKeyForSlug(r.slug);
            return (
              <div
                key={r.concept_id}
                className="glass-solid rounded-2xl p-5 space-y-3 border-l-4"
                style={dk ? { borderLeftColor: `var(--domain-${dk})` } : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium leading-snug"><MathText text={r.name} /></h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      clasa {r.grade_level}
                      {Number(r.verified_exercises) > 0 &&
                        ` · ${r.verified_exercises} exerciții verificate`}
                      {Number(r.servable_exercises) > Number(r.verified_exercises) &&
                        ` · ${Number(r.servable_exercises) - Number(r.verified_exercises)} din culegerea oficială BAC`}
                    </p>
                  </div>
                  <Link
                    href={`/app/chat?concept=${encodeURIComponent(r.slug)}`}
                    className="shrink-0 rounded-xl text-primary-foreground px-4 py-2 text-sm font-medium"
                    style={{ background: dk ? `var(--domain-${dk})` : "var(--primary)" }}
                  >
                    Învață
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  {Number(r.prereq_total) === 0 ? (
                    "Fără prerechizite — punct de pornire."
                  ) : (
                    <MathText
                      text={`De ce e următorul: toate cele ${r.prereq_total} prerechizite ✓ (${prereqs
                        .slice(0, 4)
                        .join(", ")}${prereqs.length > 4 ? "…" : ""})`}
                    />
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
