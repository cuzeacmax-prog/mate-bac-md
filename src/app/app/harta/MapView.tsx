"use client";

/**
 * MapView — ETAPA 71 B → 72 P1 → 74 A3 → ETAPA 76: CERUL SKYRIM.
 *
 * Referința aprobată: ecranul de skill-uri din Skyrim (constelații pe nebuloasă).
 *  - A1: cer = nebuloasă în culoarea domeniului (cross-fade la comutare) +
 *    zgomot subtil + câmp de stele cu twinkle desincronizat — HTML static sub
 *    SVG, DOAR transform/opacity;
 *  - A2: nodurile = stele (halo + raze de difracție la stăpânite; mărimi pe
 *    importanță — 3 trepte după exercițiile servibile);
 *  - A3: sigiliul domeniului (glifa matematică) watermark în spate;
 *  - A4: tranziția între domenii = pan lin (tween rAF) + cross-fade nebuloasă;
 *  - B: DRUMUL recomandat (quest): muchiile lanțului luminoase cu flux animat,
 *    restul stinse; nodul „Următorul" = cea mai strălucitoare stea; pan automat
 *    blând la deschidere (o dată);
 *  - C: selector de clasă (pills 9-12; dezactivat onest unde nu există noduri)
 *    + portaluri cross-grade pe prerechizitele din altă clasă, cu breadcrumb.
 *
 * PERF (SACRU, ETAPA 72): pan/zoom = transform pe UN <g> prin rAF, ZERO
 * setState la mișcare; graful memoizat; cerul e static (nu se re-randează).
 */
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MathText } from "@/components/MathText";
import { MILESTONE_LABELS } from "@/lib/map/milestones";
import type { KnowledgeMap, MapDomain, MapGradeSlice, MapNode } from "@/lib/map/state";

type Lens = "bac" | "tinta" | "test";

const MAX_PULSE = 15;
const ALL_GRADES = [9, 10, 11, 12];

/** A3: sigiliul domeniului — glifa matematică (watermark) */
const DOMAIN_SEALS: Record<string, string> = {
  i: "∫", // primitive și integrale nedefinite
  ii: "∬", // integrala definită și arii
  iii: "Σ", // combinatorică și binom
  iv: "%", // probabilități și statistică
  v: "△", // poliedre
  vi: "◯", // corpuri de rotație
  viii: "xⁿ", // polinoame
};

/** A2: mărimea stelei pe importanță (exerciții servibile) — 3 trepte */
function starRadius(servable: number): number {
  if (servable >= 4) return 34;
  if (servable >= 1) return 28;
  return 22;
}

/** stele deterministe (fără random la render — zero hydration mismatch) */
function starField(seed: number, count: number): Array<{ x: number; y: number; r: number; o: number; tw: number }> {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    r: rand() < 0.25 ? 1.6 : 1,
    o: 0.25 + rand() * 0.55,
    tw: rand() < 0.18 ? 2 + rand() * 4 : 0, // ~18% clipesc, durate desincronizate
  }));
}
const STARS = starField(76, 110);

export function MapView({ map, tinta }: { map: KnowledgeMap; tinta?: string | null }) {
  const router = useRouter();
  const [domainKey, setDomainKey] = useState(() => {
    if (tinta) {
      for (const d of map.domains) {
        for (const g of Object.values(d.grades)) {
          if (g.nodes.some((n) => n.slug === tinta)) return d.key;
        }
      }
    }
    return map.domains[0]?.key ?? "i";
  });
  const domain = map.domains.find((d) => d.key === domainKey) ?? map.domains[0];

  // C1: clasa activă — default clasa elevului, altfel cea mai mare disponibilă
  const gradesAvailable = useMemo(
    () => Object.keys(domain?.grades ?? {}).map(Number).sort((a, b) => a - b),
    [domain]
  );
  const [gradeKey, setGradeKey] = useState<number>(() => {
    if (tinta) {
      for (const d of map.domains) {
        for (const [g, slice] of Object.entries(d.grades)) {
          if (slice.nodes.some((n) => n.slug === tinta)) return Number(g);
        }
      }
    }
    return map.studentGrade;
  });
  const effectiveGrade = gradesAvailable.includes(gradeKey)
    ? gradeKey
    : gradesAvailable[gradesAvailable.length - 1];
  const slice: MapGradeSlice | undefined = domain?.grades[String(effectiveGrade)];

  const [lens, setLens] = useState<Lens>("bac");
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [focusPending, setFocusPending] = useState(false);
  // C2: breadcrumb-ul de întoarcere după un salt prin portal
  const [crumb, setCrumb] = useState<{ domain: typeof domainKey; grade: number; label: string } | null>(null);

  // ── lentilele: opacitatea per nod ─────────────────────────────────────────
  const nodeOpacity = useCallback(
    (n: MapNode): number => {
      if (lens === "bac") return n.servable > 0 ? 1 : 0.4;
      if (lens === "tinta" && map.targetGrade != null) {
        const t = map.targetGrade;
        const over =
          (t < 7 && n.milestone !== "baza") ||
          (t < 9 && n.milestone === "performanta");
        return over ? 0.35 : 1;
      }
      if (lens === "test" && map.focus) {
        return map.focus.concept_ids.includes(n.id) ? 1 : 0.3;
      }
      return 1;
    },
    [lens, map.targetGrade, map.focus]
  );

  // ── pan/zoom — ETAPA 72 P1a: transform pe <g> prin rAF, FĂRĂ setState ─────
  const viewRef = useRef({ tx: 20, ty: 20, scale: 0.8 });
  const gRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const applyTransform = useCallback(() => {
    rafRef.current = 0;
    const v = viewRef.current;
    gRef.current?.setAttribute("transform", `translate(${v.tx},${v.ty}) scale(${v.scale})`);
  }, []);
  const scheduleTransform = useCallback(() => {
    if (rafRef.current === 0) rafRef.current = requestAnimationFrame(applyTransform);
  }, [applyTransform]);

  // A4/B3/F1: pan LIN spre o țintă (tween rAF ~700ms; reduced-motion → salt)
  const tweenRef = useRef(0);
  const panTo = useCallback(
    (tx: number, ty: number, scale: number) => {
      cancelAnimationFrame(tweenRef.current);
      const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        viewRef.current = { tx, ty, scale };
        scheduleTransform();
        return;
      }
      const from = { ...viewRef.current };
      const t0 = performance.now();
      const DUR = 700;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const step = (now: number) => {
        const t = Math.min((now - t0) / DUR, 1);
        const k = ease(t);
        viewRef.current = {
          tx: from.tx + (tx - from.tx) * k,
          ty: from.ty + (ty - from.ty) * k,
          scale: from.scale + (scale - from.scale) * k,
        };
        applyTransform();
        if (t < 1) tweenRef.current = requestAnimationFrame(step);
      };
      tweenRef.current = requestAnimationFrame(step);
    },
    [applyTransform, scheduleTransform]
  );
  const panToNode = useCallback(
    (node: { x: number; y: number }, scale = 0.95) => {
      const box = containerRef.current?.getBoundingClientRect();
      const w = box?.width ?? 800;
      const h = box?.height ?? 600;
      panTo(w / 2 - node.x * scale, h / 2 - node.y * scale, scale);
    },
    [panTo]
  );
  // vederea care ÎNCADREAZĂ constelația (defect runda 1: vederea fixă 20,20
  // nimerea zona goală a layout-ului BT — constelația era în afara cadrului)
  const fitView = useCallback(
    (animated: boolean) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box || !slice) return;
      // clamp jos (defect runda 2): constelațiile înalte deveneau puncte —
      // sub 0.45 stelele nu se mai citesc; restul se explorează prin pan
      const scale = Math.max(
        Math.min(box.width / (slice.width + 100), box.height / (slice.height + 100), 1.1),
        0.45
      );
      const tx = (box.width - slice.width * scale) / 2;
      const ty = (box.height - slice.height * scale) / 2;
      if (animated) {
        panTo(tx, ty, scale);
      } else {
        viewRef.current = { tx, ty, scale };
        scheduleTransform();
      }
    },
    [slice, panTo, scheduleTransform]
  );

  useEffect(() => {
    applyTransform();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(tweenRef.current);
    };
  }, [applyTransform]);

  // A4: la schimbarea domeniului/clasei — pan LIN spre vederea care încadrează
  const firstViewRef = useRef(true);
  useEffect(() => {
    if (firstViewRef.current) return; // prima montare e gestionată de B3/F1
    fitView(true);
  }, [domainKey, effectiveGrade, fitView]);

  // B3 + F1: la deschidere — pan automat blând spre ținta lecției sau spre
  // nodul recomandat (O dată, apoi utilizatorul e liber)
  const questInSlice = useMemo(
    () => map.quest.map((q) => slice?.nodes.find((n) => n.id === q.id) ?? null),
    [map.quest, slice]
  );
  useEffect(() => {
    if (!firstViewRef.current) return;
    firstViewRef.current = false;
    fitView(false); // întâi încadrăm constelația
    const tintaNode = tinta ? slice?.nodes.find((n) => n.slug === tinta) : null;
    const target =
      tintaNode ??
      questInSlice[map.quest.findIndex((q) => q.kind === "recomandat")] ??
      null;
    if (target) {
      const t = setTimeout(() => {
        panToNode(target);
        // F1: venit din lecție — selectăm nodul (unda radială pe stăpânit
        // vine din selectare; apoi drumul rămâne aprins spre următorul)
        if (tintaNode) setSelected(tintaNode);
      }, 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(tweenRef.current);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    viewRef.current.tx = dragRef.current.tx + e.clientX - dragRef.current.x;
    viewRef.current.ty = dragRef.current.ty + e.clientY - dragRef.current.y;
    scheduleTransform();
  };
  const onPointerUp = () => { dragRef.current = null; };
  const zoom = (f: number) => {
    viewRef.current.scale = Math.min(2.5, Math.max(0.25, viewRef.current.scale * f));
    scheduleTransform();
  };
  const onWheel = (e: React.WheelEvent) => zoom(e.deltaY < 0 ? 1.12 : 0.89);

  // ── focus „test mâine" ────────────────────────────────────────────────────
  const setTestFocus = useCallback(async () => {
    if (!domain || !slice || focusPending) return;
    setFocusPending(true);
    try {
      const resp = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept_ids: slice.nodes.map((n) => n.id),
          label: domain.label,
          hours: 36,
        }),
      });
      if (resp.ok) router.refresh();
    } finally {
      setFocusPending(false);
    }
  }, [domain, slice, focusPending, router]);
  const clearFocus = useCallback(async () => {
    if (focusPending) return;
    setFocusPending(true);
    try {
      const resp = await fetch("/api/focus", { method: "DELETE" });
      if (resp.ok) router.refresh();
    } finally {
      setFocusPending(false);
    }
  }, [focusPending, router]);

  // C2: saltul prin portal spre un prerechizit din altă clasă/domeniu
  const jumpToPrereq = useCallback(
    (p: { slug: string; domain: string | null; grade: number | null }) => {
      if (!p.domain || !p.grade) return;
      setCrumb({ domain: domainKey, grade: effectiveGrade, label: `înapoi la clasa ${effectiveGrade}` });
      setSelected(null);
      setDomainKey(p.domain as typeof domainKey);
      setGradeKey(p.grade);
      // pan după ce noul slice e montat
      setTimeout(() => {
        const d = map.domains.find((x) => x.key === p.domain);
        const n = d?.grades[String(p.grade)]?.nodes.find((x) => x.slug === p.slug);
        if (n) {
          panToNode(n);
          setSelected(n);
        }
      }, 80);
    },
    [domainKey, effectiveGrade, map.domains, panToNode]
  );

  if (!domain || !slice) return null;

  const recommendedId = map.quest.find((q) => q.kind === "recomandat")?.id ?? null;

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
      {/* lentilele + selectorul de clasă (C1) */}
      <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 shrink-0">
        <h1 className="text-lg font-bold mr-2">Harta cunoașterii</h1>
        <LensChip active={lens === "bac"} onClick={() => setLens("bac")}>BAC</LensChip>
        <LensChip active={lens === "tinta"} onClick={() => setLens("tinta")} disabled={map.targetGrade == null}>
          Nota-țintă{map.targetGrade != null ? ` ${map.targetGrade}` : ""}
        </LensChip>
        <LensChip active={lens === "test"} onClick={() => setLens("test")}>Test mâine</LensChip>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {ALL_GRADES.map((g) => (
          <button
            key={g}
            onClick={() => { setGradeKey(g); setSelected(null); }}
            disabled={!gradesAvailable.includes(g)}
            title={gradesAvailable.includes(g) ? `Clasa ${g}` : `Clasa ${g}: fără concepte în graf pe acest domeniu`}
            className={`rounded-full w-9 h-9 text-xs font-bold transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${
              g === effectiveGrade ? "bg-primary text-primary-foreground" : "glass-1 text-muted-foreground hover:text-foreground"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* bannerul de focus activ */}
      {map.focus && (
        <div className="mx-4 mb-2 rounded-xl bg-secondary text-secondary-foreground px-3 py-2 text-xs flex items-center justify-between gap-2 shrink-0">
          <span>
            🎯 Focus: <strong>{map.focus.label ?? "subiecte alese"}</strong> până{" "}
            {new Date(map.focus.expires_at).toLocaleDateString("ro-MD", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <button onClick={clearFocus} disabled={focusPending} className="underline underline-offset-2 shrink-0">
            anulează
          </button>
        </div>
      )}
      {lens === "test" && !map.focus && (
        <div className="mx-4 mb-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs flex items-center justify-between gap-2 shrink-0">
          <span>Ai test la <strong>{domain.label}</strong>? Pune focus 36h — harta, Azi și provocarea zilei se filtrează.</span>
          <button onClick={setTestFocus} disabled={focusPending} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 font-medium shrink-0">
            Pune focus
          </button>
        </div>
      )}

      {/* tab-urile domeniilor, colorate, cu progres */}
      <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto shrink-0">
        {map.domains.map((d) => {
          const slices = Object.values(d.grades);
          const total = slices.reduce((a, g) => a + g.nodes.length, 0);
          const done = slices.reduce((a, g) => a + g.counts.stapanit, 0);
          return (
            <button
              key={d.key}
              onClick={() => { setDomainKey(d.key); setSelected(null); }}
              className="shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold border-2 transition-colors"
              style={
                d.key === domainKey
                  ? { background: `var(--domain-${d.key})`, borderColor: `var(--domain-${d.key})`, color: "var(--primary-foreground)" }
                  : { background: `var(--domain-${d.key}-bg)`, borderColor: "transparent", color: `var(--domain-${d.key}-fg)` }
              }
            >
              {d.label}
              <span className="block opacity-90 font-normal">{done}/{total}</span>
            </button>
          );
        })}
      </div>

      {/* CERUL + constelația */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 mx-4 mb-4 rounded-2xl overflow-hidden relative touch-none border border-[rgba(255,255,255,0.08)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {/* A1+A3: cerul — nebuloasă cross-fade + zgomot + stele + sigiliu */}
        <SkyBackdrop domainKey={domainKey} />

        <svg className="w-full h-full relative" role="img" aria-label={`Harta conceptelor: ${domain.label}, clasa ${effectiveGrade}`}>
          <g ref={gRef}>
            <DomainGraph
              domainKey={domain.key}
              slice={slice}
              nodeOpacity={nodeOpacity}
              selectedId={selected?.id ?? null}
              recommendedId={recommendedId}
              questIds={map.quest.map((q) => q.id)}
              onSelect={setSelected}
            />
          </g>
        </svg>

        {/* C2: breadcrumb-ul de întoarcere după portal */}
        {crumb && (
          <button
            onClick={() => {
              setDomainKey(crumb.domain);
              setGradeKey(crumb.grade);
              setCrumb(null);
              setSelected(null);
            }}
            className="absolute top-3 right-3 rounded-full glass-2 px-3.5 py-2 text-xs font-semibold"
          >
            ← {crumb.label}
          </button>
        )}

        {/* zoom */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button onClick={() => zoom(1.25)} className="w-9 h-9 rounded-xl glass-2 font-bold">+</button>
          <button onClick={() => zoom(0.8)} className="w-9 h-9 rounded-xl glass-2 font-bold">−</button>
        </div>
        {/* legenda */}
        <div className="absolute top-3 left-3 rounded-xl bg-background/85 backdrop-blur px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
          <p>🔒 blocat · halo pulsând = disponibil · drum luminos = traseul tău</p>
          <p>% = în lucru · stea plină cu raze = stăpânit</p>
        </div>
      </div>

      {/* sheet-ul nodului */}
      <AnimatePresence>
        {selected && (
          <NodeSheet
            node={selected}
            domain={domain}
            slice={slice}
            currentGrade={effectiveGrade}
            onJumpToPrereq={jumpToPrereq}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** A1+A3: cerul — straturi statice (nu se re-randează la pan), cross-fade la domeniu */
const SkyBackdrop = memo(function SkyBackdrop({ domainKey }: { domainKey: string }) {
  // „derived state from props" (pattern-ul sancționat React): la schimbarea
  // domeniului păstrăm stratul vechi pentru cross-fade — setState ÎN render,
  // nu în effect (zero cascade)
  const [layers, setLayers] = useState<[string, string | null]>([domainKey, null]);
  if (layers[0] !== domainKey) setLayers([domainKey, layers[0]]);
  const [current, previous] = layers;
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      {/* nebuloasa anterioară se stinge sub cea nouă (cross-fade CSS) */}
      {previous && <div key={`prev-${previous}`} className="sky-nebula sky-nebula-out" style={nebulaStyle(previous)} />}
      <div key={`cur-${current}`} className="sky-nebula sky-nebula-in" style={nebulaStyle(current)} />
      {/* zgomotul subtil (4-6%) */}
      <div className="absolute inset-0 sky-noise" />
      {/* câmpul de stele (twinkle CSS lent desincronizat) */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r * 0.12}
            fill="white"
            opacity={s.o}
            className={s.tw ? "star-twinkle" : undefined}
            style={s.tw ? { animationDuration: `${s.tw}s`, animationDelay: `${(i % 7) * 0.6}s` } : undefined}
          />
        ))}
      </svg>
      {/* A3: sigiliul domeniului — watermark 30-40vh în culoarea domeniului */}
      {previous && (
        <span key={`seal-prev-${previous}`} className="sky-seal sky-seal-out" style={{ color: `var(--domain-${previous})` }}>
          {DOMAIN_SEALS[previous] ?? "∫"}
        </span>
      )}
      <span key={`seal-${current}`} className="sky-seal sky-seal-in" style={{ color: `var(--domain-${current})` }}>
        {DOMAIN_SEALS[current] ?? "∫"}
      </span>
    </div>
  );
});

function nebulaStyle(key: string): React.CSSProperties {
  return {
    background: [
      `radial-gradient(55% 65% at 28% 30%, color-mix(in oklab, var(--domain-${key}) 26%, transparent), transparent 75%)`,
      `radial-gradient(50% 60% at 74% 68%, color-mix(in oklab, var(--domain-${key}) 16%, transparent), transparent 75%)`,
      `radial-gradient(80% 90% at 50% 110%, oklch(0.12 0.03 270 / 0.9), transparent 70%)`,
      `oklch(0.11 0.02 265)`,
    ].join(","),
  };
}

function LensChip({ children, active, onClick, disabled }: {
  children: React.ReactNode; active: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors disabled:opacity-40 ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
      }`}
    >
      {children}
    </button>
  );
}

/** graful unei felii domeniu×clasă, memoizat — niciodată re-randat la pan/zoom */
const DomainGraph = memo(function DomainGraph({ domainKey, slice, nodeOpacity, selectedId, recommendedId, questIds, onSelect }: {
  domainKey: string;
  slice: MapGradeSlice;
  nodeOpacity: (n: MapNode) => number;
  selectedId: string | null;
  recommendedId: string | null;
  questIds: string[];
  onSelect: (n: MapNode) => void;
}) {
  const byId = new Map(slice.nodes.map((n) => [n.id, n]));
  const pulseIds = new Set(
    slice.nodes.filter((n) => n.status === "disponibil").slice(0, MAX_PULSE).map((n) => n.id)
  );
  const color = `var(--domain-${domainKey})`;
  const xs = slice.nodes.map((n) => n.x);
  const ys = slice.nodes.map((n) => n.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const washR = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.75 + 160;

  // B1: lanțul de quest PREZENT în felie — segmentele consecutive
  const questNodes = questIds.map((id) => byId.get(id)).filter((n): n is MapNode => !!n);
  const questSet = new Set(questNodes.map((n) => n.id));

  return (
    <>
      <defs>
        <radialGradient id={`node-full-${domainKey}`}>
          <stop offset="0%" stopColor={`var(--domain-${domainKey}-fg)`} />
          <stop offset="45%" stopColor={color} />
          <stop offset="100%" stopColor={color} />
        </radialGradient>
        <radialGradient id={`node-soft-${domainKey}`}>
          <stop offset="0%" stopColor={`var(--domain-${domainKey}-bg)`} stopOpacity={1} />
          <stop offset="78%" stopColor={`var(--domain-${domainKey}-bg)`} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.55} />
        </radialGradient>
        <radialGradient id={`halo-${domainKey}`}>
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="55%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`wash-${domainKey}`}>
          <stop offset="0%" stopColor={color} stopOpacity={0.08} />
          <stop offset="70%" stopColor={color} stopOpacity={0.05} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={washR} fill={`url(#wash-${domainKey})`} pointerEvents="none" />

      {/* muchiile normale — STINSE (drumul e vedeta) */}
      {slice.edges.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        return (
          <line
            key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={0.15}
          />
        );
      })}

      {/* B1: DRUMUL — segmente luminoase cu flux animat în direcția înaintării */}
      {questNodes.slice(0, -1).map((a, i) => {
        const b = questNodes[i + 1];
        return (
          <line
            key={`quest-${i}`}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            className="quest-edge"
            stroke={color}
            pointerEvents="none"
          />
        );
      })}

      {slice.nodes.map((n) => (
        <StarNode
          key={n.id}
          node={n}
          domainKey={domainKey}
          opacity={nodeOpacity(n)}
          selected={selectedId === n.id}
          pulse={pulseIds.has(n.id)}
          recommended={recommendedId === n.id}
          onQuest={questSet.has(n.id)}
          onSelect={onSelect}
        />
      ))}
    </>
  );
});

/** A2: nodul = STEA — halo, raze de difracție la stăpânite, mărime pe importanță */
const StarNode = memo(function StarNode({ node, domainKey, opacity, selected, pulse, recommended, onQuest, onSelect }: {
  node: MapNode; domainKey: string; opacity: number; selected: boolean; pulse: boolean;
  recommended: boolean; onQuest: boolean; onSelect: (n: MapNode) => void;
}) {
  const color = `var(--domain-${domainKey})`;
  const R = starRadius(node.servable);
  const label = node.name.length > 24 ? `${node.name.slice(0, 23)}…` : node.name;
  const pillW = label.length * 6.6 + 16;
  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      opacity={node.status === "blocat" ? Math.min(opacity, 0.45) : opacity}
      onClick={() => onSelect(node)}
      onPointerDown={(e) => e.stopPropagation()}
      className="cursor-pointer"
    >
      {/* haloul — steaua luminează; recomandatul e cea mai strălucitoare */}
      {node.status !== "blocat" && (
        <circle
          r={R * (recommended ? 2.6 : 1.9)}
          fill={`url(#halo-${domainKey})`}
          className={recommended ? "map-pulse" : node.status === "disponibil" && pulse ? "map-pulse" : undefined}
          opacity={recommended ? 1 : node.status === "stapanit" ? 1 : node.status === "disponibil" ? 0.9 : 0.7}
          pointerEvents="none"
        />
      )}
      {/* A2: razele de difracție pe stelele stăpânite (4 raze) */}
      {node.status === "stapanit" && (
        <g pointerEvents="none" stroke="white" strokeOpacity={0.4} strokeWidth={1} strokeLinecap="round">
          <line x1={-R * 1.9} y1={0} x2={R * 1.9} y2={0} />
          <line x1={0} y1={-R * 1.9} x2={0} y2={R * 1.9} />
        </g>
      )}
      {/* unda radială la selectarea unei stele stăpânite (registrul 74) */}
      {selected && node.status === "stapanit" && (
        <circle r={R} fill="none" stroke={color} strokeWidth={2.5} className="fx-node-wave" />
      )}
      <circle
        r={R}
        fill={
          node.status === "stapanit"
            ? `url(#node-full-${domainKey})`
            : node.status === "blocat"
              ? "var(--card)"
              : `url(#node-soft-${domainKey})`
        }
        stroke={selected ? "var(--ring)" : color}
        strokeWidth={selected ? 3.5 : node.status === "blocat" ? 1 : 2}
        strokeDasharray={node.status === "blocat" ? "4 4" : undefined}
        strokeOpacity={node.status === "blocat" ? 0.6 : 1}
      />
      {node.status === "stapanit" && (
        <text textAnchor="middle" dy={7} fontSize={Math.round(R * 0.66)} fontWeight={700} fill="var(--primary-foreground)" stroke="none">✓</text>
      )}
      {node.status === "in-lucru" && (
        <text textAnchor="middle" dy={5} fontSize={13} fontWeight={700} fill={`var(--domain-${domainKey}-fg)`} stroke="none">
          {Math.round(node.mastery * 100)}%
        </text>
      )}
      {node.status === "blocat" && (
        <text textAnchor="middle" dy={4} fontSize={11} opacity={0.8} stroke="none">🔒</text>
      )}
      {/* B2: eticheta „Următorul" pe steaua recomandată */}
      {recommended && (
        <>
          <rect x={-44} y={-R - 30} width={88} height={20} rx={10} fill={color} stroke="none" pointerEvents="none" />
          <text textAnchor="middle" y={-R - 16} fontSize={11} fontWeight={700} fill="var(--primary-foreground)" stroke="none">
            ⭐ Următorul
          </text>
        </>
      )}
      {/* portal mic pe nodurile blocate cu prerechizit în ALTĂ clasă (C2) */}
      {node.status === "blocat" && node.prereqState.some((p) => !p.mastered && p.grade != null && p.grade !== node.grade) && (
        <text textAnchor="middle" y={-R - 8} fontSize={11} stroke="none" opacity={0.9}>🌀</text>
      )}
      <rect
        x={-pillW / 2}
        y={R + 7}
        width={pillW}
        height={18}
        rx={9}
        fill="var(--map-label-bg)"
        stroke="none"
        pointerEvents="none"
      />
      <text textAnchor="middle" y={R + 20} fontSize={12} fill="var(--map-label-fg)" stroke="none">
        {label}
        {onQuest && !recommended ? " ·" : ""}
      </text>
    </g>
  );
});

/** ETAPA 72 P1d: orice eroare pe hartă → mesaj prietenos + reload. */
export class MapErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[harta] eroare prinsă de boundary:", error.message);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="text-3xl">🗺️</p>
          <p className="font-semibold">Harta a întâmpinat o problemă.</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Nimic din progresul tău nu s-a pierdut — reîncarcă pagina și mergem mai departe.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium"
          >
            Reîncarcă harta
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** sheet-ul de jos (B3) + F2 mini-drum + C2 portaluri */
function NodeSheet({ node, domain, slice, currentGrade, onJumpToPrereq, onClose }: {
  node: MapNode;
  domain: MapDomain;
  slice: MapGradeSlice;
  currentGrade: number;
  onJumpToPrereq: (p: { slug: string; domain: string | null; grade: number | null }) => void;
  onClose: () => void;
}) {
  const mastered = node.prereqState.filter((p) => p.mastered);
  const missing = node.prereqState.filter((p) => !p.mastered);
  // F2: mini-drumul — ce deblochează acest nod (dependenții din felie)
  const unlocks = slice.nodes
    .filter((n) => n.prereqs.some((p) => p.id === node.id))
    .slice(0, 2);
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl border-t bg-background p-5 space-y-3 shadow-2xl max-w-2xl mx-auto"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold leading-snug"><MathText text={node.name} /></h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {node.milestone && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ background: `var(--domain-${domain.key}-bg)`, color: `var(--domain-${domain.key}-fg)` }}
              >
                {MILESTONE_LABELS[node.milestone]}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {node.servable > 0 ? `${node.servable} exerciții servibile la BAC` : "fără exerciții servibile încă"}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="text-sm text-muted-foreground shrink-0">închide ✕</button>
      </div>

      {node.status === "blocat" && missing.length > 0 ? (
        <div className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm space-y-1.5">
          <p className="font-medium">Cere întâi:</p>
          {missing.slice(0, 4).map((p) =>
            p.grade != null && p.grade !== currentGrade && p.domain ? (
              // C2: PORTAL cross-grade — comută clasa + pan direct pe nod
              <button
                key={p.slug}
                onClick={() => onJumpToPrereq(p)}
                className="block w-full text-left rounded-lg glass-1 px-2.5 py-1.5 text-primary"
              >
                🌀 cere: <MathText text={p.name} /> · clasa {p.grade} →
              </button>
            ) : (
              <Link
                key={p.slug}
                href={`/app/chat?concept=${encodeURIComponent(p.slug)}`}
                className="block text-primary underline underline-offset-2"
              >
                <MathText text={p.name} /> →
              </Link>
            )
          )}
        </div>
      ) : mastered.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Deblocat de: {mastered.slice(0, 4).map((p) => p.name).join(" ✓, ")} ✓
        </p>
      ) : node.prereqState.length === 0 ? (
        <p className="text-sm text-muted-foreground">Fără prerechizite — punct de pornire.</p>
      ) : null}

      {/* F2: mini-drumul — „deblochează →" */}
      {unlocks.length > 0 && (
        <p className="text-xs text-muted-foreground">
          deblochează → {unlocks.map((u) => u.name).join(" · ")}
        </p>
      )}

      {node.status !== "blocat" && (
        <Link
          href={`/app/chat?concept=${encodeURIComponent(node.slug)}`}
          className="block w-full text-center rounded-xl bg-primary text-primary-foreground py-3 font-semibold"
        >
          Învață →
        </Link>
      )}
    </motion.div>
  );
}
