"use client";

/**
 * MapView — ETAPA 71 FAZA B + ETAPA 72 P1: randarea hărții cunoașterii.
 *
 * ETAPA 72 (cauza crash-ului de tab, dovedită): versiunea inițială făcea
 * setState per pointermove/wheel → re-render COMPLET al SVG-ului (139 noduri,
 * ~700 elemente) la fiecare pixel de pan. Acum:
 *  a) pan/zoom = transform pe UN <g> rădăcină, scris prin requestAnimationFrame
 *     direct pe atribut (ref) — ZERO setState la mișcare;
 *  b) pulsul: CSS pur, DOAR pe primele 15 noduri disponibile;
 *  c) graful e memoizat (React.memo) — nodurile nu se re-randează la pan;
 *  d) error boundary pe pagină — orice eroare → mesaj prietenos, nu ecran negru.
 */
import { Component, memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MathText } from "@/components/MathText";
import { MILESTONE_LABELS } from "@/lib/map/milestones";
import type { KnowledgeMap, MapDomain, MapNode } from "@/lib/map/state";

type Lens = "bac" | "tinta" | "test";

const NODE_R = 26;
const MAX_PULSE = 15;

export function MapView({ map }: { map: KnowledgeMap }) {
  const router = useRouter();
  const [domainKey, setDomainKey] = useState(map.domains[0]?.key ?? "i");
  const [lens, setLens] = useState<Lens>("bac");
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [focusPending, setFocusPending] = useState(false);

  const domain = map.domains.find((d) => d.key === domainKey) ?? map.domains[0];

  // ── lentilele: opacitatea per nod ─────────────────────────────────────────
  const nodeOpacity = useCallback(
    (n: MapNode): number => {
      if (lens === "bac") return n.servable > 0 ? 1 : 0.4;
      if (lens === "tinta" && map.targetGrade != null) {
        // bornele peste țintă se estompează: <7 → doar baza; <9 → baza+solid
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
  const rafRef = useRef(0);
  const applyTransform = useCallback(() => {
    rafRef.current = 0;
    const v = viewRef.current;
    gRef.current?.setAttribute("transform", `translate(${v.tx},${v.ty}) scale(${v.scale})`);
  }, []);
  const scheduleTransform = useCallback(() => {
    if (rafRef.current === 0) rafRef.current = requestAnimationFrame(applyTransform);
  }, [applyTransform]);
  useEffect(() => {
    applyTransform(); // poziția inițială + la schimbarea domeniului
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [applyTransform, domainKey]);

  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
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
    if (!domain || focusPending) return;
    setFocusPending(true);
    try {
      const resp = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept_ids: domain.nodes.map((n) => n.id),
          label: domain.label,
          hours: 36,
        }),
      });
      if (resp.ok) router.refresh();
    } finally {
      setFocusPending(false);
    }
  }, [domain, focusPending, router]);
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

  if (!domain) return null;

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
      {/* lentilele */}
      <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 shrink-0">
        <h1 className="text-lg font-bold mr-2">Harta cunoașterii</h1>
        <LensChip active={lens === "bac"} onClick={() => setLens("bac")}>BAC</LensChip>
        <LensChip active={lens === "tinta"} onClick={() => setLens("tinta")} disabled={map.targetGrade == null}>
          Nota-țintă{map.targetGrade != null ? ` ${map.targetGrade}` : ""}
        </LensChip>
        <LensChip active={lens === "test"} onClick={() => setLens("test")}>Test mâine</LensChip>
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
        {map.domains.map((d) => (
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
            <span className="block opacity-90 font-normal">
              {d.counts.stapanit}/{d.nodes.length}
            </span>
          </button>
        ))}
      </div>

      {/* harta SVG */}
      <div
        className="flex-1 min-h-0 mx-4 mb-4 rounded-2xl border bg-card overflow-hidden relative touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <svg className="w-full h-full" role="img" aria-label={`Harta conceptelor: ${domain.label}`}>
          {/* ETAPA 72 P1c: graful e memoizat — pan-ul nu îl re-randează */}
          <g ref={gRef}>
            <DomainGraph
              domain={domain}
              nodeOpacity={nodeOpacity}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </g>
        </svg>
        {/* zoom */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button onClick={() => zoom(1.25)} className="w-9 h-9 rounded-xl border bg-background font-bold">+</button>
          <button onClick={() => zoom(0.8)} className="w-9 h-9 rounded-xl border bg-background font-bold">−</button>
        </div>
        {/* legenda */}
        <div className="absolute top-3 left-3 rounded-xl bg-background/85 backdrop-blur px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
          <p>🔒 blocat · inel pulsând = disponibil</p>
          <p>% = în lucru · plin ✓ = stăpânit</p>
        </div>
      </div>

      {/* sheet-ul nodului */}
      <AnimatePresence>
        {selected && (
          <NodeSheet
            node={selected}
            domain={domain}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
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

/** ETAPA 72 P1c: graful unui domeniu, memoizat — se re-randează DOAR la
 *  schimbarea domeniului/lentilei/selecției, niciodată la pan/zoom. */
const DomainGraph = memo(function DomainGraph({ domain, nodeOpacity, selectedId, onSelect }: {
  domain: MapDomain;
  nodeOpacity: (n: MapNode) => number;
  selectedId: string | null;
  onSelect: (n: MapNode) => void;
}) {
  const byId = new Map(domain.nodes.map((n) => [n.id, n]));
  // P1b: pulsul DOAR pe primele MAX_PULSE noduri disponibile
  const pulseIds = new Set(
    domain.nodes.filter((n) => n.status === "disponibil").slice(0, MAX_PULSE).map((n) => n.id)
  );
  return (
    <>
      {/* muchiile (prerechizit → dependent) */}
      {domain.edges.map((e, i) => {
        const a = byId.get(e.to);
        const b = byId.get(e.from);
        if (!a || !b) return null;
        return (
          <line
            key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="currentColor" strokeWidth={1.2} opacity={0.16}
          />
        );
      })}
      {domain.nodes.map((n) => (
        <MapNodeCircle
          key={n.id}
          node={n}
          domainKey={domain.key}
          opacity={nodeOpacity(n)}
          selected={selectedId === n.id}
          pulse={pulseIds.has(n.id)}
          onSelect={onSelect}
        />
      ))}
    </>
  );
});

/** nodul-cerc cu cele 4 stări (B2), memoizat per nod (P1c) */
const MapNodeCircle = memo(function MapNodeCircle({ node, domainKey, opacity, selected, pulse, onSelect }: {
  node: MapNode; domainKey: string; opacity: number; selected: boolean; pulse: boolean; onSelect: (n: MapNode) => void;
}) {
  const color = `var(--domain-${domainKey})`;
  const bg = `var(--domain-${domainKey}-bg)`;
  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      opacity={node.status === "blocat" ? Math.min(opacity, 0.45) : opacity}
      onClick={() => onSelect(node)}
      onPointerDown={(e) => e.stopPropagation()}
      className="cursor-pointer"
    >
      {node.status === "disponibil" && (
        <circle
          r={NODE_R + 6}
          fill="none"
          stroke={color}
          strokeWidth={2}
          className={pulse ? "map-pulse" : undefined}
          opacity={pulse ? undefined : 0.7}
        />
      )}
      <circle
        r={NODE_R}
        fill={node.status === "stapanit" ? color : node.status === "in-lucru" ? bg : "var(--card)"}
        stroke={selected ? "var(--ring)" : color}
        strokeWidth={selected ? 3.5 : node.status === "blocat" ? 1 : 2}
        strokeDasharray={node.status === "blocat" ? "4 4" : undefined}
      />
      {node.status === "stapanit" && (
        <text textAnchor="middle" dy={6} fontSize={18} fill="var(--primary-foreground)" stroke="none">✓</text>
      )}
      {node.status === "in-lucru" && (
        <text textAnchor="middle" dy={5} fontSize={13} fontWeight={700} fill={`var(--domain-${domainKey}-fg)`} stroke="none">
          {Math.round(node.mastery * 100)}%
        </text>
      )}
      {node.status === "blocat" && (
        <text textAnchor="middle" dy={5} fontSize={14} stroke="none">🔒</text>
      )}
      <text
        textAnchor="middle"
        y={NODE_R + 16}
        fontSize={11}
        fill="var(--foreground)"
        stroke="none"
      >
        {node.name.length > 24 ? `${node.name.slice(0, 23)}…` : node.name}
      </text>
    </g>
  );
});

/** ETAPA 72 P1d: orice eroare pe hartă → mesaj prietenos + reload,
 *  NICIODATĂ ecran negru. */
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

/** sheet-ul de jos (B3) */
function NodeSheet({ node, domain, onClose }: { node: MapNode; domain: MapDomain; onClose: () => void }) {
  const mastered = node.prereqState.filter((p) => p.mastered);
  const missing = node.prereqState.filter((p) => !p.mastered);
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
        <div className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm space-y-1">
          <p className="font-medium">Cere întâi:</p>
          {missing.slice(0, 4).map((p) => (
            <Link
              key={p.slug}
              href={`/app/chat?concept=${encodeURIComponent(p.slug)}`}
              className="block text-primary underline underline-offset-2"
            >
              <MathText text={p.name} /> →
            </Link>
          ))}
        </div>
      ) : mastered.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Deblocat de: {mastered.slice(0, 4).map((p) => p.name).join(" ✓, ")} ✓
        </p>
      ) : node.prereqState.length === 0 ? (
        <p className="text-sm text-muted-foreground">Fără prerechizite — punct de pornire.</p>
      ) : null}

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
