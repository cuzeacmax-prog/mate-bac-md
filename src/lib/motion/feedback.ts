/**
 * feedback.ts — ETAPA 74 A4: REGISTRUL central eveniment → animație.
 *
 * Fiecare eveniment de produs are O SINGURĂ definiție de feedback vizual,
 * aici — componentele cheamă playFeedback(event, țintă), niciodată animații
 * ad-hoc inline. Clasele CSS (fx-*) trăiesc în globals.css.
 *
 *  corect           → inel care se extinde + 6-8 scântei verde-lime + glow pe card
 *  gresit           → shake blând orizontal (3 oscilații, 300ms) + flash bordură roșu-cald
 *  indiciu          → pulsație ambră pe chip
 *  lectie-completa  → ~20 particule în culorile brandului (1.2s) + orbii se intensifică 2s
 *  streak           → flacăra crește cu spring + 2-3 scântei
 *  concept-stapanit → undă radială (pe hartă clasa fx-node-wave se pune direct
 *                     pe <circle>; pe ritual prin playFeedback)
 *
 * prefers-reduced-motion → DOAR schimbările de culoare (flash/glow);
 * particulele, shake-ul și undele nu se mai emit (CSS-ul le și ascunde).
 */

export type FeedbackEvent =
  | "corect"
  | "gresit"
  | "indiciu"
  | "lectie-completa"
  | "streak"
  | "concept-stapanit";

/** evenimentul global pe care LivingBackdrop îl ascultă ca să intensifice orbii */
export const BACKDROP_BOOST_EVENT = "mate:backdrop-boost";

interface ParticleSpec {
  count: number;
  /** valori CSS (tokens!) din care se alege culoarea fiecărei particule */
  colors: string[];
  durationMs: number;
  /** raza maximă de zbor (px) */
  spread: number;
  sizePx: [number, number];
  /** particulele acoperă tot ecranul (lecție completă), nu doar ținta */
  fullscreen?: boolean;
}

interface FeedbackSpec {
  /** clase fx-* aplicate țintei (se scot după durationMs) */
  targetClasses: string[];
  /** clase aplicate și pe reduced-motion (doar culoare: flash/glow) */
  colorOnlyClasses: string[];
  durationMs: number;
  /** inel care se extinde din conturul țintei */
  ring?: { borderColor: string };
  particles?: ParticleSpec;
  /** eveniment global emis (ex. boost-ul orbilor din fundal) */
  windowEvent?: string;
}

const BRAND_COLORS = ["var(--orb-1)", "var(--orb-2)", "var(--orb-3)", "var(--primary)", "var(--accent)"];

export const FEEDBACK: Record<FeedbackEvent, FeedbackSpec> = {
  corect: {
    targetClasses: ["fx-host", "fx-glow-success"],
    colorOnlyClasses: ["fx-glow-success"],
    durationMs: 700,
    ring: { borderColor: "var(--success)" },
    particles: { count: 7, colors: ["var(--success)", "var(--accent)"], durationMs: 600, spread: 90, sizePx: [5, 9] },
  },
  gresit: {
    targetClasses: ["fx-host", "fx-shake", "fx-flash-danger"],
    colorOnlyClasses: ["fx-flash-danger"],
    durationMs: 500,
  },
  indiciu: {
    targetClasses: ["fx-pulse-amber"],
    colorOnlyClasses: ["fx-pulse-amber"],
    durationMs: 1700,
  },
  "lectie-completa": {
    targetClasses: [],
    colorOnlyClasses: [],
    durationMs: 1200,
    particles: { count: 20, colors: BRAND_COLORS, durationMs: 1200, spread: 320, sizePx: [6, 12], fullscreen: true },
    windowEvent: BACKDROP_BOOST_EVENT,
  },
  streak: {
    targetClasses: ["fx-host", "fx-streak-pop"],
    colorOnlyClasses: [],
    durationMs: 900,
    particles: { count: 3, colors: ["var(--orb-3)", "var(--hint-amber)"], durationMs: 650, spread: 55, sizePx: [4, 7] },
  },
  "concept-stapanit": {
    targetClasses: ["fx-host"],
    colorOnlyClasses: ["fx-glow-success"],
    durationMs: 1000,
    ring: { borderColor: "var(--primary)" },
    particles: { count: 10, colors: BRAND_COLORS, durationMs: 900, spread: 130, sizePx: [5, 9] },
  },
};

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function spawnParticles(spec: ParticleSpec, target: HTMLElement | null) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  if (spec.fullscreen) {
    host.style.cssText = "position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden;";
    document.body.appendChild(host);
  } else {
    if (!target) return;
    host.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:visible;";
    target.appendChild(host);
  }
  const w = spec.fullscreen ? window.innerWidth : host.clientWidth;
  const h = spec.fullscreen ? window.innerHeight : host.clientHeight;
  for (let i = 0; i < spec.count; i++) {
    const p = document.createElement("div");
    p.className = "fx-spark";
    const angle = (Math.PI * 2 * i) / spec.count + Math.random() * 0.8;
    const dist = spec.spread * (0.55 + Math.random() * 0.45);
    const size = spec.sizePx[0] + Math.random() * (spec.sizePx[1] - spec.sizePx[0]);
    p.style.left = `${w / 2}px`;
    p.style.top = `${h / 2}px`;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.background = spec.colors[i % spec.colors.length];
    p.style.setProperty("--fx-dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--fx-dy", `${Math.sin(angle) * dist}px`);
    p.style.setProperty("--fx-dur", `${spec.durationMs}ms`);
    host.appendChild(p);
  }
  window.setTimeout(() => host.remove(), spec.durationMs + 100);
}

/**
 * Redă feedback-ul vizual al unui eveniment pe elementul-țintă.
 * Sigur de chemat oricând pe client; no-op pe server.
 */
export function playFeedback(event: FeedbackEvent, target?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  const spec = FEEDBACK[event];
  const reduced = reducedMotion();
  const classes = reduced ? spec.colorOnlyClasses : spec.targetClasses;

  if (target && classes.length > 0) {
    // re-trigger curat dacă animația rulează deja
    target.classList.remove(...classes);
    void target.offsetWidth; // reflow → animația repornește
    target.classList.add(...classes);
    window.setTimeout(() => target.classList.remove(...classes.filter((c) => c !== "fx-host")), spec.durationMs);
  }

  if (!reduced && spec.ring && target) {
    const ring = document.createElement("div");
    ring.className = "fx-ring";
    ring.style.borderColor = spec.ring.borderColor;
    target.appendChild(ring);
    window.setTimeout(() => ring.remove(), 700);
  }

  if (!reduced && spec.particles) spawnParticles(spec.particles, target ?? null);

  if (spec.windowEvent) window.dispatchEvent(new CustomEvent(spec.windowEvent));
}
