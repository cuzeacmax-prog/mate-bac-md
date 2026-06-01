"use client";

import { useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { segmentMath } from "@/lib/content-math";
import FigureRenderer from "@/components/figures/FigureRenderer";
import type { FigureSpec2D } from "@/lib/figures/spec";

export interface FigItem {
  id: string;
  spec: FigureSpec2D | null;
  verdict: string;
  valid: boolean | null;
  validationError: string | null;
  humanStatus: string | null;
  module: string | null;
  exerciseNumber: string;
  statement: string;
}

function Tex({ tex }: { tex: string }) {
  let html = "";
  try { html = katex.renderToString(tex, { throwOnError: true, strict: false }); }
  catch { return <code className="text-red-700 text-xs">{tex}</code>; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
function Prose({ text }: { text: string }) {
  return <>{segmentMath(text).map((s, i) => (s.type === "math" ? <Tex key={i} tex={s.value} /> : <span key={i}>{s.value}</span>))}</>;
}

const VERDICT: Record<string, { label: string; cls: string }> = {
  figurabil_2d: { label: "2D figurabil", cls: "bg-blue-100 text-blue-800" },
  "3d": { label: "3D — refuzat", cls: "bg-amber-100 text-amber-800" },
  fara_figura: { label: "fără figură", cls: "bg-gray-100 text-gray-600" },
};

export default function FiguriReviziePanel({ items }: { items: FigItem[] }) {
  const [rows, setRows] = useState<FigItem[]>(items);
  const [filter, setFilter] = useState<string>("");
  const [saving, setSaving] = useState<string | null>(null);

  const counts = useMemo(() => ({
    total: rows.length,
    twoD: rows.filter((r) => r.verdict === "figurabil_2d").length,
    valid: rows.filter((r) => r.verdict === "figurabil_2d" && r.valid).length,
    threeD: rows.filter((r) => r.verdict === "3d").length,
    none: rows.filter((r) => r.verdict === "fara_figura").length,
    reviewed: rows.filter((r) => r.humanStatus).length,
  }), [rows]);

  const shown = useMemo(() => rows.filter((r) => !filter || (filter === "valid2d" ? r.verdict === "figurabil_2d" && r.valid : r.verdict === filter)), [rows, filter]);

  async function verdict(id: string, human_status: string | null) {
    setSaving(id);
    try {
      const res = await fetch("/api/admin/figuri-revizie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, human_status }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "eroare");
      setRows((p) => p.map((r) => (r.id === id ? { ...r, humanStatus: human_status } : r)));
    } catch (e) { alert(`Eroare: ${(e as Error).message}`); } finally { setSaving(null); }
  }

  const sel = "border border-gray-300 rounded px-2 py-1 text-sm";
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Revizie figuri — enunț → spec → randare</h1>
      <p className="mt-1 text-sm text-gray-600">AI-ul PROPUNE figura din enunț; tu confirmi/respingi. Stereometria 3D e refuzată onest (nu fabricată 2D).</p>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span>Total: <strong>{counts.total}</strong></span>
        <span className="text-blue-700">2D: {counts.twoD} (valide {counts.valid})</span>
        <span className="text-amber-700">3D: {counts.threeD}</span>
        <span className="text-gray-500">fără: {counts.none}</span>
        <span className="text-green-700">👤 revizuite: {counts.reviewed}</span>
      </div>

      <div className="mt-3 flex gap-2">
        <select className={sel} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">toate</option>
          <option value="valid2d">2D valide (cu figură)</option>
          <option value="figurabil_2d">2D (toate)</option>
          <option value="3d">3D refuzate</option>
          <option value="fara_figura">fără figură</option>
        </select>
      </div>

      <div className="mt-4 space-y-3">
        {shown.map((r) => {
          const v = VERDICT[r.verdict] ?? { label: r.verdict, cls: "bg-gray-100" };
          const canRender = r.verdict === "figurabil_2d" && r.valid && r.spec;
          return (
            <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className={`rounded px-1.5 py-0.5 font-medium ${v.cls}`}>{v.label}</span>
                <span>{r.module} · nr.{r.exerciseNumber}</span>
                {r.verdict === "figurabil_2d" && (r.valid ? <span className="text-green-700">spec valid</span> : <span className="text-red-700">spec INVALID</span>)}
                {r.humanStatus && <span className={`ml-auto rounded px-1.5 py-0.5 font-medium ${r.humanStatus === "confirmat" ? "bg-green-200 text-green-900" : "bg-red-200 text-red-900"}`}>👤 {r.humanStatus}</span>}
              </div>

              <div className="mt-2 flex flex-wrap items-start gap-6">
                <div className="max-w-xl flex-1 text-sm text-gray-900">
                  <Prose text={r.statement} />
                  {!r.valid && r.validationError && r.verdict === "figurabil_2d" && (
                    <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700 font-mono">{r.validationError}</div>
                  )}
                </div>
                <div>
                  {canRender ? (
                    <FigureRenderer spec={r.spec as FigureSpec2D} style="bac" size={340} />
                  ) : (
                    <div className="flex h-[200px] w-[340px] items-center justify-center rounded border border-dashed border-gray-300 text-center text-xs text-gray-400">
                      {r.verdict === "3d" ? "stereometrie 3D — nereprezentabil în 2D (refuzat onest)" : r.verdict === "fara_figura" ? "fără figură" : "spec invalid — vezi eroarea"}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 flex gap-2">
                <button disabled={saving === r.id} onClick={() => verdict(r.id, "confirmat")} className="rounded border border-green-300 bg-white px-2 py-0.5 text-xs text-green-800 hover:bg-green-100 disabled:opacity-40">✓ Confirmă</button>
                <button disabled={saving === r.id} onClick={() => verdict(r.id, "respins")} className="rounded border border-red-300 bg-white px-2 py-0.5 text-xs text-red-800 hover:bg-red-100 disabled:opacity-40">✗ Respinge</button>
                {r.humanStatus && <button disabled={saving === r.id} onClick={() => verdict(r.id, null)} className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40">↺ Reset</button>}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <div className="py-12 text-center text-sm text-gray-500">Nimic de afișat. Rulează `npm run extract:figures`.</div>}
      </div>
    </div>
  );
}
