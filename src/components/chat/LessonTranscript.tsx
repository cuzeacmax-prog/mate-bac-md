"use client";

/**
 * LessonTranscript — ETAPA 73 FAZA E (defect prins de bucla vizuală):
 * conversațiile-lecție persistă mesajul ca JSON {"lesson":true, blocks:[...]} —
 * înainte se afișa JSON-ul BRUT. Aici: transcript read-only al blocurilor
 * (quiz-ul doar ca întrebare — corecta nu se dezvăluie nici aici).
 */
import { MathText } from "@/components/MathText";
import { LessonTable } from "@/components/lesson/LessonTable";

interface RawBlock {
  tip: string;
  [k: string]: unknown;
}

export function parseLessonContent(content: string): { concept?: string; blocks: RawBlock[] } | null {
  if (!content.trimStart().startsWith('{"lesson"')) return null;
  try {
    const parsed = JSON.parse(content) as { lesson?: boolean; concept?: string; blocks?: RawBlock[] };
    if (!parsed.lesson || !Array.isArray(parsed.blocks)) return null;
    return { concept: parsed.concept, blocks: parsed.blocks };
  } catch {
    return null;
  }
}

function TranscriptBlock({ b }: { b: RawBlock }) {
  switch (b.tip) {
    case "intro":
      return (
        <div>
          <p className="font-bold"><MathText text={String(b.titlu ?? "")} /></p>
          <p className="text-sm mt-1"><MathText text={String(b.ideea_mare ?? "")} /></p>
        </div>
      );
    case "step":
      return (
        <div className="text-sm space-y-1">
          <p className="font-semibold"><MathText text={String(b.titlu_scurt ?? "")} /></p>
          <p><MathText text={String(b.corp ?? "")} /></p>
          {typeof b.formula === "string" && b.formula && (
            <div className="text-center overflow-x-auto"><MathText text={`$$${b.formula}$$`} /></div>
          )}
        </div>
      );
    case "formula":
      return (
        <div className="text-sm space-y-1 text-center">
          <div className="overflow-x-auto"><MathText text={`$$${String(b.latex ?? "")}$$`} /></div>
          <p className="text-muted-foreground"><MathText text={String(b.explicatie ?? "")} /></p>
        </div>
      );
    case "example": {
      const pasi = Array.isArray(b.pasi) ? (b.pasi as Array<{ text?: string; formula?: string }>) : [];
      return (
        <div className="text-sm space-y-1.5">
          <p className="font-medium"><MathText text={String(b.enunt ?? "")} /></p>
          <ol className="list-decimal ml-5 space-y-1">
            {pasi.map((p, i) => (
              <li key={i}>
                <MathText text={String(p.text ?? "")} />
                {p.formula && <div className="overflow-x-auto"><MathText text={`$$${p.formula}$$`} /></div>}
              </li>
            ))}
          </ol>
        </div>
      );
    }
    case "quiz":
      return (
        <div className="text-sm rounded-xl glass-1 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Quiz (verificat în lecție)</p>
          <MathText text={String(b.intrebare ?? "")} />
        </div>
      );
    case "table": {
      const coloane = Array.isArray(b.coloane) ? (b.coloane as string[]) : [];
      const randuri = Array.isArray(b.randuri) ? (b.randuri as string[][]) : [];
      if (coloane.length === 0) return null;
      return (
        <div className="overflow-x-auto">
          <LessonTable titlu={typeof b.titlu === "string" ? b.titlu : undefined} coloane={coloane} randuri={randuri} />
        </div>
      );
    }
    case "recap": {
      const puncte = Array.isArray(b.puncte) ? (b.puncte as string[]) : [];
      return (
        <div className="text-sm rounded-xl bg-success-bg text-success-foreground px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase">Ce ai învățat</p>
          {puncte.map((p, i) => (
            <p key={i} className="flex gap-1.5"><span>✓</span><MathText text={p} /></p>
          ))}
        </div>
      );
    }
    default:
      return null; // figure/plot/manipulative: trăiesc în player, nu în transcript
  }
}

export function LessonTranscript({ concept, blocks }: { concept?: string; blocks: RawBlock[] }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        📖 Transcriptul lecției{concept ? `: ${concept}` : ""}
      </p>
      {blocks.map((b, i) => (
        <TranscriptBlock key={i} b={b} />
      ))}
    </div>
  );
}
