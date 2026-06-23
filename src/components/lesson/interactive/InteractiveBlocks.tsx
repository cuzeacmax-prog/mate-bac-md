"use client";

/**
 * InteractiveBlocks — ETAPA 81 FAZA B: componentele interactive ale player-ului.
 * R5: motoarele deterministe randează (plot.ts validat, manipulatives din 71);
 * starea interacțiunii e LOCALĂ, zero LLM. Logica pură e în lib/lesson/interactive.
 * Mobile-first (degetul mare), reduced-motion → fără animație dar funcțional,
 * slider accesibil cu tastatura.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, Reorder, useReducedMotion } from "framer-motion";
import { MathText } from "@/components/MathText";
import { LayeredFigure } from "@/components/lesson/LayeredFigure";
import { renderPlotSVG, validatePlotExpr } from "@/lib/lesson/plot";
import { concreteExpr, curveObservables, rollDice, drawFromUrn, urnProbability, reorder, revealedAt, maxRevealStep } from "@/lib/lesson/interactive";

type Any = Record<string, unknown>;

// ───────────────────────── reveal_figure ─────────────────────────
export function RevealFigureView({ block }: { block: Any }) {
  const layers = (block.layers as Array<{ step_index: number; elements: string[]; caption?: string }>) ?? [];
  const maxStep = maxRevealStep(layers.map((l) => l.step_index));
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();
  const figureKind = (block.figure_kind as string) ?? "exercise";
  const visible = layers.filter((l) => revealedAt(l.step_index, step));
  return (
    <div className="glass-solid rounded-2xl p-5 space-y-3">
      {figureKind === "exercise" && block.exercise_id ? (
        <LayeredFigure exerciseId={block.exercise_id as string} layerMax={Math.min(step, 3)} />
      ) : block.theory_slug ? (
        <TheorySVG slug={block.theory_slug as string} />
      ) : null}
      <ol className="space-y-1.5">
        {layers.map((l, i) => {
          const shown = revealedAt(l.step_index, step);
          return (
            <motion.li
              key={i}
              initial={false}
              animate={{ opacity: shown ? 1 : 0.25 }}
              transition={reduce ? { duration: 0 } : { duration: 0.3 }}
              className={`flex gap-2 text-sm ${l.step_index === step ? "font-semibold text-primary" : ""}`}
            >
              <span className="shrink-0">{shown ? "●" : "○"}</span>
              <span>{l.caption ? <MathText text={l.caption} /> : (l.elements ?? []).join(", ")}</span>
            </motion.li>
          );
        })}
      </ol>
      {block.legenda ? <p className="text-xs text-muted-foreground text-center"><MathText text={block.legenda as string} /></p> : null}
      {step < maxStep && (
        <button
          onClick={() => setStep((s) => Math.min(maxStep, s + 1))}
          className="w-full rounded-xl border border-primary/40 text-primary py-2 text-sm font-medium"
        >
          Dezvăluie pasul → ({visible.length}/{layers.length})
        </button>
      )}
    </div>
  );
}

function TheorySVG({ slug }: { slug: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    fetch(`/api/figura-teorie/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.text() : null)).then((t) => { if (!off && t?.includes("<svg")) setSvg(t); }).catch(() => {});
    return () => { off = true; };
  }, [slug]);
  if (!svg) return <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">…</div>;
  // ETAPA 83 H: figura de teorie în stil constelație (geometrie neatinsă, doar stil)
  return <div className="figura-bac figura-constelatie rounded-2xl p-3 w-full [&_svg]:w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ───────────────────────── progressive_table ─────────────────────────
export function ProgressiveTableView({ block }: { block: Any }) {
  const coloane = (block.coloane as string[]) ?? [];
  const randuri = (block.randuri as Array<{ cells: string[]; reveal_at_step: number; highlight_cell?: number }>) ?? [];
  const maxStep = maxRevealStep(randuri.map((r) => r.reveal_at_step));
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();
  return (
    <div className="glass-solid rounded-2xl p-5 space-y-3">
      {block.titlu ? <p className="text-sm font-semibold text-center"><MathText text={block.titlu as string} /></p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>{coloane.map((c, i) => <th key={i} className="border-b border-border px-2 py-1.5 text-left font-semibold"><MathText text={c} /></th>)}</tr>
          </thead>
          <tbody>
            {randuri.map((r, ri) => {
              const shown = revealedAt(r.reveal_at_step, step);
              return (
                <tr key={ri}>
                  {r.cells.map((cell, ci) => (
                    <td key={ci} className={`border-b border-border/50 px-2 py-1.5 ${r.highlight_cell === ci && shown ? "bg-primary/10 font-semibold rounded" : ""}`}>
                      <AnimatePresence>
                        {shown && (
                          <motion.span initial={{ opacity: 0, y: reduce ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.25 }}>
                            <MathText text={cell} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {step < maxStep && (
        <button onClick={() => setStep((s) => Math.min(maxStep, s + 1))} className="w-full rounded-xl border border-primary/40 text-primary py-2 text-sm font-medium">
          Completează celulele → (pasul {step + 1}/{maxStep + 1})
        </button>
      )}
    </div>
  );
}

// ───────────────────────── interactive_manipulative (tactil) ─────────────────────────
export function InteractiveManipulativeView({ block }: { block: Any }) {
  const kind = block.kind as string;
  const params = (block.params as Any) ?? {};
  return (
    <div className="glass-solid rounded-2xl p-5 space-y-3" style={{ ["--manip-accent" as string]: "var(--lesson-accent, var(--primary))" }}>
      {kind === "zaruri" || kind === "carti" || kind === "monede" ? <RollManip kind={kind} params={params} /> : null}
      {kind === "urna" ? <UrnaManip params={params} /> : null}
      {kind === "persoane" ? <PersoaneManip params={params} /> : null}
      {block.legenda ? <p className="text-xs text-muted-foreground text-center"><MathText text={block.legenda as string} /></p> : null}
    </div>
  );
}

function RollManip({ kind, params }: { kind: string; params: Any }) {
  const n = Math.max(1, Math.min(4, Number(params.n) || 2));
  const reduce = useReducedMotion();
  const [vals, setVals] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const faces = kind === "monede" ? 2 : 6;
  const sym = (v: number) => (kind === "monede" ? (v === 1 ? "B" : "S") : kind === "carti" ? ["A", "2", "3", "4", "5", "6"][v - 1] : String(v));
  const roll = () => {
    setRolling(true);
    setTimeout(() => {
      const r = rollDice(n, faces);
      setVals(r);
      setHistory((h) => [...h, r.reduce((s, x) => s + x, 0)].slice(-12));
      setRolling(false);
    }, reduce ? 0 : 380);
  };
  const label = kind === "monede" ? "Aruncă monedele" : kind === "carti" ? "Extrage cărțile" : "Aruncă zarurile";
  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-center gap-3">
        {(vals.length ? vals : Array.from({ length: n }, () => 0)).map((v, i) => (
          <motion.div
            key={`${i}-${v}`}
            animate={rolling && !reduce ? { rotate: [0, 360, 720], scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.38 }}
            className="w-12 h-12 rounded-xl bg-[var(--manip-accent)]/10 border-2 border-[var(--manip-accent)]/40 flex items-center justify-center text-lg font-bold"
          >
            {v ? sym(v) : "?"}
          </motion.div>
        ))}
      </div>
      {vals.length > 0 && kind !== "monede" && <p className="text-sm">Sumă: <span className="font-bold">{vals.reduce((s, x) => s + x, 0)}</span></p>}
      <button onClick={roll} disabled={rolling} className="rounded-xl bg-[var(--manip-accent)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">{label}</button>
      {history.length > 1 && <p className="text-xs text-muted-foreground">Aruncări: {history.join(", ")}</p>}
    </div>
  );
}

function UrnaManip({ params }: { params: Any }) {
  const bile = (params.bile as Array<{ culoare: string; n: number }>) ?? [];
  const initial = useMemo(() => Object.fromEntries(bile.map((b) => [b.culoare, b.n])) as Record<string, number>, [bile]);
  const [urn, setUrn] = useState<Record<string, number>>(initial);
  const [last, setLast] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string[]>([]);
  const reduce = useReducedMotion();
  const total = Object.values(urn).reduce((s, n) => s + n, 0);
  const colorHex: Record<string, string> = { rosu: "#dc2626", albastru: "#2563eb", verde: "#16a34a", galben: "#ca8a04", negru: "#111827", alb: "#d1d5db" };
  const draw = () => {
    const { color, rest } = drawFromUrn(urn);
    if (!color) return;
    setUrn(rest); setLast(color); setDrawn((d) => [...d, color]);
  };
  return (
    <div className="space-y-3 text-center">
      <div className="flex flex-wrap justify-center gap-1.5 min-h-12">
        {bile.flatMap((b) => Array.from({ length: urn[b.culoare] ?? 0 }, (_, i) => (
          <motion.span key={`${b.culoare}-${i}`} initial={false} className="w-5 h-5 rounded-full border" style={{ background: colorHex[b.culoare] ?? "#9ca3af" }} />
        )))}
      </div>
      {last && (
        <motion.p initial={{ opacity: 0, scale: reduce ? 1 : 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-sm">
          Ai extras: <span className="font-bold">{last}</span>
        </motion.p>
      )}
      <div className="text-xs text-muted-foreground">
        {bile.map((b) => <span key={b.culoare} className="mx-1">P({b.culoare}) = {total > 0 ? `${urn[b.culoare] ?? 0}/${total}` : "—"} ({(urnProbability(urn, b.culoare) * 100).toFixed(0)}%)</span>)}
      </div>
      <button onClick={draw} disabled={total === 0} className="rounded-xl bg-[var(--manip-accent)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">Extrage o bilă</button>
      {drawn.length > 0 && <button onClick={() => { setUrn(initial); setDrawn([]); setLast(null); }} className="block mx-auto text-xs underline text-muted-foreground">resetează urna</button>}
    </div>
  );
}

function PersoaneManip({ params }: { params: Any }) {
  const n = Math.max(2, Math.min(8, Number(params.n) || 3));
  const [order, setOrder] = useState<string[]>(() => Array.from({ length: n }, (_, i) => `P${i + 1}`));
  return (
    <div className="space-y-2 text-center">
      <p className="text-xs text-muted-foreground">Trage persoanele ca să schimbi ordinea (permutarea):</p>
      <Reorder.Group axis="x" values={order} onReorder={setOrder} className="flex justify-center gap-2 flex-wrap">
        {order.map((p) => (
          <Reorder.Item key={p} value={p} className="cursor-grab active:cursor-grabbing select-none w-11 h-11 rounded-full bg-[var(--manip-accent)]/15 border-2 border-[var(--manip-accent)]/50 flex items-center justify-center text-sm font-bold">
            {p}
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <p className="text-sm">Ordinea: <span className="font-mono font-semibold">{order.join(" – ")}</span></p>
    </div>
  );
}

// ───────────────────────── parameter_slider ─────────────────────────
export function ParameterSliderView({ block }: { block: Any }) {
  const template = block.expr_template as string;
  const param = block.param as string;
  const [min, max, step] = (block.range as [number, number, number]) ?? [-3, 3, 0.5];
  const domain = (block.domain as [number, number]) ?? [-5, 5];
  const [val, setVal] = useState<number>(Math.round(((min + max) / 2) / step) * step);
  const [svg, setSvg] = useState<string>("");
  const [obs, setObs] = useState<{ roots: number; vertex: { x: number; y: number } | null }>({ roots: 0, vertex: null });
  const reduce = useReducedMotion();

  const render = useCallback((v: number) => {
    const expr = concreteExpr(template, param, v);
    const r = renderPlotSVG(expr, domain);
    if (r.ok) setSvg(r.svg);
    // observabile
    const valid = validatePlotExpr(expr);
    if (valid.ok) {
      const compiled = valid.node.compile();
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= 120; i++) { const x = domain[0] + ((domain[1] - domain[0]) * i) / 120; let y: unknown; try { y = compiled.evaluate({ x, ln: (t: number) => Math.log(t) }); } catch { y = NaN; } pts.push({ x, y: typeof y === "number" ? y : NaN }); }
      setObs(curveObservables(pts));
    }
  }, [template, param, domain]);

  // debounce re-randarea
  const tmr = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (tmr.current) clearTimeout(tmr.current);
    tmr.current = setTimeout(() => render(val), reduce ? 0 : 60);
    return () => { if (tmr.current) clearTimeout(tmr.current); };
  }, [val, render, reduce]);

  return (
    <div className="glass-solid rounded-2xl p-5 space-y-3">
      <div className="figura-bac w-full [&_svg]:w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <label htmlFor="slider-param" className="font-medium"><MathText text={`$${param} = ${val}$`} /></label>
          <span className="text-muted-foreground text-xs">{block.observe as string}</span>
        </div>
        <input
          id="slider-param" type="range" min={min} max={max} step={step} value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className="w-full accent-[var(--lesson-accent,var(--primary))] touch-pan-x"
          aria-label={`Parametrul ${param}`}
        />
      </div>
      <p className="text-sm text-center text-muted-foreground">
        Rădăcini reale: <span className="font-semibold text-foreground">{obs.roots}</span>
        {obs.vertex && <> · vârf ≈ <span className="font-semibold text-foreground">({obs.vertex.x}, {obs.vertex.y})</span></>}
      </p>
      {block.legenda ? <p className="text-xs text-muted-foreground text-center"><MathText text={block.legenda as string} /></p> : null}
    </div>
  );
}

// ───────────────────────── try_step ─────────────────────────
export function TryStepView({ block, messageId }: { block: Any; messageId: string | null }) {
  const tryId = block.try_id as string;
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "correct" | "wrong">("idle");
  const [usedHint, setUsedHint] = useState(false);
  const reduce = useReducedMotion();

  const submit = async () => {
    if (!answer.trim() || !messageId || state === "pending") return;
    setState("pending");
    try {
      const resp = await fetch("/api/lesson/try", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, tryId, answer: answer.trim(), usedHint }),
      });
      const data = await resp.json();
      if (data.correct) setState("correct");
      else { setState("wrong"); setUsedHint(true); }
    } catch { setState("idle"); }
  };

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-card p-5 space-y-3">
      <p className="text-xs font-semibold text-primary uppercase">Încearcă tu</p>
      <p className="font-medium leading-relaxed"><MathText text={block.prompt as string} /></p>
      <div className="flex gap-2">
        <input
          value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Răspunsul tău…" disabled={state === "correct"}
          className="flex-1 rounded-xl border px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button onClick={submit} disabled={state === "pending" || state === "correct" || !answer.trim()} className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 font-medium disabled:opacity-50">
          {state === "pending" ? "…" : "Verifică"}
        </button>
      </div>
      <AnimatePresence>
        {state === "correct" && (
          <motion.p initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl px-3 py-2 text-sm font-medium bg-success-bg text-success-foreground">
            ✓ Corect! {usedHint ? "(cu indiciu — progresul urcă pe jumătate)" : "Continuă mai jos."}
          </motion.p>
        )}
        {state === "wrong" && (
          <motion.div initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl px-3 py-2 text-sm bg-secondary text-secondary-foreground space-y-1">
            <p className="font-semibold">💡 Indiciu:</p>
            <p><MathText text={block.hint as string} /></p>
            <p className="text-xs opacity-80">Mai încearcă — sau treci mai departe; nu te blochează.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
