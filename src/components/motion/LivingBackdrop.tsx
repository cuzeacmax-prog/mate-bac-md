"use client";

/**
 * LivingBackdrop — ETAPA 74 A1: FUNDALUL VIU al tuturor ecranelor elevului.
 *
 * 3 straturi suprapuse, toate DOAR transform/opacity (compozitate pe GPU):
 *  (1) baza: gradient radial dublu STATIC (violet stânga-sus, indigo dreapta-jos);
 *  (2) 3 ORBURI mari (40-55vw) cu radial-gradient (violet→roz / lime→teal),
 *      blur 80px, opacity 0.25-0.35, drift lent 42-58s — „glow-ul Gizmo";
 *  (3) 10 GLIFE matematice (∫ π Σ √ ∞ θ ± Δ ∂ lim) la opacity 0.04-0.07,
 *      40-120px, drift foarte lent pe 4 trasee, 50-90s desincronizate.
 *
 * Ascultă BACKDROP_BOOST_EVENT (lecție completă, registrul A4) → orbii se
 * intensifică 2 secunde. prefers-reduced-motion → totul static (CSS).
 * Sub conținut (fixed -z-10), aria-hidden, pointer-events-none.
 */
import { useEffect, useRef, useState } from "react";
import { BACKDROP_BOOST_EVENT } from "@/lib/motion/feedback";

interface Glyph {
  ch: string;
  left: string;
  top: string;
  size: number; // px, 40-120
  opacity: number; // 0.04-0.07
  path: 1 | 2 | 3 | 4;
  durS: number; // 50-90, desincronizate
  delayS: number; // negativ → fiecare pornește din alt punct al traseului
}

// poziții fixe (nu random la render — zero hydration mismatch, layout stabil)
const GLYPHS: Glyph[] = [
  { ch: "∫", left: "6%", top: "12%", size: 110, opacity: 0.06, path: 1, durS: 64, delayS: -10 },
  { ch: "π", left: "82%", top: "8%", size: 78, opacity: 0.055, path: 2, durS: 72, delayS: -30 },
  { ch: "Σ", left: "70%", top: "58%", size: 120, opacity: 0.05, path: 3, durS: 86, delayS: -52 },
  { ch: "√", left: "16%", top: "66%", size: 92, opacity: 0.06, path: 4, durS: 58, delayS: -18 },
  { ch: "∞", left: "44%", top: "26%", size: 64, opacity: 0.045, path: 2, durS: 78, delayS: -44 },
  { ch: "θ", left: "90%", top: "38%", size: 56, opacity: 0.06, path: 1, durS: 54, delayS: -8 },
  { ch: "±", left: "30%", top: "84%", size: 48, opacity: 0.07, path: 3, durS: 50, delayS: -25 },
  { ch: "Δ", left: "57%", top: "76%", size: 70, opacity: 0.05, path: 4, durS: 82, delayS: -60 },
  { ch: "∂", left: "8%", top: "40%", size: 44, opacity: 0.065, path: 2, durS: 66, delayS: -37 },
  { ch: "lim", left: "63%", top: "5%", size: 40, opacity: 0.05, path: 1, durS: 90, delayS: -70 },
];

export function LivingBackdrop() {
  const [boost, setBoost] = useState(false);
  const timerRef = useRef<number>(0);
  useEffect(() => {
    const onBoost = () => {
      setBoost(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setBoost(false), 2000);
    };
    window.addEventListener(BACKDROP_BOOST_EVENT, onBoost);
    return () => {
      window.removeEventListener(BACKDROP_BOOST_EVENT, onBoost);
      window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={`living-backdrop fixed inset-0 -z-10 overflow-hidden pointer-events-none${boost ? " boost" : ""}`}
    >
      <div className="absolute inset-0 living-base" />
      <div className="living-orb living-orb-1" />
      <div className="living-orb living-orb-2" />
      <div className="living-orb living-orb-3" />
      {GLYPHS.map((g) => (
        <span
          key={g.ch}
          className={`living-glyph living-glyph-${g.path}`}
          style={{
            left: g.left,
            top: g.top,
            fontSize: g.size,
            opacity: g.opacity,
            ["--glyph-dur" as string]: `${g.durS}s`,
            animationDelay: `${g.delayS}s`,
          }}
        >
          {g.ch}
        </span>
      ))}
    </div>
  );
}
