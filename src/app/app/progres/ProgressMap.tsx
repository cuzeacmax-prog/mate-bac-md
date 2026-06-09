"use client";

/**
 * ProgressMap — ETAPA 68 P1a: harta conceptelor pe domenii.
 * Grilă de celule colorate discret (Tailwind), tranziții Framer blânde —
 * NU graf interactiv (xyflow rămâne în admin). Click pe celulă → lecția
 * conceptului (?concept=). Zero LLM.
 */
import Link from "next/link";
import { motion } from "framer-motion";
import { MathText } from "@/components/MathText";
import type { ProgressDomain } from "@/lib/progres/data";

const STATUS_STYLE: Record<string, string> = {
  stapanit: "bg-green-100 border-green-300 text-green-900 hover:border-green-500",
  "in-lucru": "bg-amber-50 border-amber-300 text-amber-900 hover:border-amber-500",
  nestudiat: "bg-muted/60 border-border text-muted-foreground hover:border-primary/50",
};

export function ProgressMap({ domains }: { domains: ProgressDomain[] }) {
  return (
    <div className="space-y-6">
      {domains.map((d, di) => (
        <motion.section
          key={d.module}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: di * 0.05, duration: 0.35 }}
          className="rounded-2xl border bg-card p-5"
        >
          <div className="flex items-baseline justify-between mb-3 gap-2">
            <h2 className="font-semibold">{d.module}</h2>
            <p className="text-xs text-muted-foreground">
              {d.mastered}/{d.total} stăpânite
              {d.inProgress > 0 && ` · ${d.inProgress} în lucru`}
            </p>
          </div>
          {d.concepts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Conținut în curând — modulul are {d.servable} exerciții pregătite.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {d.concepts.map((c) => (
                <Link
                  key={c.id}
                  href={`/app/chat?concept=${encodeURIComponent(c.slug)}`}
                  className={`rounded-xl border px-3 py-2 text-xs leading-snug transition-colors ${STATUS_STYLE[c.status]}`}
                  title={
                    c.status === "stapanit"
                      ? `Stăpânit (${Math.round(c.mastery * 100)}%)`
                      : c.status === "in-lucru"
                        ? `În lucru (${Math.round(c.mastery * 100)}%)`
                        : "Nestudiat — începe lecția"
                  }
                >
                  <MathText text={c.name} />
                </Link>
              ))}
            </div>
          )}
        </motion.section>
      ))}
    </div>
  );
}
