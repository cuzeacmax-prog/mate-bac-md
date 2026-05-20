"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ThreeScene = dynamic(
  () => import("./ThreeScene").then((m) => ({ default: m.ThreeScene })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: 400, width: "100%" }}
        className="flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200"
      >
        <div className="flex flex-col items-center gap-2 text-slate-500 text-sm">
          <div className="w-6 h-6 border-2 border-slate-400 border-t-indigo-500 rounded-full animate-spin" />
          <span>Se încarcă 3D...</span>
        </div>
      </div>
    ),
  }
);

interface Props {
  spec: string;
}

export function ThreeRenderer({ spec }: Props) {
  const parsed = useMemo(() => {
    try {
      return { data: JSON.parse(spec), error: null };
    } catch {
      return { data: null, error: "JSON invalid în blocul three." };
    }
  }, [spec]);

  if (parsed.error) {
    return (
      <div className="text-sm text-red-500 border border-red-200 rounded p-3 bg-red-50">
        Eroare vizualizare 3D: {parsed.error}
      </div>
    );
  }

  return <ThreeScene spec={parsed.data} />;
}
