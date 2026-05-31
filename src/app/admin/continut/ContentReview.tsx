"use client";

import { useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { segmentMath } from "@/lib/content-math";

export interface ReviewItem {
  id: string;
  name: string;
  subtopic: string | null;
  module: string | null;
  kind: string;
  order_in_grade: number;
  confidence: string;
  note: string | null;
  definitie: string;
  formule_latex: string[];
  conditii: string;
  exemplu: string;
}

const KIND_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  definitie: { bg: "#dbeafe", text: "#1e40af", label: "definiție" },
  teorema: { bg: "#ede9fe", text: "#6d28d9", label: "teoremă" },
  formula: { bg: "#dcfce7", text: "#166534", label: "formulă" },
  procedeu: { bg: "#ffedd5", text: "#9a3412", label: "procedeu" },
  concept: { bg: "#f1f5f9", text: "#334155", label: "concept" },
  notiune: { bg: "#f1f5f9", text: "#334155", label: "noțiune" },
};
const kindStyle = (k: string) => KIND_STYLE[k] ?? { bg: "#f1f5f9", text: "#334155", label: k };

const APPROVED_KEY = "continut-approved-v1";

// ── KaTeX ────────────────────────────────────────────────────────────────────
function katexError(tex: string): string | null {
  try { katex.renderToString(tex, { throwOnError: true, strict: false }); return null; }
  catch (e) { return e instanceof Error ? e.message.replace(/^KaTeX parse error:\s*/, "") : "eroare KaTeX"; }
}

function Tex({ tex, display }: { tex: string; display?: boolean }) {
  let html: string | null = null;
  let err: string | null = null;
  try {
    html = katex.renderToString(tex, { displayMode: !!display, throwOnError: true, strict: false });
  } catch (e) {
    err = e instanceof Error ? e.message.replace(/^KaTeX parse error:\s*/, "") : "eroare KaTeX";
  }
  if (err != null) {
    return (
      <span className="inline-block bg-red-50 border border-red-300 rounded px-1.5 py-0.5 text-xs align-middle">
        <span className="text-red-600 font-medium">⚠ KaTeX:</span> <span className="text-red-700">{err}</span>{" "}
        <code className="text-red-900 bg-red-100 px-1 rounded">{tex}</code>
      </span>
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: html ?? "" }} />;
}

/** Proză cu math inline (LaTeX delimitat sau comenzi \cmd evidente) randat prin KaTeX; restul text. */
function RichText({ text }: { text: string }) {
  if (!text) return <span className="text-gray-400 italic">—</span>;
  const segs = segmentMath(text);
  return (
    <span className="whitespace-pre-wrap">
      {segs.map((s, i) => (s.type === "text" ? <span key={i}>{s.value}</span> : <Tex key={i} tex={s.value} display={s.display} />))}
    </span>
  );
}

// ── Componenta principală ────────────────────────────────────────────────────
export default function ContentReview({ items, grade }: { items: ReviewItem[]; grade: number }) {
  // Stare locală „aprobat" — persistată în localStorage (NU în DB). Init SSR-safe (fără effect).
  const [approved, setApproved] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { const raw = localStorage.getItem(APPROVED_KEY); return raw ? new Set(JSON.parse(raw) as string[]) : new Set(); }
    catch { return new Set(); }
  });
  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const persist = (s: Set<string>) => { try { localStorage.setItem(APPROVED_KEY, JSON.stringify([...s])); } catch { /* ignore */ } };
  const toggleApproved = (id: string) =>
    setApproved((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); persist(n); return n; });

  // Toate erorile KaTeX reale (din formule_latex[] ȘI din proză), calculate o singură dată.
  const errors = useMemo(() => {
    const list: { conceptId: string; conceptName: string; source: string; raw: string; message: string }[] = [];
    for (const it of items) {
      it.formule_latex.forEach((f) => { const e = katexError(f); if (e) list.push({ conceptId: it.id, conceptName: it.name, source: "formule_latex", raw: f, message: e }); });
      ([["definitie", it.definitie], ["conditii", it.conditii], ["exemplu", it.exemplu]] as const).forEach(([field, txt]) => {
        for (const seg of segmentMath(txt)) if (seg.type === "math") { const e = katexError(seg.value); if (e) list.push({ conceptId: it.id, conceptName: it.name, source: field, raw: seg.value, message: e }); }
      });
    }
    return list;
  }, [items]);
  const errorIds = useMemo(() => new Set(errors.map((e) => e.conceptId)), [errors]);
  const [showReport, setShowReport] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false;
      if (onlyLow && it.confidence !== "low") return false;
      if (onlyErrors && !errorIds.has(it.id)) return false;
      if (onlyUnreviewed && approved.has(it.id)) return false;
      return true;
    });
  }, [items, search, onlyLow, onlyErrors, onlyUnreviewed, errorIds, approved]);

  // Grupare pe subtemă, ordine după order_in_grade.
  const groups = useMemo(() => {
    const map = new Map<string, ReviewItem[]>();
    for (const it of [...filtered].sort((a, b) => a.order_in_grade - b.order_in_grade || a.name.localeCompare(b.name, "ro"))) {
      const key = it.subtopic ?? "(fără subtemă)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return [...map.entries()];
  }, [filtered]);

  const selected = items.find((it) => it.id === selectedId) ?? null;
  const lowCount = items.filter((it) => it.confidence === "low").length;
  const approvedInGrade = items.filter((it) => approved.has(it.id)).length;

  return (
    <div>
      {/* Bara de control + statistici */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută concept…"
          className="text-sm border border-gray-300 rounded px-2 py-1.5 w-48"
        />
        <label className="text-xs flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          <span className="text-amber-700">low-confidence ({lowCount})</span>
        </label>
        <label className="text-xs flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
          <span className="text-red-700">erori KaTeX ({errorIds.size})</span>
        </label>
        <label className="text-xs flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={onlyUnreviewed} onChange={(e) => setOnlyUnreviewed(e.target.checked)} />
          nerevizuite
        </label>
        <button
          onClick={() => setShowReport((v) => !v)}
          className={`text-xs px-2.5 py-1.5 border rounded ${showReport ? "bg-red-600 text-white border-red-600" : "bg-white text-red-700 border-red-300 hover:bg-red-50"}`}
        >
          {showReport ? "← Înapoi la revizuire" : `Raport erori KaTeX (${errors.length})`}
        </button>
        <span className="text-xs text-gray-500 ml-auto">
          Revizuite (local): <span className="font-semibold text-gray-800">{approvedInGrade}/{items.length}</span> în clasa {grade}
        </span>
      </div>

      {showReport ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 h-[76vh] overflow-y-auto">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Erori KaTeX reale — clasa {grade} ({errors.length})</h2>
          <p className="text-xs text-gray-500 mb-3">
            Formule din formule_latex[] ȘI din proză care nu se randează (comenzi inventate/typo). Cele de reparat.
            Lista completă din DB: <code className="bg-gray-100 px-1 rounded">select * from katex_error_report order by grade_level, concept_name;</code>
          </p>
          {errors.length === 0 ? (
            <div className="text-center text-green-700 py-12 text-sm">✓ Nicio eroare KaTeX în clasa {grade}.</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                  <th className="px-2 py-2">Concept</th>
                  <th className="px-2 py-2">Sursă</th>
                  <th className="px-2 py-2">Formula brută</th>
                  <th className="px-2 py-2">Eroare</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={i} className="border-b border-gray-100 align-top hover:bg-red-50">
                    <td className="px-2 py-1.5">
                      <button onClick={() => { setShowReport(false); setSelectedId(e.conceptId); }} className="text-blue-700 hover:underline text-left">{e.conceptName}</button>
                    </td>
                    <td className="px-2 py-1.5 text-gray-500">{e.source}</td>
                    <td className="px-2 py-1.5"><code className="bg-red-50 text-red-900 px-1 rounded break-all">{e.raw}</code></td>
                    <td className="px-2 py-1.5 text-red-700">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <div className="flex gap-3">
        {/* Listă navigare */}
        <div className="w-96 shrink-0 h-[76vh] overflow-y-auto bg-white border border-gray-200 rounded-lg">
          {groups.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm">Niciun concept cu filtrele curente.</div>
          ) : (
            groups.map(([sub, its]) => (
              <div key={sub}>
                <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600">
                  {sub} <span className="text-gray-400">({its.length})</span>
                </div>
                {its.map((it) => {
                  const ks = kindStyle(it.kind);
                  const hasErr = errorIds.has(it.id);
                  const isApproved = approved.has(it.id);
                  return (
                    <button
                      key={it.id}
                      onClick={() => setSelectedId(it.id)}
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-blue-50 flex items-center gap-2 ${
                        selectedId === it.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <span className={isApproved ? "text-green-600" : "text-gray-300"}>{isApproved ? "✓" : "○"}</span>
                      <span className="flex-1 text-xs text-gray-800 leading-snug">{it.name}</span>
                      {hasErr && <span title="formulă KaTeX invalidă" className="text-[10px] bg-red-100 text-red-700 rounded px-1">⚠</span>}
                      {it.confidence === "low" && <span title="confidence low" className="text-[10px] bg-amber-100 text-amber-700 rounded px-1">low</span>}
                      <span className="text-[9px] rounded px-1 py-0.5" style={{ backgroundColor: ks.bg, color: ks.text }}>{ks.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Detaliu cu KaTeX */}
        <div className="flex-1 h-[76vh] overflow-y-auto bg-white border border-gray-200 rounded-lg p-5">
          {!selected ? (
            <div className="text-center text-gray-400 py-20">Selectează un concept din listă.</div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selected.name}</h2>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="rounded px-2 py-0.5" style={{ backgroundColor: kindStyle(selected.kind).bg, color: kindStyle(selected.kind).text }}>{kindStyle(selected.kind).label}</span>
                    <span className={`rounded px-2 py-0.5 ${selected.confidence === "low" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>conf: {selected.confidence}</span>
                    {selected.note && <span className="rounded px-2 py-0.5 bg-red-100 text-red-700">{selected.note}</span>}
                    <span className="text-gray-400">{selected.module ?? ""}{selected.subtopic ? ` · ${selected.subtopic}` : ""} · p.{selected.order_in_grade}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleApproved(selected.id)}
                  className={`shrink-0 text-sm px-3 py-1.5 rounded font-medium border ${
                    approved.has(selected.id)
                      ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {approved.has(selected.id) ? "✓ Revizuit" : "Marchează revizuit"}
                </button>
              </div>

              <Section title="Definiție">
                <div className="text-sm text-gray-800 leading-relaxed"><RichText text={selected.definitie} /></div>
              </Section>

              <Section title={`Formule (${selected.formule_latex.length})`}>
                {selected.formule_latex.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">—</div>
                ) : (
                  <div className="space-y-2">
                    {selected.formule_latex.map((f, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-100 rounded px-3 py-2 overflow-x-auto">
                        <Tex tex={f} display />
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {selected.conditii && (
                <Section title="Condiții">
                  <div className="text-sm text-gray-800 leading-relaxed"><RichText text={selected.conditii} /></div>
                </Section>
              )}

              {selected.exemplu && (
                <Section title="Exemplu">
                  <div className="text-sm text-gray-800 leading-relaxed"><RichText text={selected.exemplu} /></div>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{title}</div>
      {children}
    </div>
  );
}
