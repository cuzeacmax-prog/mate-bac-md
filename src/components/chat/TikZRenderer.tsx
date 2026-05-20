"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    __tikzjaxLoaded?: boolean;
  }
}

// Module-level SVG cache: avoids re-compiling the same code in the same session
const svgCache = new Map<string, string>();

interface Props {
  code: string;
}

type Status = "loading" | "done" | "error";

export function TikZRenderer({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(() =>
    svgCache.has(code) ? "done" : "loading"
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use cached SVG instantly
    const cached = svgCache.get(code);
    if (cached) {
      container.innerHTML = cached;
      setStatus("done");
      return;
    }

    container.innerHTML = "";
    setStatus("loading");

    let cleanup: (() => void) | undefined;

    const injectAndObserve = () => {
      if (!container) return;

      // Create TikZ script element
      const tikzEl = document.createElement("script");
      tikzEl.type = "text/tikz";
      tikzEl.textContent = code;
      container.appendChild(tikzEl);

      const observer = new MutationObserver(() => {
        const svg = container.querySelector("svg");
        if (svg) {
          svgCache.set(code, container.innerHTML);
          setStatus("done");
          observer.disconnect();
        }
      });

      observer.observe(container, { childList: true, subtree: true });

      // 30s timeout — TikZJax WASM can be slow on first load
      const timer = setTimeout(() => {
        observer.disconnect();
        setStatus("error");
      }, 30_000);

      cleanup = () => {
        observer.disconnect();
        clearTimeout(timer);
      };
    };

    if (window.__tikzjaxLoaded) {
      injectAndObserve();
      return () => cleanup?.();
    }

    // Load TikZJax CDN script once
    let scriptEl = document.querySelector(
      'script[src*="tikzjax"]'
    ) as HTMLScriptElement | null;

    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.src = "https://tikzjax.com/v1/tikzjax.js";
      scriptEl.async = true;
      document.head.appendChild(scriptEl);
    }

    const onLoad = () => {
      window.__tikzjaxLoaded = true;
      injectAndObserve();
    };

    const onError = () => setStatus("error");

    scriptEl.addEventListener("load", onLoad);
    scriptEl.addEventListener("error", onError);

    return () => {
      scriptEl?.removeEventListener("load", onLoad);
      scriptEl?.removeEventListener("error", onError);
      cleanup?.();
    };
  }, [code]);

  return (
    <div className="my-3 w-full">
      {status === "loading" && (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500"
          style={{ minHeight: 200 }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span>Compilez desenul...</span>
        </div>
      )}
      {status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <span className="font-medium">Eroare TikZ</span> — verifică sintaxa. Cod:
          <pre className="mt-1 overflow-x-auto text-xs text-red-700">{code}</pre>
        </div>
      )}
      <div
        ref={containerRef}
        className={status === "done" ? "flex justify-center" : "hidden"}
        style={{ minHeight: status === "done" ? undefined : 200 }}
      />
    </div>
  );
}
