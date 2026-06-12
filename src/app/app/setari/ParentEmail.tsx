"use client";

/**
 * ETAPA 78 C1 — emailul părintelui: când e setat, raportul săptămânal de
 * duminică pleacă și către părinte. Gol = doar elevul.
 */
import { useState } from "react";
import { Users } from "lucide-react";

export function ParentEmail({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState<string>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const resp = await fetch("/api/profile/parent-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_email: value.trim() }),
    });
    if (resp.ok) {
      setSaved(value.trim());
    } else {
      const data = (await resp.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Nu s-a putut salva.");
    }
    setBusy(false);
  }

  const dirty = value.trim() !== saved;

  return (
    <section className="glass-solid rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-primary shrink-0" />
        <div>
          <p className="font-semibold text-sm">Emailul părintelui (opțional)</p>
          <p className="text-xs text-muted-foreground">
            Raportul săptămânal de duminică ajunge și la părinte. Lasă gol dacă nu vrei.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="parinte@email.com"
          className="flex-1 rounded-xl glass-1 px-3 py-2 text-sm bg-transparent border border-[var(--glass-2)] outline-none focus:border-primary"
        />
        {dirty && (
          <button
            onClick={save}
            disabled={busy}
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shrink-0"
          >
            {busy ? "..." : "Salvează"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
