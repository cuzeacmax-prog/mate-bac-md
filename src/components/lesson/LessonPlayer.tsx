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
import { playSound, preloadSounds, soundsEnabled, setSoundsEnabled } from "@/lib/sound/sounds";
import type { LessonBlockClient } from "@/lib/lesson/blocks";

interface Props {
  conceptSlug: string;
  streak: number;
  /** streamul structurat a eșuat → cade pe chat-ul markdown existent */
  onFallback: () => void;
  /** elevul vrea chatul liber (escape hatch) */
  onExitToChat: () => void;
}

/** ETAPA 70 FAZA C: starea mașinii de greșeli per quiz */
type QuizState = {
  status: "retry" | "solved" | "failed";
  wrongOptions: string[];
  selected?: string;
  correct?: boolean;
  corecta?: string;
  indiciu?: string;
  microRecap?: LessonBlockClient | null;
  rezolvare?: string[] | null;
  similar?: { exercise_id: string; statement: string; has_figure: boolean } | null;
  redemption?: { correct: boolean | null; motiv?: string } | null;
} | null;

const LETTERS = ["a", "b", "c", "d"] as const;

export function LessonPlayer({ conceptSlug, streak, onFallback, onExitToChat }: Props) {
  const [blocks, setBlocks] = useState<LessonBlockClient[]>([]);
  const [streamDone, setStreamDone] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [quizStates, setQuizStates] = useState<Record<string, QuizState>>({});
  const [pendingQuiz, setPendingQuiz] = useState(false);
  const [finished, setFinished] = useState(false);
  // ETAPA 70 E: chatul îngrădit în lecție (întrebare → max 3 blocuri)
  const [askInput, setAskInput] = useState("");
  const [askPending, setAskPending] = useState(false);
  const [askAnswer, setAskAnswer] = useState<LessonBlockClient[] | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  // ETAPA 70 F: toggle-ul de sunete (persistat în localStorage, default ON);
  // inițializare lazy — pe server e true, clientul citește localStorage
  const [soundOn, setSoundOn] = useState(() =>
    typeof window === "undefined" ? true : soundsEnabled()
  );
  useEffect(() => {
    preloadSounds();
  }, []);
  // ETAPA 70 G3: ritualul de final — mastery la început vs la final (delta reală)
  const initialMasteryRef = useRef<number | null>(null);
  const [ritual, setRitual] = useState<{
    masteryBefore: number;
    masteryAfter: number;
    streak: number;
    next: { slug: string; name: string } | null;
  } | null>(null);
  useEffect(() => {
    fetch(`/api/lesson/ritual?concept=${encodeURIComponent(conceptSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) initialMasteryRef.current = d.mastery; })
      .catch(() => { /* delta devine necunoscută, nu blocăm lecția */ });
  }, [conceptSlug]);
  useEffect(() => {
    if (!finished) return;
    fetch(`/api/lesson/ritual?concept=${encodeURIComponent(conceptSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setRitual({
          masteryBefore: initialMasteryRef.current ?? d.mastery,
          masteryAfter: d.mastery,
          streak: d.streak,
          next: d.next,
        });
      })
      .catch(() => { /* ecranul rămâne fără cifre, nu gol */ });
  }, [finished, conceptSlug]);
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
  // quiz-ul se închide: rezolvat SAU eșuat cu răscumpărarea încheiată/indisponibilă
  const quizClosed =
    currentQuizState?.status === "solved" ||
    (currentQuizState?.status === "failed" &&
      (!currentQuizState.similar || currentQuizState.redemption !== undefined && currentQuizState.redemption !== null));
  const canAdvance =
    current !== undefined &&
    (current.tip !== "quiz" || quizClosed);

  const advance = useCallback(() => {
    if (idx + 1 < blocks.length) setIdx(idx + 1);
    else if (streamDone) {
      setFinished(true);
      // ETAPA 70 F: momentele 3+4 — lecția completă, apoi scânteia de streak
      playSound("complete");
      if (streak > 0) setTimeout(() => playSound("streak"), 800);
    }
    // altfel: așteptăm următorul bloc din stream (butonul arată spinner)
  }, [idx, blocks.length, streamDone, streak]);

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
        playSound(data.correct ? "correct" : "wrong");
        setQuizStates((prev) => {
          const old = prev[quizId];
          const wrongOptions = old?.wrongOptions ?? [];
          if (data.correct) {
            return {
              ...prev,
              [quizId]: { status: "solved", wrongOptions, selected: letter, correct: true, corecta: data.corecta },
            };
          }
          if (data.attempt === 1) {
            // greșeala 1: indiciu țintit, elevul reîncearcă
            return {
              ...prev,
              [quizId]: { status: "retry", wrongOptions: [...wrongOptions, letter], selected: letter, correct: false, indiciu: data.indiciu },
            };
          }
          // greșeala 2: micro-recap + rezolvarea + similar pentru răscumpărare
          return {
            ...prev,
            [quizId]: {
              status: "failed",
              wrongOptions: [...wrongOptions, letter],
              selected: letter,
              correct: false,
              corecta: data.corecta,
              microRecap: data.microRecap ?? null,
              rezolvare: data.rezolvare ?? null,
              similar: data.similar ?? null,
              redemption: null,
            },
          };
        });
        if (data.correct) setTimeout(advance, 1400);
      } catch (err) {
        console.error("[LessonPlayer] quiz failed:", err instanceof Error ? err.message : err);
      } finally {
        setPendingQuiz(false);
      }
    },
    [messageId, pendingQuiz, advance]
  );

  // ETAPA 70 C: răspunsul pe exercițiul similar (răscumpărarea)
  const submitRedemption = useCallback(
    async (quizId: string, exerciseId: string, answer: string) => {
      if (pendingQuiz || !messageId || !answer.trim()) return;
      setPendingQuiz(true);
      try {
        const resp = await fetch("/api/lesson/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, quizId, exerciseId, answer }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
        if (data.correct !== null) playSound(data.correct ? "correct" : "wrong");
        setQuizStates((prev) => {
          const old = prev[quizId];
          if (!old) return prev;
          return { ...prev, [quizId]: { ...old, redemption: { correct: data.correct, motiv: data.motiv } } };
        });
      } catch (err) {
        console.error("[LessonPlayer] redeem failed:", err instanceof Error ? err.message : err);
      } finally {
        setPendingQuiz(false);
      }
    },
    [messageId, pendingQuiz]
  );

  // ETAPA 70 E: întrebarea pleacă cu ancora conceptului; gardul de temă e în
  // system prompt pe server; răspunsul vine ca blocuri, nu zid de text
  const submitAsk = useCallback(async () => {
    const question = askInput.trim();
    if (!question || askPending) return;
    setAskPending(true);
    setAskError(null);
    try {
      const resp = await fetch("/api/lesson/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: conceptSlug, question }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      setAskAnswer(data.blocks as LessonBlockClient[]);
      setAskInput("");
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setAskPending(false);
    }
  }, [askInput, askPending, conceptSlug]);

  // ── loading inițial ───────────────────────────────────────────────────────
  if (blocks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Pregătesc lecția…</p>
      </div>
    );
  }

  // ── ETAPA 70 G3: ritualul de final — ecran dedicat ────────────────────────
  if (finished) {
    const quizResults = Object.values(quizStates).filter(Boolean) as NonNullable<QuizState>[];
    const correctCount = quizResults.filter((q) => q.correct).length;
    const recapBlock = [...blocks].reverse().find((b) => b.tip === "recap");
    const delta = ritual ? ritual.masteryAfter - ritual.masteryBefore : null;
    const shownStreak = ritual?.streak ?? streak;
    return (
      <div className="relative flex-1 overflow-y-auto px-6 py-8">
        <AnimatedBackdrop intensity="bold" />
        <motion.div
          className="text-center space-y-4 max-w-sm mx-auto"
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
            <p className="text-sm text-muted-foreground">
              {correctCount} din {quizResults.length} întrebări corecte.
            </p>
          )}

          {/* recap — ce ai învățat */}
          {recapBlock && recapBlock.tip === "recap" && (
            <div className="rounded-2xl bg-success-bg border border-success/30 p-4 text-left space-y-1.5">
              <p className="text-xs font-semibold text-success-foreground uppercase">Ce ai învățat</p>
              {recapBlock.puncte.map((p, i) => (
                <p key={i} className="text-sm flex gap-2">
                  <span className="text-success shrink-0">✓</span>
                  <MathText text={p} />
                </p>
              ))}
            </div>
          )}

          {/* delta mastery — animată, doar cifre reale */}
          {ritual && (
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-primary uppercase">Progresul pe concept</p>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: `${ritual.masteryBefore * 100}%` }}
                  animate={{ width: `${ritual.masteryAfter * 100}%` }}
                  transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
                />
              </div>
              <p className="text-sm font-medium">
                {Math.round(ritual.masteryAfter * 100)}%
                {delta !== null && delta > 0.0005 && (
                  <motion.span
                    className="text-success ml-2"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1 }}
                  >
                    +{Math.round(delta * 100)}%
                  </motion.span>
                )}
              </p>
            </div>
          )}

          <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-center gap-3">
            <span className="text-3xl">🔥</span>
            <p className="font-bold">Streak: {shownStreak} {shownStreak === 1 ? "zi" : "zile"}</p>
          </div>

          {/* mâine te așteaptă: următorul concept de pe frontieră */}
          {ritual?.next && (
            <div className="rounded-2xl border bg-card p-4 text-left">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Mâine te așteaptă</p>
              <p className="font-medium text-sm"><MathText text={ritual.next.name} /></p>
            </div>
          )}

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
          <span className="flex items-center gap-3">
            {/* ETAPA 70 F: toggle-ul de sunete, vizibil în player */}
            <button
              onClick={() => { const next = !soundOn; setSoundOn(next); setSoundsEnabled(next); }}
              aria-label={soundOn ? "Oprește sunetele" : "Pornește sunetele"}
              title={soundOn ? "Sunete: pornite" : "Sunete: oprite"}
              suppressHydrationWarning
            >
              {soundOn ? "🔊" : "🔇"}
            </button>
            <button onClick={onExitToChat} className="underline underline-offset-2">
              chat liber
            </button>
          </span>
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
              onRedeem={submitRedemption}
              onContinue={advance}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-4 pb-5 max-w-lg mx-auto w-full shrink-0 space-y-3">
        {/* ETAPA 70 E: răspunsul la întrebarea elevului — blocuri, nu zid de text */}
        <AnimatePresence>
          {askAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-primary/20 bg-card p-4 space-y-3 max-h-72 overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-primary uppercase">Răspuns la întrebarea ta</p>
                <button onClick={() => setAskAnswer(null)} className="text-xs text-muted-foreground underline underline-offset-2">
                  închide
                </button>
              </div>
              {askAnswer.map((b, i) => (
                <AskAnswerBlock key={i} block={b} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {askError && <p className="text-xs text-destructive text-center">{askError}</p>}

        <div className="flex gap-2">
          <input
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAsk()}
            placeholder="Întreabă ceva despre lecție…"
            className="flex-1 rounded-xl border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={submitAsk}
            disabled={askPending || !askInput.trim()}
            className="rounded-xl border border-primary/40 text-primary px-3.5 py-2 text-sm font-medium disabled:opacity-40"
          >
            {askPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Întreabă"}
          </button>
        </div>

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
  onRedeem,
  onContinue,
}: {
  block: LessonBlockClient;
  quizState: QuizState;
  pendingQuiz: boolean;
  onAnswer: (quizId: string, letter: string) => void;
  onRedeem: (quizId: string, exerciseId: string, answer: string) => void;
  onContinue: () => void;
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
      const answerable = !quizState || quizState.status === "retry";
      return (
        <div className="space-y-4">
          <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5">
            <p className="text-xs font-semibold text-primary mb-2 uppercase">Verifică-te</p>
            <p className="font-medium leading-relaxed"><MathText text={block.intrebare} /></p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {LETTERS.map((letter) => {
              const text = block.optiuni[letter];
              const wrong = quizState?.wrongOptions.includes(letter) ?? false;
              let variant = "border-border bg-card hover:border-primary/60 hover:bg-primary/5";
              if (wrong) variant = "border-danger-foreground/30 bg-danger-bg text-danger-foreground opacity-80";
              if (quizState && quizState.status !== "retry") {
                if (letter === quizState.corecta) variant = "border-success/50 bg-success-bg text-success-foreground";
                else if (wrong) variant = "border-danger-foreground/30 bg-danger-bg text-danger-foreground";
                else variant = "border-border bg-card opacity-60";
              }
              const clickable = answerable && !wrong;
              return (
                <motion.button
                  key={letter}
                  onClick={() => clickable && onAnswer(quizId, letter)}
                  disabled={!clickable || pendingQuiz}
                  className={`w-full rounded-2xl border-2 p-4 text-left flex items-center gap-3 transition-all ${variant} disabled:cursor-default`}
                  whileTap={clickable ? buttonTap : {}}
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
            {quizState?.status === "solved" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl px-4 py-3 text-center text-sm font-medium bg-success-bg text-success-foreground"
              >
                ✓ Corect! Mergem mai departe…
              </motion.div>
            )}

            {/* greșeala 1: indiciu țintit + reîncearcă */}
            {quizState?.status === "retry" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl px-4 py-3 text-sm bg-secondary text-secondary-foreground space-y-1"
              >
                <p className="font-semibold">💡 Indiciu:</p>
                <p><MathText text={quizState.indiciu ?? ""} /></p>
                <p className="text-xs opacity-80">Mai încearcă o dată — alege alt răspuns.</p>
              </motion.div>
            )}

            {/* greșeala 2: micro-recap + rezolvare + răscumpărare */}
            {quizState?.status === "failed" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {quizState.microRecap && (quizState.microRecap.tip === "step" || quizState.microRecap.tip === "formula") && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm space-y-1">
                    <p className="text-xs font-semibold text-primary uppercase">Recapitulare scurtă</p>
                    {quizState.microRecap.tip === "step" ? (
                      <>
                        <p className="font-medium"><MathText text={quizState.microRecap.titlu_scurt} /></p>
                        <p><MathText text={quizState.microRecap.corp} /></p>
                        {quizState.microRecap.formula && (
                          <div className="text-center overflow-x-auto"><MathText text={`$$${quizState.microRecap.formula}$$`} /></div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-center overflow-x-auto"><MathText text={`$$${quizState.microRecap.latex}$$`} /></div>
                        <p><MathText text={quizState.microRecap.explicatie} /></p>
                      </>
                    )}
                  </div>
                )}
                <div className="rounded-xl bg-danger-bg text-danger-foreground px-4 py-3 text-sm space-y-2">
                  <p className="font-semibold">Răspunsul corect: {quizState.corecta?.toUpperCase()}</p>
                  {quizState.rezolvare && (
                    <ol className="list-decimal ml-5 space-y-1">
                      {quizState.rezolvare.map((r, i) => (
                        <li key={i}><MathText text={r} /></li>
                      ))}
                    </ol>
                  )}
                </div>
                {quizState.similar ? (
                  <RedemptionCard
                    quizId={quizId}
                    similar={quizState.similar}
                    redemption={quizState.redemption ?? null}
                    pending={pendingQuiz}
                    onRedeem={onRedeem}
                    onContinue={onContinue}
                  />
                ) : (
                  <div className="rounded-xl border px-4 py-3 text-sm text-muted-foreground space-y-2">
                    <p>Nu am un exercițiu similar disponibil pentru acest concept — mergem mai departe.</p>
                    <button onClick={onContinue} className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 font-medium">
                      Continuă →
                    </button>
                  </div>
                )}
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

/** ETAPA 70 E: un bloc din răspunsul îngrădit (doar step/formula/example/table/plot) */
function AskAnswerBlock({ block }: { block: LessonBlockClient }) {
  switch (block.tip) {
    case "step":
      return (
        <div className="text-sm space-y-1">
          <p className="font-semibold"><MathText text={block.titlu_scurt} /></p>
          <p className="leading-relaxed"><MathText text={block.corp} /></p>
          {block.formula && (
            <div className="text-center overflow-x-auto"><MathText text={`$$${block.formula}$$`} /></div>
          )}
        </div>
      );
    case "formula":
      return (
        <div className="text-sm space-y-1 text-center">
          <div className="overflow-x-auto"><MathText text={`$$${block.latex}$$`} /></div>
          <p className="text-muted-foreground"><MathText text={block.explicatie} /></p>
        </div>
      );
    case "example":
      return (
        <div className="text-sm space-y-1.5">
          <p className="font-medium"><MathText text={block.enunt} /></p>
          <ol className="list-decimal ml-5 space-y-1">
            {block.pasi.map((p, i) => (
              <li key={i}>
                <MathText text={p.text} />
                {p.formula && <div className="overflow-x-auto"><MathText text={`$$${p.formula}$$`} /></div>}
              </li>
            ))}
          </ol>
        </div>
      );
    case "table":
      return <LessonTable titlu={block.titlu} coloane={block.coloane} randuri={block.randuri} />;
    case "plot":
      return (
        <div
          className="figura-bac mx-auto max-w-full [&_svg]:max-w-full [&_svg]:h-auto"
          // SVG randat exclusiv pe server (renderPlotSVG, expr validat) — trusted
          dangerouslySetInnerHTML={{ __html: (block as { svg?: string }).svg ?? "" }}
        />
      );
    default:
      return null;
  }
}

/** ETAPA 70 C: răscumpărarea — exercițiu similar după 2 greșeli; mastery urcă DOAR aici */
function RedemptionCard({
  quizId,
  similar,
  redemption,
  pending,
  onRedeem,
  onContinue,
}: {
  quizId: string;
  similar: { exercise_id: string; statement: string; has_figure: boolean };
  redemption: { correct: boolean | null; motiv?: string } | null;
  pending: boolean;
  onRedeem: (quizId: string, exerciseId: string, answer: string) => void;
  onContinue: () => void;
}) {
  const [answer, setAnswer] = useState("");
  return (
    <div className="rounded-xl border-2 border-primary/30 bg-card px-4 py-3 text-sm space-y-3">
      <p className="text-xs font-semibold text-primary uppercase">Răscumpărare: un exercițiu similar</p>
      <p className="leading-relaxed"><MathText text={similar.statement} /></p>
      {similar.has_figure && <LayeredFigure exerciseId={similar.exercise_id} />}
      {redemption ? (
        <div className="space-y-2">
          <div
            className={`rounded-lg px-3 py-2 font-medium ${
              redemption.correct === true
                ? "bg-success-bg text-success-foreground"
                : redemption.correct === false
                  ? "bg-danger-bg text-danger-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {redemption.correct === true
              ? "✓ Corect! Progresul tău urcă — exact pentru asta a fost exercițiul."
              : redemption.correct === false
                ? "Încă nu e corect — dar ai văzut rezolvarea, data viitoare iese."
                : "Nu am un verdict sigur pentru răspunsul ăsta."}
            {redemption.motiv && <span className="block text-xs opacity-80 mt-1">{redemption.motiv}</span>}
          </div>
          <button onClick={onContinue} className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 font-medium">
            Continuă →
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Răspunsul tău"
            className="flex-1 rounded-xl border px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={() => onRedeem(quizId, similar.exercise_id, answer)}
            disabled={pending || !answer.trim()}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 font-medium disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Trimite"}
          </button>
        </div>
      )}
    </div>
  );
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
