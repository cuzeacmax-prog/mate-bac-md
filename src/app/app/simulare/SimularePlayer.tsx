"use client";

/**
 * SimularePlayer — ETAPA 69 P3: intro cu condițiile ONESTE → player
 * exercițiu-cu-exercițiu cu navigare liberă + marcare „revin" → timer vizibil
 * (deadline-ul real e pe server) → submit final → rezultat pe module cu
 * link spre lecția conceptului. Zero LLM la randare.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {Flag } from "lucide-react";
import { MathText } from "@/components/MathText";
import { StatementText } from "@/components/StatementText";
import { LayeredFigure } from "@/components/lesson/LayeredFigure";
import { buttonTap } from "@/lib/motion/motion";
import type { ExamAttempt, ExamResult } from "@/lib/simulare/exam";
import { BreathingOrb } from "@/components/motion/BreathingOrb";

type Phase = "intro" | "running" | "submitting" | "result" | "expired";

export function SimularePlayer({ audit }: {
  audit: { perModule: Array<{ module: string; available: number; quota: number; pick: number }>; gaps: string[] };
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const plannedCount = audit.perModule.reduce((s, m) => s + m.pick, 0);
  const coveredModules = audit.perModule.filter((m) => m.pick > 0).map((m) => m.module);

  const submittedRef = useRef(false);

  const deadline = useMemo(() => {
    if (!attempt) return 0;
    return new Date(attempt.started_at + (attempt.started_at.endsWith("Z") ? "" : "Z")).getTime() + attempt.duration_minutes * 60_000;
  }, [attempt]);
  const remaining = Math.max(0, deadline - now);
  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);

  const start = useCallback(async () => {
    setError(null);
    try {
      const resp = await fetch("/api/simulare/start", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      setAttempt(data);
      setPhase("running");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la pornire");
    }
  }, []);

  const submit = useCallback(async () => {
    if (!attempt) return;
    setPhase("submitting");
    try {
      const resp = await fetch("/api/simulare/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id, answers }),
      });
      const data = await resp.json();
      if (resp.status === 410) { setPhase("expired"); return; }
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la trimitere");
      setPhase("running");
    }
  }, [attempt, answers]);

  // ETAPA 83 G: FOCUS MODE pe durata simulării (scenă, fără distrageri laterale,
  // ca lecția-scenă din 77) — reutilizează CSS-ul body[data-focus-lesson].
  useEffect(() => {
    if (phase !== "running") return;
    document.body.dataset.focusLesson = "1";
    return () => { delete document.body.dataset.focusLesson; };
  }, [phase]);

  // ceasul + auto-submit la expirare trăiesc în ACELAȘI timer (sistem extern);
  // serverul oricum respinge submit-urile după deadline + grație
  useEffect(() => {
    if (phase !== "running" || !attempt) return;
    const t = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= deadline && !submittedRef.current) {
        submittedRef.current = true;
        void submit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, attempt, deadline, submit]);

  if (phase === "intro") {
    return (
      <div className="relative max-w-2xl mx-auto px-6 py-10 space-y-5">
        <h1 className="fluid-h1 font-bold">Simulare BAC — variantă parțială</h1>
        <div className="glass-2 rounded-3xl p-5 space-y-3 text-sm leading-relaxed">
          <p><strong>{plannedCount} exerciții</strong> din culegerea oficială, cu răspuns verificabil · <strong>90 de minute</strong>, cronometru pe server.</p>
          <p>Acoperă onest: {coveredModules.join(", ")}.</p>
          {audit.gaps.length > 0 && (
            <p className="text-secondary-foreground bg-secondary rounded-lg px-3 py-2">
              ⚠ Simulare PARȚIALĂ: {audit.gaps.join(", ")} {audit.gaps.length === 1 ? "nu are" : "nu au"} încă
              exerciții cu răspuns verificabil în bibliotecă — nu inventăm subiecte.
            </p>
          )}
          <p className="text-muted-foreground">Navighezi liber între exerciții, poți marca «revin». Nota e estimată DOAR pe ce s-a testat, ca interval.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <motion.button whileTap={buttonTap} onClick={start} className="w-full rounded-2xl bg-[var(--bg-electric)] text-primary-foreground py-4 font-semibold text-base">
          Începe simularea →
        </motion.button>
      </div>
    );
  }

  if (phase === "submitting" || !attempt) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <BreathingOrb size="md" />
          <p className="text-sm text-muted-foreground">Se evaluează răspunsurile…</p>
        </div>
      </div>
    );
  }

  if (phase === "expired") {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-4">
        <p className="text-4xl">⏰</p>
        <h1 className="text-xl font-semibold">Timpul a expirat</h1>
        <p className="text-muted-foreground text-sm">Simularea s-a închis pe server fără punctaj. Poți începe alta oricând.</p>
        <button onClick={() => { setPhase("intro"); setAttempt(null); setAnswers({}); setIdx(0); }} className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium">
          Înapoi la intro
        </button>
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-5">
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{result.correct} / {result.total} corecte</h1>
          {result.grade && (
            <p className="text-lg">
              Notă estimată: <strong>{result.grade.low.toFixed(1)} – {result.grade.high.toFixed(1)}</strong>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            simulare parțială — acoperă {result.grade?.coveredModules.join(", ")}
            {result.unevaluated > 0 && ` · ${result.unevaluated} răspunsuri fără verdict sigur (numărate ca nepunctate)`}
          </p>
        </motion.div>

        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold mb-3">Punctaj pe module</h2>
          <div className="space-y-2">
            {result.perModule.map((m) => (
              <div key={m.module} className="flex items-center justify-between text-sm">
                <span>{m.module}</span>
                <span className="font-mono">{m.correct}/{m.total}</span>
              </div>
            ))}
          </div>
        </div>

        {result.wrong.length > 0 && (
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-semibold">De lucrat (cu lecția conceptului)</h2>
            {result.wrong.map((w) => (
              <div key={w.exercise_id} className="rounded-xl bg-muted/40 p-3 space-y-2">
                <p className="text-sm leading-relaxed line-clamp-3"><MathText text={w.statement} /></p>
                {w.concept_slug && (
                  <Link href={`/app/chat?concept=${encodeURIComponent(w.concept_slug)}`} className="inline-block text-xs font-medium text-primary underline underline-offset-2">
                    Deschide lecția →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── running — SCENĂ ALBASTRĂ (ETAPA 83 G) ───────────────────────────────────
  const item = attempt.items[idx];
  const answered = Object.keys(answers).filter((k) => answers[k]?.trim()).length;
  const isLast = idx === attempt.items.length - 1;
  const lowTime = remaining < 5 * 60_000;
  return (
    // scenă albastră dedicată: fundal deep→night, focus, fără distrageri laterale
    <div
      className="relative min-h-full flex flex-col"
      style={{ background: "linear-gradient(180deg, var(--bg-deep), var(--bg-night) 70%, var(--bg-black))" }}
    >
      {/* bară de sus: progres + CRONOMETRU serios (69) */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--text-on-deep)]">
            Exercițiul {idx + 1} din {attempt.items.length} · {item.module}
          </p>
          <p className={`font-mono font-bold tabular-nums text-lg ${lowTime ? "text-danger-foreground" : "text-[var(--bg-electric)]"}`}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </p>
        </div>
        {/* navigare liberă (puncte de exercițiu) */}
        <div className="max-w-2xl mx-auto mt-2 flex flex-wrap gap-1.5">
          {attempt.items.map((it, i) => (
            <button
              key={it.exercise_id}
              onClick={() => setIdx(i)}
              className={`w-7 h-7 rounded-lg border text-[11px] font-semibold transition-colors ${
                i === idx ? "border-[var(--bg-electric)] bg-[var(--bg-electric)] text-primary-foreground"
                : flagged.has(it.exercise_id) ? "border-warning-foreground/40 bg-warning-bg text-warning-foreground"
                : answers[it.exercise_id]?.trim() ? "border-success/40 bg-success-bg text-success-foreground"
                : "border-white/15 bg-white/5 text-[var(--text-on-deep)]/70"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* PROBLEMA — bulă care intră GLISÂND lateral, una câte una */}
      <div className="flex-1 px-4 pb-32 pt-2">
        <motion.div
          key={item.exercise_id}
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="max-w-2xl mx-auto rounded-3xl bg-card/90 border border-white/10 shadow-2xl p-6 space-y-4"
        >
          <p className="leading-relaxed text-[var(--text-on-deep)]"><StatementText text={item.statement} /></p>
          {item.has_figure && <LayeredFigure exerciseId={item.exercise_id} />}
          <input
            value={answers[item.exercise_id] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [item.exercise_id]: e.target.value }))}
            placeholder="Răspunsul tău final"
            className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm bg-bg-night/60 text-[var(--text-on-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--bg-electric)]/50"
          />
          <button
            onClick={() => setFlagged((prev) => { const n = new Set(prev); if (n.has(item.exercise_id)) n.delete(item.exercise_id); else n.add(item.exercise_id); return n; })}
            className={`flex items-center gap-1.5 text-xs font-medium ${flagged.has(item.exercise_id) ? "text-warning-foreground" : "text-[var(--text-on-deep)]/60"}`}
          >
            <Flag className="h-3.5 w-3.5" />
            {flagged.has(item.exercise_id) ? "Marcat — revin" : "Marchează «revin»"}
          </button>
        </motion.div>
      </div>

      {/* BUTON MARE FIX JOS: Următoarea → / Predă (senzație de examen care curge) */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-bg-night/90 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="text-xs text-[var(--text-on-deep)]/60 shrink-0">{answered}/{attempt.items.length}</span>
          {isLast ? (
            <motion.button
              whileTap={buttonTap}
              onClick={() => { if (confirm(`Trimiți simularea? ${answered}/${attempt.items.length} răspunse.`)) void submit(); }}
              className="flex-1 rounded-2xl bg-success text-primary-foreground py-3.5 font-semibold text-base"
            >
              Predă simularea
            </motion.button>
          ) : (
            <motion.button
              whileTap={buttonTap}
              onClick={() => setIdx((i) => Math.min(attempt.items.length - 1, i + 1))}
              className="flex-1 rounded-2xl bg-[var(--bg-electric)] text-primary-foreground py-3.5 font-semibold text-base"
            >
              Următoarea →
            </motion.button>
          )}
        </div>
        {error && <p className="max-w-2xl mx-auto text-sm text-destructive mt-2">{error}</p>}
      </div>
    </div>
  );
}
