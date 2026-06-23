"use client";

/** ETAPA 83 I: descărcare/printare a foii de formule (window.print → Salvează ca PDF). */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="shrink-0 rounded-xl bg-[var(--bg-electric)] text-primary-foreground px-4 py-2 text-sm font-semibold"
    >
      Descarcă / Printează
    </button>
  );
}
