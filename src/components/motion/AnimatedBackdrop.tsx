/**
 * AnimatedBackdrop — ETAPA 70 FAZA A3: forme animate de fundal.
 *
 * Blob-uri în culorile brandului, derivă lentă continuă, DOAR
 * transform/opacity (keyframes CSS în globals.css, compozitate pe GPU).
 * Sub conținut (absolute + -z), aria-hidden, pointer-events-none.
 * prefers-reduced-motion → blob-urile rămân statice (animation: none în CSS).
 * Server-safe: zero JS la runtime — doar markup + CSS.
 */
export function AnimatedBackdrop({ intensity = "subtle" }: { intensity?: "subtle" | "bold" }) {
  // ETAPA 73: orb-urile gradient ale identității (violet → roz → lime),
  // luminoase pe fundalul închis; tot doar transform/opacity (GPU)
  const o = intensity === "bold" ? 0.25 : 0.14;
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="backdrop-blob-1 absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full blur-3xl"
        style={{ background: "var(--orb-1)", opacity: o }}
      />
      <div
        className="backdrop-blob-2 absolute top-1/3 -right-32 w-[24rem] h-[24rem] rounded-full blur-3xl"
        style={{ background: "var(--orb-2)", opacity: o }}
      />
      <div
        className="backdrop-blob-3 absolute -bottom-28 left-1/4 w-[26rem] h-[26rem] rounded-full blur-3xl"
        style={{ background: "var(--orb-3)", opacity: intensity === "bold" ? 0.18 : 0.1 }}
      />
    </div>
  );
}
