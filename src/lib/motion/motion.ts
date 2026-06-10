/**
 * motion.ts — ETAPA 70 FAZA A2: sistemul de mișcare al design system-ului.
 *
 * 3 viteze standard + spring-uri + variants reutilizabile. Orice animație
 * nouă folosește valorile de aici, nu numere ad-hoc.
 * prefers-reduced-motion e respectat GLOBAL prin <MotionConfig reducedMotion="user">
 * (MotionProvider) — transformările dispar, rămâne fade simplu.
 */
import type { Transition, Variants } from "framer-motion";

/** durate standard (secunde) */
export const DUR = { fast: 0.15, base: 0.28, slow: 0.45 } as const;

/** spring-uri standard */
export const SPRING: Record<"snappy" | "standard" | "gentle", Transition> = {
  snappy: { type: "spring", stiffness: 400, damping: 30 },
  standard: { type: "spring", stiffness: 300, damping: 26 },
  gentle: { type: "spring", stiffness: 200, damping: 22 },
};

/** intrarea unui card / bloc de lecție */
export const cardEnter: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.standard },
  exit: { opacity: 0, y: -16, transition: { duration: DUR.fast } },
};

/** apăsarea unui buton (whileTap) */
export const buttonTap = { scale: 0.95 } as const;

/** umplerea barei de progres */
export const progressFill: Transition = { duration: DUR.base, ease: "easeOut" };

/** feedback răspuns corect: puls scurt de confirmare */
export const feedbackCorrect: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: [0.9, 1.06, 1], transition: { duration: DUR.slow, times: [0, 0.6, 1] } },
};

/** feedback răspuns greșit: scuturare blândă (nu punitivă) */
export const feedbackWrong: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, x: [0, -6, 6, -3, 0], transition: { duration: DUR.slow } },
};

/** celebrare (final de lecție, streak) */
export const celebrate: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: SPRING.gentle },
};
