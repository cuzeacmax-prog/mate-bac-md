"use client";

import { useState } from "react";
import FigureRenderer from "@/components/figures/FigureRenderer";
import Figure3DRenderer from "@/components/figures/Figure3DRenderer";
import type { FigureSpec2D } from "@/lib/figures/spec";
import type { FigureSpec3D } from "@/lib/figures/spec3d";

interface LiveResult {
  dim?: "2d" | "3d" | "none";
  verdict?: string;
  reason?: string;
  spec?: unknown;
  valid?: boolean;
  error?: string | null;
  message?: string;
  unsupported?: boolean;
  repaired?: number;
  diagnostic?: string | null;
  unsupportedRelation?: string | null;
}

const EXAMPLES = [
  "Triunghi isoscel ABC cu AB=AC=26, BC=20. Bisectoarea din A taie BC în M.",
  "Paralelogram ABCD cu ∠A=60°, AB:AD=1:2 și diagonala BD=3. Bisectoarea din A taie BD în K.",
  "Piramidă patrulateră regulată VABCD cu latura bazei 24 și înălțimea 12.",
  "Un con cu raza 5 și înălțimea 12.",
  "Câte numere de trei cifre distincte se pot forma cu cifrele 1..9?",
];

const VERDICT: Record<string, { label: string; cls: string }> = {
  figurabil_2d: { label: "2D figurabil", cls: "bg-blue-100 text-blue-800" },
  "3d": { label: "3D", cls: "bg-amber-100 text-amber-800" },
  fara_figura: { label: "fără figură", cls: "bg-gray-100 text-gray-600" },
};

export default function FigureLivePlayground() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<LiveResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!text.trim() || loading) return;
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/admin/figura-live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "eroare");
      setRes(j as LiveResult);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }

  const v = res?.verdict ? (VERDICT[res.verdict] ?? { label: res.verdict, cls: "bg-gray-100" }) : null;
  const canRender2d = !!(res?.dim === "2d" && res.valid && res.spec);
  const canRender3d = !!(res?.dim === "3d" && res.spec && !res.unsupported);

  return (
    <div>
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
          placeholder="Scrie condiția unei probleme de geometrie (ex. „Triunghi ABC cu AB=5, BC=6, CA=7…”). Ctrl/⌘+Enter trimite."
          rows={3}
          className="w-full rounded border border-gray-300 p-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <button onClick={submit} disabled={loading || !text.trim()} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-40">
            {loading ? "Se extrage…" : "Trimite"}
          </button>
          <span className="text-xs text-gray-400">playground live — fără persistare</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setText(ex)} className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100">
              {ex.length > 48 ? ex.slice(0, 48) + "…" : ex}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Eroare: {err}</div>}

      {res && (
        <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {v && <span className={`rounded px-1.5 py-0.5 font-medium ${v.cls}`}>{v.label}</span>}
            {res.dim === "2d" && (res.valid ? <span className="text-green-700">spec valid</span> : <span className="text-red-700">spec INVALID</span>)}
            {!!res.repaired && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">🔧 reparat ×{res.repaired}</span>}
            {res.reason && <span className="truncate">· {res.reason}</span>}
          </div>

          {res.unsupportedRelation && (
            <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">relație neacoperită: {res.unsupportedRelation} (s-a desenat ce s-a putut)</div>
          )}

          <div className="mt-3 flex flex-wrap items-start gap-6">
            <div>
              {canRender2d && <FigureRenderer spec={res.spec as FigureSpec2D} style="bac" size={400} />}
              {canRender3d && <Figure3DRenderer spec={res.spec as FigureSpec3D} size={440} />}
              {!canRender2d && !canRender3d && (
                <div className="flex h-[200px] w-[400px] items-center justify-center rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                  {res.diagnostic ?? res.message ?? (res.dim === "2d" && !res.valid ? "spec invalid — vezi eroarea de mai jos" : "—")}
                </div>
              )}
            </div>
            {res.spec != null && (
              <pre className="max-w-md overflow-auto rounded bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100" style={{ maxHeight: 440 }}>
{JSON.stringify(res.spec, null, 1)}
              </pre>
            )}
          </div>

          {res.dim === "2d" && !res.valid && res.error && (
            <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700 font-mono">{res.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
