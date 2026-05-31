"use client";

import { useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { segmentMath } from "@/lib/content-math";

export interface VItem {
  id: string;
  subpart: string | null;
  method: string;
  computed_latex: string | null;
  verified: boolean | null;
  note: string | null;
  human_status: string | null;
  human_note: string | null;
  exercise_number: string;
  module: string | null;
  section: string | null;
  statement: string;
}

// ── KaTeX ────────────────────────────────────────────────────────────────────
function Tex({ tex, display }: { tex: string; display?: boolean }) {
  let html = "", err: string | null = null;
  try {
    html = katex.renderToString(tex, { displayMode: !!display, throwOnError: true, strict: false });
  } catch (e) {
    err = e instanceof Error ? e.message.replace(/^KaTeX parse error:\s*/, "") : "eroare KaTeX";
  }
  if (err) return <code className="text-red-700 text-xs">⚠ {tex}</code>;
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Proză cu math inline randat prin KaTeX. */
function Prose({ text }: { text: string }) {
  const segs = segmentMath(text);
  return (
    <>
      {segs.map((s, i) =>
        s.type === "math" ? <Tex key={i} tex={s.value} /> : <span key={i}>{s.value}</span>,
      )}
    </>
  );
}

function statusOf(v: boolean | null): { icon: string; label: string; cls: string } {
  if (v === true) return { icon: "✅", label: "verificat", cls: "bg-green-50 border-green-200" };
  if (v === false) return { icon: "❌", label: "infirmat", cls: "bg-red-50 border-red-200" };
  return { icon: "⚠", label: "neconfirmat", cls: "bg-amber-50 border-amber-200" };
}

const METHOD_LABELS: Record<string, string> = {
  cas_sympy_integral: "integrală nedef.",
  self_check_param: "param. subst.",
  verify_primitive: "primitivă",
  definite: "integrală def.",
  area_volume: "arie/volum",
  rotation_volume: "volum rotație",
};

export default function VerificarePanel({ items }: { items: VItem[] }) {
  const [rows, setRows] = useState<VItem[]>(items);
  const [fMethod, setFMethod] = useState("");
  const [fModule, setFModule] = useState("");
  const [fStatus, setFStatus] = useState(""); // "", "true", "false", "null"
  const [fHuman, setFHuman] = useState(""); // "", "none", "confirmat", "respins"
  const [saving, setSaving] = useState<string | null>(null);

  const methods = useMemo(() => [...new Set(items.map((i) => i.method))].sort(), [items]);
  const modules = useMemo(() => [...new Set(items.map((i) => i.module ?? ""))].filter(Boolean).sort(), [items]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (fMethod && r.method !== fMethod) return false;
    if (fModule && (r.module ?? "") !== fModule) return false;
    if (fStatus === "true" && r.verified !== true) return false;
    if (fStatus === "false" && r.verified !== false) return false;
    if (fStatus === "null" && r.verified !== null) return false;
    if (fHuman === "none" && r.human_status) return false;
    if (fHuman === "confirmat" && r.human_status !== "confirmat") return false;
    if (fHuman === "respins" && r.human_status !== "respins") return false;
    return true;
  }), [rows, fMethod, fModule, fStatus, fHuman]);

  const counts = useMemo(() => ({
    total: rows.length,
    ok: rows.filter((r) => r.verified === true).length,
    bad: rows.filter((r) => r.verified === false).length,
    unc: rows.filter((r) => r.verified === null).length,
    reviewed: rows.filter((r) => r.human_status).length,
  }), [rows]);

  async function verdict(id: string, human_status: string | null) {
    setSaving(id);
    const note = human_status ? (prompt("Notă (opțional):") ?? "") : "";
    try {
      const res = await fetch("/api/admin/verificare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, human_status, human_note: note || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "eroare");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, human_status, human_note: note || null } : r)));
    } catch (e) {
      alert(`Eroare: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  const selCls = "border border-gray-300 rounded px-2 py-1 text-sm";
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Verificare CAS — revizie umană</h1>
      <p className="mt-1 text-sm text-gray-600">
        A treia poartă: CAS verifică ce poate, <strong>profesorul</strong> confirmă/respinge restul.
        Neconfirmatele (❌/⚠) cer ochiul uman.
      </p>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span>Total: <strong>{counts.total}</strong></span>
        <span className="text-green-700">✅ {counts.ok}</span>
        <span className="text-red-700">❌ {counts.bad}</span>
        <span className="text-amber-700">⚠ {counts.unc}</span>
        <span className="text-blue-700">👤 revizuite: {counts.reviewed}</span>
        <span className="text-gray-500">afișate: {filtered.length}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <select className={selCls} value={fModule} onChange={(e) => setFModule(e.target.value)}>
          <option value="">toate modulele</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className={selCls} value={fMethod} onChange={(e) => setFMethod(e.target.value)}>
          <option value="">toate metodele</option>
          {methods.map((m) => <option key={m} value={m}>{METHOD_LABELS[m] ?? m}</option>)}
        </select>
        <select className={selCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">orice status CAS</option>
          <option value="true">✅ verificat</option>
          <option value="false">❌ infirmat</option>
          <option value="null">⚠ neconfirmat</option>
        </select>
        <select className={selCls} value={fHuman} onChange={(e) => setFHuman(e.target.value)}>
          <option value="">orice verdict uman</option>
          <option value="none">nerevizuit</option>
          <option value="confirmat">confirmat</option>
          <option value="respins">respins</option>
        </select>
        <button className={selCls + " text-gray-600"} onClick={() => { setFStatus("false"); }}>
          ⚡ doar problemele
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((r) => {
          const st = statusOf(r.verified);
          return (
            <div key={r.id} className={`rounded border p-3 ${st.cls}`}>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-mono">{st.icon} {st.label}</span>
                <span className="rounded bg-white/70 px-1.5 py-0.5">{METHOD_LABELS[r.method] ?? r.method}</span>
                <span>{r.module}</span>
                {r.section && <span className="truncate max-w-[200px]">· {r.section}</span>}
                <span>· nr.{r.exercise_number}{r.subpart ? ` (${r.subpart})` : ""}</span>
                {r.human_status && (
                  <span className={`ml-auto rounded px-1.5 py-0.5 font-medium ${r.human_status === "confirmat" ? "bg-green-200 text-green-900" : "bg-red-200 text-red-900"}`}>
                    👤 {r.human_status}
                  </span>
                )}
              </div>

              <div className="mt-2 text-sm text-gray-900">
                <Prose text={r.statement} />
              </div>

              <div className="mt-1.5 flex items-baseline gap-2 text-sm">
                <span className="text-xs text-gray-500">CAS →</span>
                {r.computed_latex ? <Tex tex={r.computed_latex} display /> : <span className="text-gray-400 text-xs">{r.note ?? "—"}</span>}
              </div>
              {r.computed_latex && r.note && (
                <div className="mt-0.5 text-[11px] text-gray-400 font-mono truncate">{r.note}</div>
              )}
              {r.human_note && <div className="mt-1 text-xs text-blue-700">👤 {r.human_note}</div>}

              <div className="mt-2 flex gap-2">
                <button
                  disabled={saving === r.id}
                  onClick={() => verdict(r.id, "confirmat")}
                  className="rounded border border-green-300 bg-white px-2 py-0.5 text-xs text-green-800 hover:bg-green-100 disabled:opacity-40"
                >✓ Confirmă</button>
                <button
                  disabled={saving === r.id}
                  onClick={() => verdict(r.id, "respins")}
                  className="rounded border border-red-300 bg-white px-2 py-0.5 text-xs text-red-800 hover:bg-red-100 disabled:opacity-40"
                >✗ Respinge</button>
                {r.human_status && (
                  <button
                    disabled={saving === r.id}
                    onClick={() => verdict(r.id, null)}
                    className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >↺ Reset</button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-500">Nimic de afișat cu filtrele curente.</div>}
      </div>
    </div>
  );
}
