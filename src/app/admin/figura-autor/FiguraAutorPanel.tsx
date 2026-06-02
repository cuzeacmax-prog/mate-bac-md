"use client";

import { useMemo, useState } from "react";

interface GateCheck { id?: string; name?: string; pass: boolean; detail: string }
interface GateBlock { ok: boolean; checks: GateCheck[] }
export interface AutorItem {
  id: string;
  slug: string;
  condition: string;
  desiredKind: string | null;
  desiredRef: string | null;
  inputKind: string | null;
  gates: { numeric: GateBlock; visual: GateBlock; desiredMatch: GateBlock } | null;
  renderPng: string | null;
  status: string | null;
  verdict: string | null;
  iteratii: number;
}

function GateList({ title, block }: { title: string; block?: GateBlock }) {
  if (!block) return null;
  return (
    <div className="text-xs">
      <div className={block.ok ? "font-medium text-green-700" : "font-medium text-red-700"}>{block.ok ? "✅" : "⛔"} {title}</div>
      <ul className="ml-3 mt-0.5 space-y-0.5">
        {block.checks.map((c, i) => (
          <li key={i} className={c.pass ? "text-gray-600" : "text-red-700"}>
            {c.pass ? "·" : "✗"} {c.name ?? c.id}: <span className="text-gray-500">{c.detail}</span>
          </li>
        ))}
        {block.checks.length === 0 && <li className="text-gray-400">— fără invariante numerice de verificat</li>}
      </ul>
    </div>
  );
}

const STATUS: Record<string, string> = { "auto-acceptat": "bg-green-100 text-green-800", "marcat-uman": "bg-amber-100 text-amber-800" };
const VERDICT: Record<string, string> = { aprobat: "bg-emerald-600 text-white", respins: "bg-red-600 text-white" };

export default function FiguraAutorPanel({ items }: { items: AutorItem[] }) {
  const [rows, setRows] = useState<AutorItem[]>(items);
  const [saving, setSaving] = useState<string | null>(null);

  const counts = useMemo(() => ({
    total: rows.length,
    auto: rows.filter((r) => r.status === "auto-acceptat").length,
    marked: rows.filter((r) => r.status === "marcat-uman").length,
    reviewed: rows.filter((r) => r.verdict).length,
  }), [rows]);

  async function setVerdict(id: string, verdict: string | null) {
    setSaving(id);
    try {
      const res = await fetch("/api/admin/figura-autor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, verdict }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "eroare");
      setRows((p) => p.map((r) => (r.id === id ? { ...r, verdict } : r)));
    } catch (e) { alert(`Eroare: ${(e as Error).message}`); } finally { setSaving(null); }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Bucla de autorat — DORIT vs GENERAT</h1>
      <p className="mt-1 text-sm text-gray-600">
        (condiție + desen dorit) → CAS + porți (numerice + vizuale + potrivire cu doritul) → persistat aici. Compari desenul DORIT cu RANDAREA GENERATĂ și aprobi/respingi. Porțile fac ca la scară să fie corect-sau-marcat, niciodată greșit.
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span>Total: <strong>{counts.total}</strong></span>
        <span className="text-green-700">auto-acceptate: {counts.auto}</span>
        <span className="text-amber-700">marcate pt. om: {counts.marked}</span>
        <span className="text-emerald-700">👤 revizuite: {counts.reviewed}</span>
      </div>

      <div className="mt-4 space-y-6">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <code className="text-sm font-medium text-gray-900">{r.slug}</code>
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS[r.status ?? ""] ?? "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                <span className="text-xs text-gray-400">{r.inputKind} · {r.iteratii} iter</span>
                {r.verdict && <span className={`rounded px-2 py-0.5 text-xs ${VERDICT[r.verdict]}`}>{r.verdict}</span>}
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={saving === r.id} onClick={() => setVerdict(r.id, "aprobat")} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-40">Aprobă</button>
                <button type="button" disabled={saving === r.id} onClick={() => setVerdict(r.id, "respins")} className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-40">Respinge</button>
                {r.verdict && <button type="button" disabled={saving === r.id} onClick={() => setVerdict(r.id, null)} className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">↺</button>}
              </div>
            </div>

            <p className="mt-2 text-sm text-gray-700">{r.condition}</p>

            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* DORIT */}
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Desen DORIT (referință)</div>
                {r.desiredKind === "image" && r.desiredRef
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={r.desiredRef} alt="dorit" className="rounded border border-gray-200" />
                  : <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">{r.desiredRef}</div>}
              </div>
              {/* GENERAT */}
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Randare GENERATĂ</div>
                {r.renderPng
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={r.renderPng} alt="generat" className="rounded border border-gray-200" />
                  : <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-400">fără randare</div>}
              </div>
              {/* PORȚI */}
              <div className="space-y-2">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Porți</div>
                <GateList title="numerice (invariante + reproduce numerele)" block={r.gates?.numeric} />
                <GateList title="vizuală (randare)" block={r.gates?.visual} />
                <GateList title="potrivire cu DORIT" block={r.gates?.desiredMatch} />
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-500">Niciun caz. Rulează <code>npm run figura:autor</code>.</p>}
      </div>
    </div>
  );
}
