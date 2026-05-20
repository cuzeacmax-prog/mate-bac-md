"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Maximize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    GGBApplet?: new (params: Record<string, unknown>, defer: boolean) => {
      inject: (id: string) => void;
    };
    __ggbLoaded?: boolean;
    __ggbPending?: Array<() => void>;
  }
}

interface Props {
  commands: string;
}

let ggbInstanceCounter = 0;

export function GeoGebraEmbed({ commands }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<Record<string, unknown> | null>(null);
  const idRef = useRef(`ggb-${++ggbInstanceCounter}`);
  const [ready, setReady] = useState(false);

  const evalCommands = useCallback((applet: Record<string, unknown>) => {
    const evalFn = applet.evalCommand as ((cmd: string) => void) | undefined;
    if (!evalFn) return;
    commands
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        try {
          evalFn.call(applet, line);
        } catch {
          // Individual command failures are non-fatal
        }
      });
  }, [commands]);

  const initApplet = useCallback(() => {
    const container = containerRef.current;
    if (!container || !window.GGBApplet) return;

    container.innerHTML = `<div id="${idRef.current}"></div>`;

    const params: Record<string, unknown> = {
      appName: "geometry",
      width: 640,
      height: 480,
      showToolBar: false,
      showAlgebraInput: false,
      showMenuBar: false,
      enableLabelDrags: true,
      enableShiftDragZoom: true,
      enableRightClick: false,
      showResetIcon: false,
      appletOnLoad: (api: Record<string, unknown>) => {
        appletRef.current = api;
        evalCommands(api);
        setReady(true);
      },
    };

    const applet = new window.GGBApplet(params, true);
    applet.inject(idRef.current);
  }, [evalCommands]);

  useEffect(() => {
    if (window.__ggbLoaded) {
      initApplet();
      return;
    }

    // Queue init until GeoGebra script loads
    if (!window.__ggbPending) window.__ggbPending = [];
    window.__ggbPending.push(initApplet);

    if (!document.querySelector('script[src*="deployggb"]')) {
      const script = document.createElement("script");
      script.src = "https://www.geogebra.org/apps/deployggb.js";
      script.async = true;
      script.onload = () => {
        window.__ggbLoaded = true;
        window.__ggbPending?.forEach((fn) => fn());
        window.__ggbPending = [];
      };
      document.head.appendChild(script);
    }
  }, [initApplet]);

  const handleReset = () => {
    setReady(false);
    if (appletRef.current) {
      const newConstr = appletRef.current.newConstruction as (() => void) | undefined;
      newConstr?.call(appletRef.current);
      evalCommands(appletRef.current);
      setReady(true);
    }
  };

  const handleFullscreen = () => {
    containerRef.current?.requestFullscreen?.();
  };

  return (
    <div className="my-3 w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 font-medium">GeoGebra interactiv</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={handleReset} className="h-7 px-2 text-xs gap-1">
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
          <Button size="sm" variant="outline" onClick={handleFullscreen} className="h-7 px-2 text-xs gap-1">
            <Maximize2 className="h-3 w-3" />
            Fullscreen
          </Button>
        </div>
      </div>
      <div
        className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
        style={{ height: 480 }}
      >
        <div
          ref={containerRef}
          className="absolute inset-0"
        />
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
            <span>Se încarcă GeoGebra...</span>
          </div>
        )}
      </div>
    </div>
  );
}
