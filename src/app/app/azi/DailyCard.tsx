"use client";

/**
 * DailyCard — ETAPA 14: cardul daily challenge de pe /app/azi.
 * Primește provocarea construită server-side (determinist, zero LLM pe pagină);
 * răspunsurile pleacă spre POST /api/daily/attempt (evaluarea ETAPA 63).
 */
import { useRef, useState } from "react";

import { StatementText } from "@/components/StatementText";
import { playFeedback } from "@/lib/motion/feedback";
import type { DailyExercise } from "@/lib/daily/daily";
import { BreathingOrb } from "@/components/motion/BreathingOrb";

interface Props {
  exercises: DailyExercise[];
  completed: boolean;
  streak: number;
}

interface AttemptResult {
  correct: boolean | null;
  method: string;
}

export function DailyCard({ exercises: initial, completed: initialCompleted, streak: initialStreak }: Props) {
  const [exercises, setExercises] = useState<DailyExercise[]>(initial);
  const [completed, setCompleted] = useState(initialCompleted);
  const [streak, setStreak] = useState(initialStreak);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, AttemptResult>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ETAPA 74 A4: ținta feedback-ului din registru, per card de exercițiu
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function submit(exerciseId: string) {
    const answer = (answers[exerciseId] ?? "").trim();
    if (!answer || pending) return;
    setPending(exerciseId);
    setError(null);
    try {
      const res = await fetch("/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResults((prev) => ({ ...prev, [exerciseId]: { correct: data.correct, method: data.method } }));
      // ETAPA 74 A4: feedback din REGISTRU (verdict null = fără efect)
      if (data.correct !== null) {
        playFeedback(data.correct ? "corect" : "gresit", cardRefs.current[exerciseId]);
      }
      setExercises(data.exercises);
      setCompleted(data.completed);
      setStreak(data.streak);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la trimitere");
    } finally {
      setPending(null);
    }
  }

  const attemptedCount = exercises.filter((e) => e.attempted).length;

  return (
    <div className="glass-2 rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">Provocarea zilei</h2>
          <p className="text-xs text-muted-foreground">
            {attemptedCount}/{exercises.length} rezolvate · aceleași exerciții toată ziua
          </p>
        </div>
        <div className="flex items-center gap-1 font-bold" title="Zile la rând cu daily-ul completat">
          <span aria-hidden>🔥</span>
          {streak}
        </div>
      </div>

      {completed && (
        <div className="rounded-xl bg-success-bg text-success-foreground px-4 py-3 text-sm font-medium">
          ✓ Daily-ul de azi e completat — streak-ul tău: {streak} {streak === 1 ? "zi" : "zile"}. Revino mâine!
        </div>
      )}

      <div className="space-y-4">
        {exercises.map((ex, i) => {
          const result = results[ex.exercise_id];
          const done = ex.attempted;
          return (
            <div
              key={ex.exercise_id}
              ref={(el) => { cardRefs.current[ex.exercise_id] = el; }}
              className="glass-solid rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {i + 1}. {ex.concept_name}
                  {ex.tier === "sursa-oficiala" && (
                    <span className="ml-2 rounded-full bg-secondary text-secondary-foreground px-2 py-0.5">
                      din culegerea oficială BAC
                    </span>
                  )}
                </p>
                {done && (
                  <span className={`text-xs font-semibold ${ex.correct ? "text-success" : "text-danger-foreground"}`}>
                    {ex.correct ? "✓ corect" : "✗ greșit"}
                  </span>
                )}
              </div>
              <div className="text-sm leading-relaxed">
                <StatementText text={ex.statement} />
              </div>
              {ex.has_figure && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/figura/${ex.exercise_id}`}
                  alt="Figura exercițiului"
                  className="max-w-full figura-bac"
                />
              )}
              {!done ? (
                <div className="flex gap-2">
                  <input
                    value={answers[ex.exercise_id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [ex.exercise_id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit(ex.exercise_id);
                    }}
                    placeholder="Răspunsul tău (ex: 13 sau 3/2)"
                    disabled={pending !== null}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    onClick={() => submit(ex.exercise_id)}
                    disabled={pending !== null || !(answers[ex.exercise_id] ?? "").trim()}
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {pending === ex.exercise_id ? <BreathingOrb size="sm" /> : "Verifică"}
                  </button>
                </div>
              ) : (
                result?.correct === null && (
                  <p className="text-xs text-muted-foreground">
                    Răspuns înregistrat — nu am putut da un verdict sigur, progresul nu s-a modificat.
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
