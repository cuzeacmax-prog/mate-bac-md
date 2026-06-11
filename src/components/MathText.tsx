"use client";

/**
 * MathText — randare inline KaTeX pentru orice text scurt afișat elevului
 * în afara MessageRenderer (ETAPA 62): enunțuri de exerciții, variante A–D,
 * carduri /app/azi, titluri.
 *
 * Reguli:
 *  - DOAR matematica dintre delimitatori expliciți ($...$, $$...$$, \(...\), \[...\])
 *    se randează; textul românesc rămâne text brut.
 *  - LaTeX invalid → fallback la textul original cu delimitatori (try/catch
 *    per expresie, fără crash).
 */
import katex from "katex";
import { segmentDelimitedMath } from "@/lib/content-math";
// ETAPA 74 B2: macro-urile partajate (MathText + MessageRenderer + randare-audit)
import { KATEX_MACROS, tabularToArray } from "@/lib/content/katex-macros";

interface Props {
  text: string;
  className?: string;
}

export function MathText({ text, className }: Props) {
  if (!text) return null;
  const segments = segmentDelimitedMath(text);
  return (
    <span className={className ?? "whitespace-pre-wrap"}>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.value}</span>;
        try {
          // tabular (LaTeX de paginare) → array (KaTeX îl știe) — ETAPA 74 B2
          const html = katex.renderToString(tabularToArray(seg.value), {
            displayMode: seg.display,
            throwOnError: true,
            strict: false,
            trust: false,
            macros: KATEX_MACROS,
          });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={i}>{seg.raw ?? seg.value}</span>;
        }
      })}
    </span>
  );
}
