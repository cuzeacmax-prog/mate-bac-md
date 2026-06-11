"use client";

/**
 * ApproveLessonForm — ETAPA 75 B4: butonul Aprobă + câmpul de observații.
 * Aprobarea e acțiunea profesorului (Maxim) — abia ea aprinde badge-ul la elev.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApproveLessonForm({ id, status, observatii: initial }: {
  id: string;
  status: string;
  observatii: string;
}) {
  const router = useRouter();
  const [observatii, setObservatii] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(approve: boolean) {
    setPending(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/lectii/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approve, observatii }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? `HTTP ${resp.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  const approved = status === "aprobat-profesor";
  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">
          Status:{" "}
          <span className={approved ? "text-green-700" : "text-amber-700"}>
            {approved ? "✓ aprobată de profesor" : "generată — de revizuit"}
          </span>
        </p>
        <div className="flex gap-2">
          {!approved && (
            <button
              onClick={() => submit(true)}
              disabled={pending}
              className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Aprobă lecția
            </button>
          )}
          <button
            onClick={() => submit(false)}
            disabled={pending}
            className="rounded-lg border px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
          >
            Salvează doar observațiile
          </button>
        </div>
      </div>
      <textarea
        value={observatii}
        onChange={(e) => setObservatii(e.target.value)}
        placeholder="Observații (opțional): ce trebuie corectat la regenerare…"
        rows={2}
        className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
