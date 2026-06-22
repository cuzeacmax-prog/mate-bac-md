"use client";

/**
 * ETAPA 82 FAZA A2 — clasă + obiectiv editabile din setări.
 * Schimbarea obiectivului re-decide ce vede elevul (hartă, mesaje, traseu),
 * deci se salvează explicit. Sursa unică a opțiunilor: src/lib/profile/goal.ts.
 */
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { GOAL_OPTIONS, type Goal } from "@/lib/profile/goal";

const GRADES = [9, 10, 11, 12] as const;

export function ClassGoal({
  initialGrade,
  initialGoal,
}: {
  initialGrade: number | null;
  initialGoal: Goal;
}) {
  const startGrade =
    initialGrade && GRADES.includes(initialGrade as 9 | 10 | 11 | 12) ? initialGrade : 12;
  const [grade, setGrade] = useState<number>(startGrade);
  const [goal, setGoal] = useState<Goal>(initialGoal);
  const [savedGrade, setSavedGrade] = useState<number>(startGrade);
  const [savedGoal, setSavedGoal] = useState<Goal>(initialGoal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = grade !== savedGrade || goal !== savedGoal;

  async function save() {
    setBusy(true);
    setError(null);
    setOk(false);
    const resp = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade_level: grade, goal }),
    });
    if (resp.ok) {
      setSavedGrade(grade);
      setSavedGoal(goal);
      setOk(true);
    } else {
      const data = (await resp.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Nu s-a putut salva.");
    }
    setBusy(false);
  }

  return (
    <section className="glass-solid rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-5 w-5 text-primary shrink-0" />
        <div>
          <p className="font-semibold text-sm">Clasă și obiectiv</p>
          <p className="text-xs text-muted-foreground">
            Aplicația îți arată doar ce contează pentru clasa și obiectivul tău.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Clasa</p>
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => { setGrade(g); setOk(false); }}
              className={`rounded-xl border-2 py-2.5 text-center font-bold text-sm transition-all duration-150 active:scale-95 ${
                grade === g
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-[var(--glass-2)] hover:border-primary/40"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Obiectiv</p>
        <div className="space-y-2">
          {GOAL_OPTIONS.map(({ goal: g, label, desc, emoji }) => (
            <button
              key={g}
              onClick={() => { setGoal(g); setOk(false); }}
              className={`w-full rounded-xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.98] flex items-center gap-3 ${
                goal === g
                  ? "border-primary bg-primary/10"
                  : "border-[var(--glass-2)] hover:border-primary/40"
              }`}
            >
              <span className="text-xl shrink-0" aria-hidden>{emoji}</span>
              <span className="min-w-0">
                <span className="block font-semibold text-sm">{label}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {dirty && (
          <button
            onClick={save}
            disabled={busy}
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shrink-0"
          >
            {busy ? "..." : "Salvează"}
          </button>
        )}
        {ok && !dirty && <span className="text-xs text-success">✓ Salvat</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </section>
  );
}
