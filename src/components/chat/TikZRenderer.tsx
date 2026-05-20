"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    __tikzjaxState?: "loading" | "ready" | "error";
    __tikzjaxQueue?: Array<() => void>;
  }
}

const svgCache = new Map<string, string>();

interface Props {
  code: string;
}

type Status = "loading" | "done" | "error";

function loadTikZJax(): Promise<void> {
  if (window.__tikzjaxState === "ready") return Promise.resolve();
  if (window.__tikzjaxState === "error") return Promise.reject(new Error("CDN load failed"));

  return new Promise((resolve, reject) => {
    if (!window.__tikzjaxQueue) window.__tikzjaxQueue = [];

    if (window.__tikzjaxState === "loading") {
      // Script is already loading — just queue our callback
      window.__tikzjaxQueue.push(() => resolve());
      return;
    }

    window.__tikzjaxState = "loading";
    window.__tikzjaxQueue.push(() => resolve());

    const script = document.createElement("script");
    script.src = "https://tikzjax.com/v1/tikzjax.js";
    script.async = true;

    script.onload = () => {
      window.__tikzjaxState = "ready";
      window.__tikzjaxQueue?.forEach((fn) => fn());
      window.__tikzjaxQueue = [];
    };

    script.onerror = () => {
      window.__tikzjaxState = "error";
      reject(new Error("CDN load failed"));
      window.__tikzjaxQueue = [];
    };

    document.head.appendChild(script);
  });
}

export function TikZRenderer({ code }: Props) {
  const displayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(() =>
    svgCache.has(code) ? "done" : "loading"
  );

  useEffect(() => {
    const cached = svgCache.get(code);
    if (cached && displayRef.current) {
      displayRef.current.innerHTML = cached;
      setStatus("done");
      return;
    }

    setStatus("loading");
    let cancelled = false;

    // Processing zone outside React's controlled DOM
    const zone = document.createElement("div");
    zone.style.cssText =
      "position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(zone);

    const compile = (): (() => void) => {
      const tikzEl = document.createElement("script");
      tikzEl.type = "text/tikz";
      tikzEl.textContent = code;
      zone.appendChild(tikzEl);

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
      }, 250);

      const timer = setTimeout(() => {
        clearInterval(interval);
        if (!cancelled) setStatus("error");
      }, 25_000);

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
      zone.remove();
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
          <p className="font-medium mb-1">
            Desen indisponibil — TikZJax nu s-a putut încărca (rețea sau CSP).
          </p>
          <details className="cursor-pointer">
            <summary className="text-xs text-red-500 select-none">Cod TikZ</summary>
            <pre className="mt-1 overflow-x-auto text-xs text-red-700 whitespace-pre-wrap">{code}</pre>
          </details>
        </div>
      )}
      <div
        ref={displayRef}
        className={status === "done" ? "flex justify-center [&_svg]:max-w-full" : "hidden"}
      />
    </div>
  );
}
