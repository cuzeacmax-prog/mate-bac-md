/**
 * /app/abonament — ETAPA 71 E3: starea abonamentului + fluxurile de plată.
 * Server component: refreshSubscription reconciliază starea cu timpul (trial
 * expirat, grație depășită) la fiecare încărcare; istoricul plăților vizibil.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refreshSubscription, getPlanConfig } from "@/lib/payments/state";
import { AbonamentActions } from "./AbonamentActions";

export const metadata = { title: "Abonament · Profesor Maxim" };

export const dynamic = "force-dynamic";

export default async function AbonamentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const [sub, plan, { data: attempts }] = await Promise.all([
    refreshSubscription(service, user.id),
    getPlanConfig(service),
    service
      .from("payment_attempts")
      .select("created_at, status, amount_lei, failure_reason")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  // refreshSubscription tocmai a reconciliat starea cu ACEST moment —
  // updated_at e referința de timp a randării (page = force-dynamic)
  const now = sub?.updated_at ? new Date(sub.updated_at).getTime() : new Date().getTime();
  const end = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000)) : 0;

  const stateLabel =
    !sub ? "Fără abonament — plan gratuit (30 mesaje/lună)"
    : sub.status === "trialing" ? `Trial Premium — ${daysLeft} ${daysLeft === 1 ? "zi rămasă" : "zile rămase"}`
    : sub.status === "active" && sub.cancel_at_period_end ? `Anulat — activ până pe ${end?.toLocaleDateString("ro-MD")}`
    : sub.status === "active" ? `Premium activ — se reînnoiește pe ${end?.toLocaleDateString("ro-MD")}`
    : sub.status === "past_due" ? "Plata a eșuat — reîncearcă (acces păstrat câteva zile)"
    : "Abonament încheiat — plan gratuit";

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Abonament</h1>

      {sub?.status === "past_due" && (
        <div className="rounded-xl bg-danger-bg text-danger-foreground px-4 py-3 text-sm">
          Ultima plată nu a reușit. Reîncearcă mai jos — accesul Premium se păstrează
          încă {plan.past_due_grace_days} zile, apoi contul trece politicos pe gratuit.
          Nimic din progresul tău nu se pierde.
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <p className="text-xs font-semibold text-primary uppercase">Starea curentă</p>
        <p className="font-medium">{stateLabel}</p>
        <p className="text-sm text-muted-foreground">
          Premium: {plan.price_lei} lei/lună — lecții și mesaje nelimitate, simulări, hartă completă.
        </p>
        <AbonamentActions
          status={sub?.status ?? null}
          cancelAtPeriodEnd={sub?.cancel_at_period_end ?? false}
        />
      </div>

      {(attempts ?? []).length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold mb-3">Istoricul plăților</h2>
          <ul className="space-y-2 text-sm">
            {(attempts ?? []).map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className={a.status === "success" ? "text-success-foreground" : a.status === "failed" ? "text-danger-foreground" : "text-muted-foreground"}>
                  {a.status === "success" ? "✓ plată reușită" : a.status === "failed" ? `✗ eșuată${a.failure_reason ? ` — ${a.failure_reason}` : ""}` : "anulare"}
                  {Number(a.amount_lei) > 0 ? ` · ${a.amount_lei} lei` : ""}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(a.created_at as string).toLocaleDateString("ro-MD", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
