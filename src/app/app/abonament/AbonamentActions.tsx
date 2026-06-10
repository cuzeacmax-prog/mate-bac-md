"use client";

/**
 * AbonamentActions — ETAPA 71 E3: butoanele fluxului de plată.
 * Activează → /api/payments/checkout → pagina de checkout (mock);
 * Reîncearcă (past_due) → același checkout; Anulează → cancel_at_period_end.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AbonamentActions({ status, cancelAtPeriodEnd }: {
  status: "trialing" | "active" | "past_due" | "canceled" | null;
  cancelAtPeriodEnd: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setPending(true);
    setError(null);
    try {
      const resp = await fetch("/api/payments/checkout", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      router.push(data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
      setPending(false);
    }
  }

  async function cancel() {
    if (!confirm("Anulezi abonamentul? Rămâne activ până la finalul perioadei plătite.")) return;
    setPending(true);
    setError(null);
    try {
      const resp = await fetch("/api/payments/cancel", { method: "POST" });
      if (!resp.ok) throw new Error((await resp.json()).error ?? "Eroare");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  const showActivate = !status || status === "canceled" || status === "trialing" || status === "past_due";
  const showCancel = (status === "active" || status === "trialing") && !cancelAtPeriodEnd;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {showActivate && (
          <button
            onClick={startCheckout}
            disabled={pending}
            className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {status === "past_due" ? "Reîncearcă plata" : "Activează Premium →"}
          </button>
        )}
        {showCancel && (
          <button
            onClick={cancel}
            disabled={pending}
            className="rounded-xl border px-5 py-2.5 text-sm text-muted-foreground disabled:opacity-50"
          >
            Anulează abonamentul
          </button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
