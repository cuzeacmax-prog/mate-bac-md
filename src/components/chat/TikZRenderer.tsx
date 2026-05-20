"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    __tikzjaxLoaded?: boolean;
  }
}

const svgCache = new Map<string, string>();

interface Props {
  code: string;
}

type Status = "loading" | "done" | "error";

function loadTikZJax(): Promise<void> {
  if (window.__tikzjaxLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let scriptEl = document.querySelector(
      'script[src*="tikzjax"]'
    ) as HTMLScriptElement | null;

    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.src = "https://tikzjax.com/v1/tikzjax.js";
      scriptEl.async = true;
      document.head.appendChild(scriptEl);
    }

    // Script might have already fired 'load' in a prior React render cycle;
    // track readiness via the global flag set in the onload below.
    if (window.__tikzjaxLoaded) {
      resolve();
      return;
    }

    scriptEl.addEventListener("load", () => {
      window.__tikzjaxLoaded = true;
      resolve();
    });
    scriptEl.addEventListener("error", reject);
  });
}

export function TikZRenderer({ code }: Props) {
  const displayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(() =>
    svgCache.has(code) ? "done" : "loading"
  );

  useEffect(() => {
    // Use cached SVG instantly — no re-compile
    const cached = svgCache.get(code);
    if (cached && displayRef.current) {
      displayRef.current.innerHTML = cached;
      setStatus("done");
      return;
    }

    setStatus("loading");
    let cancelled = false;

    // Processing zone lives outside React's tree to avoid reconciler interference
    const zone = document.createElement("div");
    zone.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;";
    document.body.appendChild(zone);

    const compile = () => {
      if (cancelled) return;

      const tikzEl = document.createElement("script");
      tikzEl.type = "text/tikz";
      tikzEl.textContent = code;
      zone.appendChild(tikzEl);

      // Poll until TikZJax replaces the script element with SVG
      const interval = setInterval(() => {
        const svg = zone.querySelector("svg");
        if (svg) {
          clearInterval(interval);
          clearTimeout(timer);
          if (!cancelled) {
            const html = svg.outerHTML;
            svgCache.set(code, html);
            if (displayRef.current) displayRef.current.innerHTML = html;
            setStatus("done");
          }
        }
      }, 200);

      const timer = setTimeout(() => {
        clearInterval(interval);
        if (!cancelled) setStatus("error");
      }, 20_000);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    };

    let innerCleanup: (() => void) | undefined;

    loadTikZJax()
      .then(() => {
        if (!cancelled) innerCleanup = compile();
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      innerCleanup?.();
      if (document.body.contains(zone)) zone.remove();
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
          <pre className="mt-1 overflow-x-auto text-xs text-red-700 whitespace-pre-wrap">{code}</pre>
        </div>
      )}
      <div
        ref={displayRef}
        className={status === "done" ? "flex justify-center [&_svg]:max-w-full" : "hidden"}
      />
    </div>
  );
}
