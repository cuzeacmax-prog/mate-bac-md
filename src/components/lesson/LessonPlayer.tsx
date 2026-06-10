"use client";

/**
 * LessonPlayer — ETAPA 67 FAZA C: player-ul de lecție tip quiz.
 *
 * UN bloc vizibil odată, buton „Continuă", bară de progres sus — estetica
 * diagnosticului din onboarding (Framer Motion: slide+fade, spring moderat).
 * Quiz: A-D → verificare pe SERVER (/api/lesson/quiz, corecta nu există pe
 * client) → feedback animat → mastery se mișcă (ETAPA 63) → micro-celebrare
 * la final + streak-ul (ETAPA 14). Tot textul matematic prin MathText.
 * Cale NOUĂ peste /api/lesson/start; eșecul streamului → onFallback (chat).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { MathText } from "@/components/MathText";
import { LessonTable } from "@/components/lesson/LessonTable";
import { LayeredFigure } from "@/components/lesson/LayeredFigure";
import { AnimatedBackdrop } from "@/components/motion/AnimatedBackdrop";
import { SPRING, buttonTap, progressFill, celebrate } from "@/lib/motion/motion";
import type { LessonBlockClient } from "@/lib/lesson/blocks";

interface Props {
  conceptSlug: string;
  streak: number;
  /** streamul structurat a eșuat → cade pe chat-ul markdown existent */
  onFallback: () => void;
  /** elevul vrea chatul liber (escape hatch) */
  onExitToChat: () => void;
}

type QuizState = { selected: string; correct: boolean; corecta: string } | null;

const LETTERS = ["a", "b", "c", "d"] as const;

export function LessonPlayer({ conceptSlug, streak, onFallback, onExitToChat }: Props) {
  const [blocks, setBlocks] = useState<LessonBlockClient[]>([]);
  const [streamDone, setStreamDone] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [quizStates, setQuizStates] = useState<Record<string, QuizState>>({});
  const [pendingQuiz, setPendingQuiz] = useState(false);
  const [finished, setFinished] = useState(false);
  const startedRef = useRef(false);

  // ── streamul lecției ──────────────────────────────────────────────────────
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/lesson/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ concept: conceptSlug }),
        });
        if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            let ev: { block?: LessonBlockClient; done?: boolean; fallback?: boolean; messageId?: string; error?: string };
            try { ev = JSON.parse(line.slice(6)); } catch { continue; }
            if (cancelled) return;
            if (ev.fallback || ev.error) throw new Error(ev.error ?? "fallback");
            if (ev.block) setBlocks((prev) => [...prev, ev.block!]);
            if (ev.done) {
              setMessageId(ev.messageId ?? null);
              setStreamDone(true);
            }
          }
        }
        if (!cancelled) setStreamDone(true);
      } catch (err) {
        console.error("[LessonPlayer] fallback:", err instanceof Error ? err.message : err);
        if (!cancelled) onFallback();
      }
    })();
    return () => { cancelled = true; };
  }, [conceptSlug, onFallback]);

  const current = blocks[idx];
  const total = blocks.length;
  const progress = total > 0 ? Math.min((idx + (finished ? 1 : 0)) / total, 1) : 0;
  const currentQuizState =
    current?.tip === "quiz" ? quizStates[(current as { quiz_id: string }).quiz_id] ?? null : null;
  const canAdvance =
    current !== undefined &&
    (current.tip !== "quiz" || currentQuizState !== null);

  const advance = useCallback(() => {
    if (idx + 1 < blocks.length) setIdx(idx + 1);
    else if (streamDone) setFinished(true);
    // altfel: așteptăm următorul bloc din stream (butonul arată spinner)
  }, [idx, blocks.length, streamDone]);

  const answerQuiz = useCallback(
    async (quizId: string, letter: string) => {
      if (pendingQuiz || !messageId) return;
      setPendingQuiz(true);
      try {
        const resp = await fetch("/api/lesson/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, quizId, answer: letter }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
        setQuizStates((prev) => ({
          ...prev,
          [quizId]: { selected: letter, correct: data.correct, corecta: data.corecta },
        }));
        setTimeout(advance, 1400);
      } catch (err) {
        console.error("[LessonPlayer] quiz failed:", err instanceof Error ? err.message : err);
      } finally {
        setPendingQuiz(false);
      }
    },
    [messageId, pendingQuiz, advance]
  );

  // ── loading inițial ───────────────────────────────────────────────────────
  if (blocks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Pregătesc lecția…</p>
      </div>
    );
  }

  // ── celebrarea finală ─────────────────────────────────────────────────────
  if (finished) {
    const quizResults = Object.values(quizStates).filter(Boolean) as NonNullable<QuizState>[];
    const correctCount = quizResults.filter((q) => q.correct).length;
    return (
      <div className="relative flex-1 flex items-center justify-center px-6">
        <AnimatedBackdrop intensity="bold" />
        <motion.div
          className="text-center space-y-5 max-w-sm"
          variants={celebrate}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="text-6xl"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.6, times: [0, 0.7, 1] }}
          >
            🎉
          </motion.div>
          <h2 className="text-xl font-bold">Lecție terminată!</h2>
          {quizResults.length > 0 && (
            <p className="text-muted-foreground">
              {correctCount} din {quizResults.length} întrebări corecte — progresul tău s-a actualizat.
            </p>
          )}
          <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-center gap-3">
            <span className="text-3xl">🔥</span>
            <p className="font-bold">Streak: {streak} {streak === 1 ? "zi" : "zile"}</p>
          </div>
          <motion.button
            whileTap={buttonTap}
            onClick={onExitToChat}
            className="w-full rounded-xl bg-primary text-primary-foreground px-5 py-3 font-medium"
          >
            Pune o întrebare în chat →
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── player-ul: un bloc odată ──────────────────────────────────────────────
  return (
    <div className="relative flex-1 flex flex-col min-w-0">
      {current.tip === "intro" && <AnimatedBackdrop />}
      {/* bara de progres (estetica diagnosticului) */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Lecție · pasul {idx + 1}{streamDone ? ` din ${total}` : ""}</span>
          <button onClick={onExitToChat} className="underline underline-offset-2">
            chat liber
          </button>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress * 100}%` }}
            transition={progressFill}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col justify-center max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={SPRING.standard}
          >
            <BlockCard
              block={current}
              quizState={currentQuizState}
              pendingQuiz={pendingQuiz}
              onAnswer={answerQuiz}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-4 pb-5 max-w-lg mx-auto w-full shrink-0">
        {current.tip !== "quiz" && (
          <button
            onClick={advance}
            disabled={!canAdvance && streamDone}
            className="w-full h-13 rounded-2xl bg-primary text-primary-foreground py-3.5 font-semibold disabled:opacity-50"
          >
            {idx + 1 < blocks.length || streamDone ? "Continuă →" : <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── randarea unui bloc ────────────────────────────────────────────────────────
function BlockCard({
  block,
  quizState,
  pendingQuiz,
  onAnswer,
}: {
  block: LessonBlockClient;
  quizState: QuizState;
  pendingQuiz: boolean;
  onAnswer: (quizId: string, letter: string) => void;
}) {
  switch (block.tip) {
    case "intro":
      return (
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 space-y-3">
          <h1 className="text-xl font-bold"><MathText text={block.titlu} /></h1>
          <p className="text-base leading-relaxed"><MathText text={block.ideea_mare} /></p>
        </div>
      );
    case "step":
      return (
        <div className="rounded-2xl bg-card border p-6 space-y-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">
            <MathText text={block.titlu_scurt} />
          </p>
          <p className="leading-relaxed"><MathText text={block.corp} /></p>
          {block.formula && (
            <div className="rounded-xl bg-muted/60 px-4 py-3 text-center overflow-x-auto">
              <MathText text={`$$${block.formula}$$`} />
            </div>
          )}
        </div>
      );
    case "formula":
      return (
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-6 space-y-3 text-center">
          <div className="text-lg overflow-x-auto"><MathText text={`$$${block.latex}$$`} /></div>
          <p className="text-sm text-muted-foreground"><MathText text={block.explicatie} /></p>
        </div>
      );
    case "example":
      return (
        <div className="rounded-2xl bg-card border p-6 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Exemplu</p>
          <p className="font-medium leading-relaxed"><MathText text={block.enunt} /></p>
          <ol className="space-y-2.5">
            {block.pasi.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="space-y-1 min-w-0">
                  <p className="text-sm leading-relaxed"><MathText text={p.text} /></p>
                  {p.formula && (
                    <div className="text-sm overflow-x-auto"><MathText text={`$$${p.formula}$$`} /></div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      );
    case "quiz": {
      const quizId = (block as { quiz_id: string }).quiz_id;
      return (
        <div className="space-y-4">
          <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5">
            <p className="text-xs font-semibold text-primary mb-2 uppercase">Verifică-te</p>
            <p className="font-medium leading-relaxed"><MathText text={block.intrebare} /></p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {LETTERS.map((letter) => {
              const text = block.optiuni[letter];
              let variant = "border-border bg-card hover:border-primary/60 hover:bg-primary/5";
              if (quizState) {
                if (letter === quizState.corecta) variant = "border-success/50 bg-success-bg text-success-foreground";
                else if (letter === quizState.selected) variant = "border-danger-foreground/30 bg-danger-bg text-danger-foreground";
                else variant = "border-border bg-card opacity-60";
              }
              return (
                <motion.button
                  key={letter}
                  onClick={() => !quizState && onAnswer(quizId, letter)}
                  disabled={!!quizState || pendingQuiz}
                  className={`w-full rounded-2xl border-2 p-4 text-left flex items-center gap-3 transition-all ${variant} disabled:cursor-default`}
                  whileTap={!quizState ? buttonTap : {}}
                >
                  <span className="rounded-full bg-muted/80 px-2.5 py-1 text-sm font-bold uppercase shrink-0">
                    {letter}
                  </span>
                  <span className="text-sm font-medium"><MathText text={text} /></span>
                </motion.button>
              );
            })}
          </div>
          <AnimatePresence>
            {quizState && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-xl px-4 py-3 text-center text-sm font-medium ${
                  quizState.correct ? "bg-success-bg text-success-foreground" : "bg-danger-bg text-danger-foreground"
                }`}
              >
                {quizState.correct
                  ? "✓ Corect! Mergem mai departe…"
                  : `Răspunsul corect: ${quizState.corecta.toUpperCase()}. Continuăm…`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }
    case "table":
      return (
        <div className="rounded-2xl bg-card border p-5">
          <LessonTable titlu={block.titlu} coloane={block.coloane} randuri={block.randuri} />
        </div>
      );
    case "figure":
      return (
        <div className="rounded-2xl bg-card border p-5 space-y-3">
          {block.kind === "theory" && block.theory_slug ? (
            <TheoryFigure slug={block.theory_slug} />
          ) : block.exercise_id ? (
            <LayeredFigure exerciseId={block.exercise_id} layerMax={block.layer_max} />
          ) : null}
          {block.legenda && (
            <p className="text-sm text-muted-foreground text-center"><MathText text={block.legenda} /></p>
          )}
        </div>
      );
    case "plot":
      return (
        <div className="rounded-2xl bg-card border p-5 space-y-3">
          <div
            className="figura-bac mx-auto max-w-full [&_svg]:max-w-full [&_svg]:h-auto"
            // SVG-ul e randat EXCLUSIV pe server (renderPlotSVG, expr validat) — trusted
            dangerouslySetInnerHTML={{ __html: (block as { svg?: string }).svg ?? "" }}
          />
          <p className="text-sm text-muted-foreground text-center">
            <MathText text={block.legenda ?? `$y = ${block.expr}$`} />
          </p>
        </div>
      );
    case "recap":
      return (
        <div className="rounded-2xl bg-success-bg border border-success/30 p-6 space-y-3">
          <p className="text-xs font-semibold text-success-foreground uppercase">Ce ai învățat</p>
          <ul className="space-y-2">
            {block.puncte.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="text-success shrink-0">✓</span>
                <MathText text={p} />
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return null;
  }
}

/** figura canonică de teorie — SVG determinist din /api/figura-teorie */
function TheoryFigure({ slug }: { slug: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/figura-teorie/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (cancelled) return;
        if (text && text.includes("<svg")) setSvg(text);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [slug]);
  if (failed) return <p className="text-xs text-muted-foreground text-center">(figura nu e disponibilă)</p>;
  if (!svg) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div
      className="figura-bac mx-auto max-w-full [&_svg]:max-w-full [&_svg]:h-auto"
      // SVG-ul vine exclusiv din registrul theory-figures (cod determinist) — trusted
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
