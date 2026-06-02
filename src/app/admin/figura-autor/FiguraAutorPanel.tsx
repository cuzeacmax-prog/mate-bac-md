"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface GateCheck { id?: string; name?: string; pass: boolean; detail: string }
interface GateBlock { ok: boolean; checks: GateCheck[] }
interface Pin { x: number; y: number; text: string }
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
  remarci: { text?: string; pins?: Pin[] } | null;
  iteratii: number;
}

function GateList({ title, block }: { title: string; block?: GateBlock }) {
  if (!block) return null;
  return (
    <div className="text-xs">
      <div className={block.ok ? "font-medium text-green-700" : "font-medium text-red-700"}>{block.ok ? "✅" : "⛔"} {title}</div>
      <ul className="ml-3 mt-0.5 space-y-0.5">
        {block.checks.map((c, i) => (
          <li key={i} className={c.pass ? "text-gray-600" : "text-red-700"}>{c.pass ? "·" : "✗"} {c.name ?? c.id}: <span className="text-gray-500">{c.detail}</span></li>
        ))}
        {block.checks.length === 0 && <li className="text-gray-400">— fără invariante de verificat</li>}
      </ul>
    </div>
  );
}

const STATUS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700", "auto-acceptat": "bg-green-100 text-green-800",
  "marcat-uman": "bg-amber-100 text-amber-800", needs_revision: "bg-orange-100 text-orange-800",
  approved: "bg-emerald-600 text-white", rejected: "bg-red-600 text-white",
};

export default function FiguraAutorPanel({ items }: { items: AutorItem[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<AutorItem[]>(items);
  const [saving, setSaving] = useState<string | null>(null);
  // formular de intrare
  const [condition, setCondition] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // remarci în lucru, per rând: { text, pins }
  const [draft, setDraft] = useState<Record<string, { text: string; pins: Pin[] }>>({});

  const counts = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    auto: rows.filter((r) => r.status === "auto-acceptat").length,
    revision: rows.filter((r) => r.status === "needs_revision").length,
    approved: rows.filter((r) => r.status === "approved").length,
  }), [rows]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader(); reader.onload = () => setImageDataUrl(reader.result as string); reader.readAsDataURL(f);
  }
  async function submitCase() {
    if (!condition.trim()) { alert("Scrie condiția."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/figura-autor/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condition, imageDataUrl }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? "eroare");
      setCondition(""); setImageDataUrl(null); router.refresh();
    } catch (e) { alert(`Eroare: ${(e as Error).message}`); } finally { setSubmitting(false); }
  }

  async function setVerdict(id: string, verdict: string | null) {
    setSaving(id);
    try {
      const res = await fetch("/api/admin/figura-autor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, verdict }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "eroare");
      setRows((p) => p.map((r) => (r.id === id ? { ...r, verdict, status: verdict ?? r.status } : r)));
    } catch (e) { alert(`Eroare: ${(e as Error).message}`); } finally { setSaving(null); }
  }
  async function submitRemarks(id: string) {
    const d = draft[id] ?? { text: "", pins: [] };
    if (!d.text.trim() && d.pins.length === 0) { alert("Adaugă o remarcă (text sau pin pe figură)."); return; }
    setSaving(id);
    try {
      const res = await fetch("/api/admin/figura-autor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, remarci: d }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "eroare");
      setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "needs_revision", remarci: d } : r)));
      setDraft((p) => ({ ...p, [id]: { text: "", pins: [] } }));
    } catch (e) { alert(`Eroare: ${(e as Error).message}`); } finally { setSaving(null); }
  }
  function addPin(id: string, e: React.MouseEvent<HTMLImageElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100), y = Math.round(((e.clientY - r.top) / r.height) * 100);
    const text = window.prompt(`Remarcă la (${x},${y}) — ex. „eticheta greșită", „apex prea jos":`) ?? "";
    if (!text.trim()) return;
    setDraft((p) => { const cur = p[id] ?? { text: "", pins: [] }; return { ...p, [id]: { ...cur, pins: [...cur.pins, { x, y, text: text.trim() }] } }; });
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Bucla de autorat — condiție + desen dorit + remarci</h1>
      <p className="mt-1 text-sm text-gray-600">Încarci (condiție + desen DORIT) → „<code>npm run figura:coada</code>” (Claude Code) generează + porți → compari DORIT vs GENERAT, pui REMARCI (text + pini pe figură) sau aprobi. Remarcile alimentează bucla de corecție.</p>

      {/* FORMULAR DE INTRARE */}
      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Caz nou</div>
        <textarea value={condition} onChange={(e) => setCondition(e.target.value)} rows={3} placeholder="Condiția (enunțul)…" className="w-full rounded border border-gray-300 p-2 text-sm" />
        <div className="mt-2 flex items-center gap-3">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="text-sm" />
          {imageDataUrl && <span className="text-xs text-green-700">desen dorit atașat ✓</span>}
          <button type="button" disabled={submitting} onClick={submitCase} className="ml-auto rounded bg-gray-900 px-4 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-40">{submitting ? "Se trimite…" : "Adaugă în coadă (pending)"}</button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span>Total: <strong>{counts.total}</strong></span>
        <span className="text-gray-600">pending: {counts.pending}</span>
        <span className="text-green-700">auto: {counts.auto}</span>
        <span className="text-orange-700">de revizuit: {counts.revision}</span>
        <span className="text-emerald-700">aprobate: {counts.approved}</span>
      </div>

      <div className="mt-4 space-y-6">
        {rows.map((r) => {
          const d = draft[r.id] ?? { text: "", pins: [] };
          return (
            <div key={r.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-medium text-gray-900">{r.slug}</code>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS[r.status ?? ""] ?? "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                  <span className="text-xs text-gray-400">{r.inputKind ?? "—"} · {r.iteratii} iter</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={saving === r.id} onClick={() => setVerdict(r.id, "approved")} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-40">Aprobă</button>
                  <button type="button" disabled={saving === r.id} onClick={() => setVerdict(r.id, "rejected")} className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-40">Respinge</button>
                </div>
              </div>

              <p className="mt-2 text-sm text-gray-700">{r.condition}</p>

              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* DORIT */}
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Desen DORIT</div>
                  {r.desiredKind === "image" && r.desiredRef
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.desiredRef} alt="dorit" className="w-full rounded border border-gray-200" />
                    : <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">{r.desiredRef ?? "(fără referință)"}</div>}
                </div>
                {/* GENERAT + pini */}
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Randare GENERATĂ <span className="text-gray-400">(click = pin remarcă)</span></div>
                  {r.renderPng ? (
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.renderPng} alt="generat" onClick={(e) => addPin(r.id, e)} className="w-full cursor-crosshair rounded border border-gray-200" />
                      {[...(r.remarci?.pins ?? []), ...d.pins].map((p, i) => (
                        <span key={i} title={p.text} style={{ left: `${p.x}%`, top: `${p.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white ring-2 ring-white">{i + 1}</span>
                      ))}
                    </div>
                  ) : <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-400">negenerat — rulează coada</div>}
                </div>
                {/* PORȚI */}
                <div className="space-y-2">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Porți</div>
                  <GateList title="numerice" block={r.gates?.numeric} />
                  <GateList title="vizuală" block={r.gates?.visual} />
                  <GateList title="potrivire cu DORIT" block={r.gates?.desiredMatch} />
                </div>
              </div>

              {/* REMARCI */}
              <div className="mt-3">
                {r.remarci && (r.remarci.text || (r.remarci.pins?.length ?? 0) > 0) && (
                  <div className="mb-2 rounded bg-orange-50 p-2 text-xs text-orange-900">
                    <strong>Remarci salvate:</strong> {r.remarci.text}
                    {(r.remarci.pins ?? []).map((p, i) => <span key={i}> · <strong>{i + 1}</strong>@({p.x},{p.y}) {p.text}</span>)}
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={d.text} onChange={(e) => setDraft((p) => ({ ...p, [r.id]: { ...(p[r.id] ?? { text: "", pins: [] }), text: e.target.value } }))}
                    placeholder={`Remarcă pe desenul generat${d.pins.length ? ` (${d.pins.length} pini)` : ""}…`} className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
                  <button type="button" disabled={saving === r.id} onClick={() => submitRemarks(r.id)} className="rounded bg-orange-600 px-3 py-1 text-xs text-white hover:bg-orange-700 disabled:opacity-40">Trimite remarci → revizuire</button>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-gray-500">Niciun caz. Adaugă unul mai sus, apoi <code>npm run figura:coada</code>.</p>}
      </div>
    </div>
  );
}
