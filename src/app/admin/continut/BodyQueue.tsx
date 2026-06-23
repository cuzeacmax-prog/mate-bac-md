"use client";

import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { segmentMath } from "@/lib/content-math";

interface QueueItem {
  id: string;
  module: string | null;
  exercise_number: string | null;
  statement: string | null;
  human_body_status: string | null;
  errors: { raw: string; message: string; display: boolean }[];
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
      <span className="inline-block bg-red-50 border border-red-300 rounded px-1.5 py-0.5 text-xs align-middle my-0.5">
        <span className="text-red-600 font-medium">⚠ KaTeX:</span> <span className="text-red-700">{err}</span>{" "}
        <code className="text-red-900 bg-red-100 px-1 rounded break-all">{tex}</code>
      </span>
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: html ?? "" }} />;
}

/** Previzualizare LIVE: exact segmentarea pe care o vede elevul (segmentMath + KaTeX). */
function Preview({ text }: { text: string }) {
  const segs = useMemo(() => segmentMath(text), [text]);
  if (!text.trim()) return <span className="text-gray-400 italic">—</span>;
  return (
    <div className="whitespace-pre-wrap leading-relaxed text-gray-800">
      {segs.map((s, i) => (s.type === "text" ? <span key={i}>{s.value}</span> : <Tex key={i} tex={s.value} display={s.display} />))}
    </div>
  );
}

export default function BodyQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolvedCount, setResolvedCount] = useState(0);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/admin/continut/body-queue");
      if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
      const j = await r.json();
      setItems(j.items as QueueItem[]);
      setIdx(0);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }
  // mount-fetch (setState după await, nu sincron) — pattern intenționat de admin
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  const current = items[idx] ?? null;
  // resetează draftul editabil când se schimbă item-ul (sync intenționat, admin)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDraft(current?.statement ?? ""); }, [current?.id]);

  const liveErrors = useMemo(() => {
    // re-detectare client (oglindă a serverului) ca să dispară badge-urile pe măsură ce editezi
    const out: { raw: string; message: string }[] = [];
    for (const seg of segmentMath(draft)) {
      if (seg.type !== "math") continue;
      try { katex.renderToString(seg.value, { displayMode: seg.display, throwOnError: true, strict: false }); }
      catch (e) { out.push({ raw: seg.value, message: e instanceof Error ? e.message.replace(/^KaTeX parse error:\s*/, "") : "eroare" }); }
    }
    return out;
  }, [draft]);

  async function saveAndNext() {
    if (!current) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/continut/body-queue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, statement: draft }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
      const j = await r.json();
      if (j.resolved) setResolvedCount((c) => c + 1);
      // scoate itemul rezolvat din coadă local; altfel actualizează-i erorile
      setItems((prev) => {
        const next = j.resolved ? prev.filter((_, i) => i !== idx) : prev.map((it, i) => (i === idx ? { ...it, statement: draft, errors: j.errors } : it));
        return next;
      });
      setIdx((i) => Math.min(i, (j.resolved ? items.length - 2 : items.length - 1)));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="text-center text-gray-400 py-20">Se încarcă coada…</div>;
  if (err) return <div className="text-red-600 py-6">Eroare: {err} <button onClick={() => void load()} className="underline ml-2">reîncarcă</button></div>;
  if (items.length === 0)
    return (
      <div className="text-center text-green-700 py-20 border border-dashed border-green-300 rounded-lg">
        ✓ Coada e goală — niciun body cu eroare KaTeX. {resolvedCount > 0 && <span className="text-gray-500">({resolvedCount} rezolvate în sesiune)</span>}
      </div>
    );

  return (
    <div className="flex gap-3">
      {/* listă */}
      <div className="w-72 shrink-0 h-[76vh] overflow-y-auto bg-white border border-gray-200 rounded-lg">
        <div className="sticky top-0 bg-gray-50 border-b px-3 py-2 text-xs font-medium text-gray-600">
          Coadă body-uri ({items.length}) · {resolvedCount} rezolvate
        </div>
        {items.map((it, i) => (
          <button key={it.id} onClick={() => setIdx(i)}
            className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-blue-50 ${i === idx ? "bg-blue-50" : ""}`}>
            <div className="text-xs text-gray-800">{it.module ?? "—"} #{it.exercise_number ?? "?"}</div>
            <div className="text-[10px] text-red-600">{it.errors.length} eroare(i): {it.errors[0]?.message.slice(0, 40)}</div>
          </button>
        ))}
      </div>

      {/* editor + preview */}
      <div className="flex-1 h-[76vh] overflow-y-auto bg-white border border-gray-200 rounded-lg p-5">
        {!current ? (
          <div className="text-center text-gray-400 py-20">Selectează un body.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{current.module ?? "—"} #{current.exercise_number ?? "?"} <code className="text-[10px] text-gray-400">{current.id.slice(0, 8)}</code></h2>
              <button onClick={() => void saveAndNext()} disabled={saving}
                className="text-sm px-3 py-1.5 rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Se salvează…" : "Salvează & Următorul →"}
              </button>
            </div>

            {/* eroarea EVIDENȚIATĂ (din server, la încărcare) */}
            <div>
              <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Eroare(i) KaTeX evidențiată</div>
              {(liveErrors.length ? liveErrors : current.errors).map((e, i) => (
                <div key={i} className="text-xs bg-red-50 border border-red-200 rounded px-2 py-1 mb-1">
                  <span className="text-red-700">{e.message}</span> — <code className="bg-red-100 text-red-900 px-1 rounded break-all">{e.raw.slice(0, 120)}</code>
                </div>
              ))}
              {liveErrors.length === 0 && <div className="text-xs text-green-700">✓ nicio eroare în textul curent — „Salvează &amp; Următorul&rdquo; îl marchează rezolvat.</div>}
            </div>

            {/* editare inline */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Enunț (editezi tu — modelul nu rescrie)</div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                className="w-full h-44 text-sm font-mono border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-300" spellCheck={false} />
            </div>

            {/* preview live */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Previzualizare (ce vede elevul)</div>
              <div className="border border-gray-200 rounded p-3 bg-gray-50 text-sm">
                <Preview text={draft} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
