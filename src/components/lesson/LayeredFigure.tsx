"use client";

/**
 * LayeredFigure — ETAPA 67 FAZA F (client): dezvăluirea progresivă a figurii.
 *
 * Ia SVG-ul de la /api/figura/{exerciseId}; dacă acesta conține grupuri
 * <g data-layer="0..3"> (emise de render-svg pentru spec-urile cu proveniență
 * semantică), straturile apar pe rând (fade-in, 0→layerMax). Fără straturi →
 * figura apare ÎNTREAGĂ (cazul MARCAT, nu forțat).
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  exerciseId: string;
  layerMax?: number;
}

export function LayeredFigure({ exerciseId, layerMax }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [visibleLayer, setVisibleLayer] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const maxLayer = layerMax ?? 3;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/figura/${exerciseId}`)
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (cancelled) return;
        if (text && text.includes("<svg")) setSvg(text);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [exerciseId]);

  const hasLayers = !!svg && svg.includes("data-layer");

  // dezvăluirea: stratul următor la fiecare 900ms
  useEffect(() => {
    if (!hasLayers || visibleLayer >= maxLayer) return;
    const t = setTimeout(() => setVisibleLayer((v) => v + 1), 900);
    return () => clearTimeout(t);
  }, [hasLayers, visibleLayer, maxLayer]);

  // aplică opacitatea pe grupurile data-layer (fade-in CSS)
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !hasLayers) return;
    host.querySelectorAll<SVGGElement>("g[data-layer]").forEach((g) => {
      const layer = Number(g.dataset.layer ?? 0);
      g.style.transition = "opacity 0.6s ease";
      g.style.opacity = layer <= visibleLayer ? "1" : "0";
    });
  }, [svg, hasLayers, visibleLayer]);

  if (failed) {
    return <p className="text-xs text-muted-foreground text-center">(figura nu e disponibilă)</p>;
  }
  if (!svg) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div
      ref={hostRef}
      className="figura-bac mx-auto max-w-full [&_svg]:max-w-full [&_svg]:h-auto"
      // SVG-ul vine exclusiv din /api/figura (randat server-side din spec persistat) — trusted
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
