"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";

// Session-level cache: instanceId → height (avoids re-compiling in same session)
const heightCache = new Map<string, number>();

interface Props {
  code: string;
}

type Status = "loading" | "done" | "error";

function buildIframeHtml(code: string, id: string): string {
  const safe = code.replace(/<\/script>/gi, "<\\/script>");
  return `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/tikzjax/fonts.css">
  <script src="/tikzjax/tikzjax.js"></script>
  <style>
    html, body { margin: 0; padding: 8px; background: transparent; overflow: hidden; }
    svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  </style>
</head>
<body>
<script type="text/tikz">${safe}</script>
<script>
  (function() {
    var id = ${JSON.stringify(id)};
    var n = 0;
    var t = setInterval(function() {
      var svg = document.querySelector('svg');
      if (svg) {
        clearInterval(t);
        var h = document.body.scrollHeight;
        parent.postMessage({ tikzId: id, type: 'done', height: h }, '*');
      }
      if (++n > 150) {
        clearInterval(t);
        parent.postMessage({ tikzId: id, type: 'error' }, '*');
      }
    }, 200);
  })();
</script>
</body>
</html>`;
}

export function TikZRenderer({ code }: Props) {
  const instanceId = useRef(Math.random().toString(36).slice(2)).current;

  const [status, setStatus] = useState<Status>(() =>
    heightCache.has(code) ? "done" : "loading"
  );
  const [iframeHeight, setIframeHeight] = useState<number>(
    () => heightCache.get(code) ?? 0
  );

  const iframeSrc = useMemo(() => buildIframeHtml(code, instanceId), [code, instanceId]);

  useEffect(() => {
    if (heightCache.has(code)) {
      setIframeHeight(heightCache.get(code)!);
      setStatus("done");
      return;
    }

    setStatus("loading");

    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.tikzId !== instanceId) return;
      if (e.data.type === "done") {
        const h = (e.data.height as number) || 200;
        heightCache.set(code, h);
        setIframeHeight(h);
        setStatus("done");
      } else if (e.data.type === "error") {
        setStatus("error");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [code, instanceId]);

  return (
    <div className="my-3 w-full rounded-lg overflow-hidden">
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
          <p className="font-medium mb-1">Desen indisponibil (TikZJax CDN)</p>
          <details className="cursor-pointer">
            <summary className="text-xs text-red-500 select-none">Cod TikZ</summary>
            <pre className="mt-1 overflow-x-auto text-xs text-red-700 whitespace-pre-wrap">{code}</pre>
          </details>
        </div>
      )}

      {/* Iframe stays mounted — SVG renders in its own document context (no positioning issues) */}
      <iframe
        srcDoc={iframeSrc}
        sandbox="allow-scripts allow-same-origin"
        title="tikz"
        style={{
          display: status === "done" ? "block" : "none",
          width: "100%",
          height: iframeHeight ? `${iframeHeight + 16}px` : "auto",
          border: "none",
          background: "transparent",
        }}
      />
    </div>
  );
}
