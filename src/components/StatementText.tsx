"use client";

/**
 * StatementText — ETAPA 73 FAZA D1: enunț cu suport de TABEL markdown.
 * Textul trece prin MathText (KaTeX pe delimitatori), iar blocul de tabel
 * (dacă există) se randează nativ prin LessonTable — niciodată pipe-uri brute.
 */
import { MathText } from "@/components/MathText";
import { LessonTable } from "@/components/lesson/LessonTable";
import { extractMarkdownTable } from "@/lib/content/markdown-table";

export function StatementText({ text, className }: { text: string; className?: string }) {
  const table = extractMarkdownTable(text);
  if (!table) return <MathText text={text} className={className} />;
  return (
    <span className={className ?? "block space-y-2"}>
      {table.before && <MathText text={table.before} className="block whitespace-pre-wrap" />}
      {/* tabelele late nu sparg mobilul — scroll orizontal în card */}
      <span className="block overflow-x-auto">
        <LessonTable coloane={table.columns} randuri={table.rows} />
      </span>
      {table.after && <MathText text={table.after} className="block whitespace-pre-wrap" />}
    </span>
  );
}
