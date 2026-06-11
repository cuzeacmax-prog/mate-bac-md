/**
 * BreathingOrb — ETAPA 77 D3: loader-ul DE BRAND. Spinnerele generice mor;
 * orbul gradient al identității respiră (scale+opacity, GPU). Mărimi pe scară.
 * reduced-motion → orb static (CSS).
 */
export function BreathingOrb({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const px = size === "sm" ? 20 : size === "lg" ? 56 : 36;
  return (
    <span className="inline-flex flex-col items-center gap-2" role="status" aria-label={label ?? "Se încarcă"}>
      <span
        aria-hidden
        className="breathing-orb rounded-full"
        style={{
          width: px,
          height: px,
          background: "radial-gradient(circle at 38% 35%, var(--orb-1), var(--orb-2) 60%, transparent 85%)",
        }}
      />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </span>
  );
}
