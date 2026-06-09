"use client";

/**
 * LessonTable — ETAPA 67 FAZA D1: blocul `table` (date structurate, nu markdown).
 * Zebra discret, header clar, aliniere numerică la dreapta, MathText în celule,
 * scroll orizontal pe mobil.
 */
import { MathText } from "@/components/MathText";

interface Props {
  titlu?: string;
  coloane: string[];
  randuri: string[][];
}

const NUMERIC_RE = /^[\s$]*-?\d+([.,]\d+)?[\s$%]*$/;

export function LessonTable({ titlu, coloane, randuri }: Props) {
  // o coloană e numerică dacă toate celulele ei nevide arată a număr
  const numericCol = coloane.map((_, ci) =>
    randuri.every((r) => !r[ci]?.trim() || NUMERIC_RE.test(r[ci]))
  );

  return (
    <div className="w-full">
      {titlu && <p className="text-sm font-medium mb-2"><MathText text={titlu} /></p>}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              {coloane.map((c, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 font-semibold border-b text-left ${numericCol[i] ? "text-right" : ""}`}
                >
                  <MathText text={c} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {randuri.map((rand, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? "bg-muted/40" : ""}>
                {rand.map((cel, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-1.5 border-b border-border/60 ${numericCol[ci] ? "text-right font-mono" : ""}`}
                  >
                    <MathText text={cel} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
