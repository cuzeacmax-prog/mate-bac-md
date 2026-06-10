"use client";

/**
 * ProgressMap — ETAPA 73 FAZA C: zidul de pastile MOARE.
 * Fiecare domeniu = secțiune glass cu INEL de progres în culoarea lui;
 * conceptele grupate pe BORNE (Baza/Solid/Performanță), nu 131 de chips-uri
 * identice. Framing motivant: progresul pe domeniul activ, nu „0/131" sec.
 * Click pe concept → lecția (?concept=). Zero LLM.
 */
import Link from "next/link";
import { motion } from "framer-motion";
import { MathText } from "@/components/MathText";
import { MODULE_DOMAINS } from "@/lib/map/domain-colors";
import { CONCEPT_MILESTONES, MILESTONE_LABELS, type Milestone } from "@/lib/map/milestones";
import type { ProgressDomain, ProgressConcept } from "@/lib/progres/data";

const MILESTONE_ORDER: Milestone[] = ["baza", "solid", "performanta"];

function ProgressRing({ value, total, colorVar }: { value: number; total: number; colorVar: string }) {
  const pct = total > 0 ? value / total : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`${value} din ${total} stăpânite`}>
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--glass-3-border)" strokeWidth="6" />
      <circle
        cx="34" cy="34" r={r} fill="none"
        stroke={colorVar} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="39" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--foreground)" stroke="none">
        {value}
      </text>
    </svg>
  );
}

function ConceptPill({ c }: { c: ProgressConcept }) {
  const style =
    c.status === "stapanit"
      ? "bg-success-bg text-success-foreground border-transparent"
      : c.status === "in-lucru"
        ? "glass-2 text-foreground"
        : "glass-1 text-muted-foreground";
  return (
    <Link
      href={`/app/chat?concept=${encodeURIComponent(c.slug)}`}
      className={`rounded-full border px-3 py-1.5 text-xs leading-snug transition-opacity hover:opacity-80 ${style}`}
      title={
        c.status === "stapanit"
          ? `Stăpânit (${Math.round(c.mastery * 100)}%)`
          : c.status === "in-lucru"
            ? `În lucru (${Math.round(c.mastery * 100)}%)`
            : "Nestudiat — începe lecția"
      }
    >
      {c.status === "stapanit" && <span className="mr-1">✓</span>}
      {c.status === "in-lucru" && <span className="mr-1 font-semibold">{Math.round(c.mastery * 100)}%</span>}
      <MathText text={c.name} />
    </Link>
  );
}

export function ProgressMap({ domains }: { domains: ProgressDomain[] }) {
  return (
    <div className="space-y-5">
      {domains.map((d, di) => {
        const dk = MODULE_DOMAINS[d.module]?.key;
        const colorVar = dk ? `var(--domain-${dk})` : "var(--primary)";
        const started = d.mastered + d.inProgress;
        // gruparea pe borne
        const byMilestone = new Map<Milestone | "alte", ProgressConcept[]>();
        for (const c of d.concepts) {
          const m = (CONCEPT_MILESTONES[c.slug] ?? "alte") as Milestone | "alte";
          const arr = byMilestone.get(m) ?? [];
          arr.push(c);
          byMilestone.set(m, arr);
        }
        return (
          <motion.section
            key={d.module}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: di * 0.05, duration: 0.35 }}
            className="glass-1 rounded-3xl p-5"
          >
            <div className="flex items-center gap-4 mb-4">
              <ProgressRing value={d.mastered} total={Math.max(d.total, 1)} colorVar={colorVar} />
              <div className="min-w-0">
                <h2 className="font-bold flex items-center gap-2">
                  <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colorVar }} />
                  {MODULE_DOMAINS[d.module]?.label ?? d.module}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {started > 0
                    ? `${d.mastered} stăpânite · ${d.inProgress} în lucru din ${d.total}`
                    : d.concepts.length === 0
                      ? `Conținut în curând — ${d.servable} exerciții pregătite`
                      : `${d.total} concepte te așteaptă — primul pas deschide domeniul`}
                </p>
              </div>
            </div>

            {d.concepts.length > 0 && (
              <div className="space-y-3">
                {MILESTONE_ORDER.map((m) => {
                  const concepts = byMilestone.get(m);
                  if (!concepts || concepts.length === 0) return null;
                  const done = concepts.filter((c) => c.status === "stapanit").length;
                  return (
                    <div key={m}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: `var(--domain-${dk}-fg)` }}>
                        {MILESTONE_LABELS[m]} · {done}/{concepts.length}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {concepts.map((c) => <ConceptPill key={c.id} c={c} />)}
                      </div>
                    </div>
                  );
                })}
                {(byMilestone.get("alte") ?? []).length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 text-muted-foreground">
                      Alte concepte
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(byMilestone.get("alte") ?? []).map((c) => <ConceptPill key={c.id} c={c} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.section>
        );
      })}
    </div>
  );
}
