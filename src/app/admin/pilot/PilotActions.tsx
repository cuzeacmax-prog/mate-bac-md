"use client";

/**
 * ETAPA 78 FAZA D — butoanele panoului pilot (client): toggle cohortă și
 * starea feedback-ului. După fiecare acțiune, pagina server se reîmprospătează.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PilotToggle({ userId, isPilot }: { userId: string; isPilot: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch("/api/admin/pilot/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, is_pilot: !isPilot }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
        isPilot
          ? "border-red-200 text-red-700 hover:bg-red-50"
          : "border-violet-200 text-violet-700 hover:bg-violet-50"
      } ${busy ? "opacity-50" : ""}`}
    >
      {isPilot ? "Scoate" : "+ Pilot"}
    </button>
  );
}

const NEXT: Record<string, string> = { nou: "vazut", vazut: "rezolvat", rezolvat: "nou" };
const STYLE: Record<string, string> = {
  nou: "bg-red-100 text-red-800",
  vazut: "bg-yellow-100 text-yellow-800",
  rezolvat: "bg-green-100 text-green-800",
};
const LABEL: Record<string, string> = { nou: "nou", vazut: "văzut", rezolvat: "rezolvat" };

export function FeedbackStatusButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function advance() {
    setBusy(true);
    await fetch("/api/admin/pilot/feedback-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: NEXT[status] ?? "vazut" }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      onClick={advance}
      disabled={busy}
      title="Click: nou → văzut → rezolvat"
      className={`text-xs font-medium px-2.5 py-1 rounded-full ${STYLE[status] ?? STYLE.nou} ${busy ? "opacity-50" : ""}`}
    >
      {LABEL[status] ?? status}
    </button>
  );
}
