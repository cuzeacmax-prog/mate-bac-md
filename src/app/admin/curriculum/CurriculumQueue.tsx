"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Proposal {
  id: string;
  concept_slug: string;
  concept_name: string;
  current_grade: number | null;
  proposed_grade: number | null;
  confidence: "firm" | "nesigur";
  source: string | null;
  reason: string | null;
  candidates: Array<{ grade: number; entry: string; page: number; coverage: number }>;
  status: "pending" | "accepted" | "corrected" | "rejected";
  decided_grade: number | null;
}

const GRADES = [9, 10, 11, 12];

export function CurriculumQueue({
  firmChanges,
  nesigure,
  pendingFirmChanges,
}: {
  firmChanges: Proposal[];
  nesigure: Proposal[];
  pendingFirmChanges: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"firm" | "nesigur">("firm");

  async function act(action: string, id?: string, grade?: number) {
    setBusy(id ?? action);
    try {
      const r = await fetch("/api/admin/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, grade }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        alert(d?.error ?? "Eroare");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const rows = tab === "firm" ? firmChanges : nesigure;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTab("firm")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "firm" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Schimbări ferme ({firmChanges.length})
        </button>
        <button
          onClick={() => setTab("nesigur")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "nesigur" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Nesigure ({nesigure.length})
        </button>
        {tab === "firm" && pendingFirmChanges > 0 && (
          <button
            onClick={() => {
              if (confirm(`Aplici TOATE cele ${pendingFirmChanges} schimbări ferme rămase? Scrie grade_level pe concepte.`)) {
                act("confirm_firm");
              }
            }}
            disabled={busy === "confirm_firm"}
            className="ml-auto rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy === "confirm_firm" ? "Se aplică…" : `Confirmă toate ferme (${pendingFirmChanges})`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Concept</th>
              <th className="px-3 py-2 font-medium">Acum</th>
              <th className="px-3 py-2 font-medium">Propus</th>
              <th className="text-left px-3 py-2 font-medium">Sursă (manual + pagină)</th>
              <th className="px-3 py-2 font-medium">Stare</th>
              <th className="px-3 py-2 font-medium">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 400).map((p) => (
              <tr key={p.id} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">{p.concept_name}</div>
                  <div className="text-xs text-gray-400 font-mono">{p.concept_slug}</div>
                </td>
                <td className="px-3 py-2 text-center text-gray-700">{p.current_grade ?? "—"}</td>
                <td className="px-3 py-2 text-center font-semibold text-gray-900">{p.proposed_grade ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">
                  {p.source ?? <span className="italic">{p.reason}</span>}
                  {p.confidence === "nesigur" && p.candidates.length > 0 && (
                    <div className="mt-1 text-gray-400">
                      candidați: {p.candidates.map((c) => `cl.${c.grade}`).join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {p.status === "pending" ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className="text-emerald-700 font-medium">{p.status} → {p.decided_grade}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    {p.proposed_grade != null && (
                      <button
                        onClick={() => act("accept", p.id)}
                        disabled={busy === p.id || p.status !== "pending"}
                        className="rounded bg-emerald-600 text-white px-2 py-1 text-xs font-medium disabled:opacity-40"
                      >
                        Acceptă
                      </button>
                    )}
                    <select
                      defaultValue=""
                      disabled={busy === p.id}
                      onChange={(e) => { if (e.target.value) act("correct", p.id, Number(e.target.value)); }}
                      className="rounded border border-gray-300 px-1 py-1 text-xs"
                    >
                      <option value="">Corectează…</option>
                      {GRADES.map((g) => <option key={g} value={g}>clasa {g}</option>)}
                    </select>
                    <button
                      onClick={() => act("reject", p.id)}
                      disabled={busy === p.id || p.status !== "pending"}
                      className="rounded bg-gray-200 text-gray-700 px-2 py-1 text-xs font-medium disabled:opacity-40"
                    >
                      Lasă
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 400 && <p className="text-xs text-gray-400">Se afișează primele 400 din {rows.length}.</p>}
    </div>
  );
}
