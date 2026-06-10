"use client";

/**
 * /app/abonament/checkout — ETAPA 71 E3: pagina de checkout MOCK.
 * Simulează pagina providerului: confirmarea/eșecul trimit evenimentul
 * SEMNAT prin /api/payments/mock-pay (același drum ca webhook-ul real).
 * Providerul real va înlocui DOAR această pagină cu redirectul lui.
 */
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get("ref") ?? "";
  const pret = params.get("pret") ?? "199";
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(outcome: "ok" | "fail") {
    setPending(outcome);
    setError(null);
    try {
      const resp = await fetch("/api/payments/mock-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, outcome }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      router.push("/app/abonament");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
      setPending(null);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 space-y-5 text-center">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Checkout simulat (provider mock)</p>
      <h1 className="text-2xl font-bold">Premium — {pret} lei/lună</h1>
      <p className="text-sm text-muted-foreground">
        Referința plății: <code className="text-xs">{ref}</code>
      </p>
      <div className="space-y-2">
        <button
          onClick={() => pay("ok")}
          disabled={!!pending}
          className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-50"
        >
          {pending === "ok" ? "Se procesează…" : `Confirmă plata — ${pret} lei`}
        </button>
        <button
          onClick={() => pay("fail")}
          disabled={!!pending}
          className="w-full rounded-xl border py-3 text-sm text-muted-foreground disabled:opacity-50"
        >
          Simulează plată eșuată
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  );
}
