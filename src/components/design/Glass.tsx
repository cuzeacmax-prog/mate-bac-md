/**
 * Glass.tsx — ETAPA 73 FAZA B: componentele de bază ale design-ului glass dark
 * (docs/DESIGN.md §7). Toate culorile DOAR din tokens; controale = pilule;
 * carduri rotunjite 16-24px; spațiere pe ritm de 4/8.
 */
import { cn } from "@/lib/utils";

/** panou glass, nivel de elevație 1-3 — NICIODATĂ sub formule (alea pe --card) */
export function GlassPanel({
  level = 1,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { level?: 1 | 2 | 3 }) {
  return (
    <div className={cn(`glass-${level} rounded-2xl`, className)} {...rest}>
      {children}
    </div>
  );
}

/** buton pilulă — variantele din spec */
export function PillButton({
  variant = "primary",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const styles =
    variant === "primary"
      ? // ETAPA 74 A5: gradientul viu, animat lent pe hover (.btn-living)
        "btn-living bg-primary text-primary-foreground"
      : variant === "secondary"
        ? "glass-2 glass-hover text-foreground hover:bg-[var(--glass-3)]"
        : "text-muted-foreground hover:text-foreground hover:bg-[var(--glass-1)]";
  return (
    <button
      className={cn(
        "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-default",
        styles,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** tab pilulă (lentile, filtre) */
export function PillTab({
  active,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      className={cn(
        "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40",
        active ? "bg-primary text-primary-foreground" : "glass-1 text-muted-foreground hover:text-foreground",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** cifră + etichetă pe glass */
export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <GlassPanel level={1} className={cn("p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </GlassPanel>
  );
}
