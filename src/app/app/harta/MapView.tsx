"use client";

/**
 * MapView — ETAPA 71 FAZA B: randarea hărții cunoașterii.
 * SVG propriu (layout PRECOMPUTAT cu dagre — nimic calculat aici), pan/zoom
 * prin pointer events, noduri-cerc cu 4 stări, lentile (BAC / Nota-țintă /
 * Test mâine), sheet jos la tap pe nod. Zero LLM, zero fetch suplimentar
 * (focusul se scrie prin /api/focus).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MathText } from "@/components/MathText";
import { MILESTONE_LABELS } from "@/lib/map/milestones";
import type { KnowledgeMap, MapDomain, MapNode } from "@/lib/map/state";

type Lens = "bac" | "tinta" | "test";

const NODE_R = 26;

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

  // ── pan/zoom (pointer events; layoutul e static) ──────────────────────────
  const [view, setView] = useState({ tx: 20, ty: 20, scale: 0.8 });
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setView((v) => ({ ...v, tx: dragRef.current!.tx + e.clientX - dragRef.current!.x, ty: dragRef.current!.ty + e.clientY - dragRef.current!.y }));
  };
  const onPointerUp = () => { dragRef.current = null; };
  const zoom = (f: number) => setView((v) => ({ ...v, scale: Math.min(2.5, Math.max(0.25, v.scale * f)) }));
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
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium border-2 transition-colors ${
              d.key === domainKey ? "text-white" : ""
            }`}
            style={
              d.key === domainKey
                ? { background: `var(--domain-${d.key})`, borderColor: `var(--domain-${d.key})` }
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
          <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
            {/* muchiile (prerechizit → dependent) */}
            {domain.edges.map((e, i) => {
              const a = domain.nodes.find((n) => n.id === e.to);
              const b = domain.nodes.find((n) => n.id === e.from);
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
                selected={selected?.id === n.id}
                onSelect={() => setSelected(n)}
              />
            ))}
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

/** nodul-cerc cu cele 4 stări (B2) */
function MapNodeCircle({ node, domainKey, opacity, selected, onSelect }: {
  node: MapNode; domainKey: string; opacity: number; selected: boolean; onSelect: () => void;
}) {
  const color = `var(--domain-${domainKey})`;
  const bg = `var(--domain-${domainKey}-bg)`;
  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      opacity={node.status === "blocat" ? Math.min(opacity, 0.45) : opacity}
      onClick={onSelect}
      onPointerDown={(e) => e.stopPropagation()}
      className="cursor-pointer"
    >
      {node.status === "disponibil" && (
        <circle r={NODE_R + 6} fill="none" stroke={color} strokeWidth={2} className="map-pulse" />
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
