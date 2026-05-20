"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// Session-level cache: avoids re-compiling same TikZ code
const svgCache = new Map<string, string>();

interface Props {
  code: string;
}

type Status = "loading" | "done" | "error";

function buildIframeHtml(code: string, instanceId: string): string {
  // Escape </script> inside the TikZ content to prevent breaking the iframe HTML
  const safe = code.replace(/<\/script>/gi, "<\\/script>");

  return `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://tikzjax.com/v1/fonts.css">
  <script src="https://tikzjax.com/v1/tikzjax.js"></script>
  <style>
    html, body { margin: 0; padding: 4px; background: transparent; overflow: hidden; }
    svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  </style>
</head>
<body>
<script type="text/tikz">${safe}</script>
<script>
  (function() {
    var id = ${JSON.stringify(instanceId)};
    var attempts = 0;
    var timer = setInterval(function() {
      var svg = document.querySelector('svg');
      if (svg) {
        clearInterval(timer);
        parent.postMessage({ tikzId: id, type: 'done', html: svg.outerHTML }, '*');
      }
      if (++attempts > 150) {
        clearInterval(timer);
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
    svgCache.has(code) ? "done" : "loading"
  );
  const [svgHtml, setSvgHtml] = useState<string>(() => svgCache.get(code) ?? "");
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  // Build iframe content (only once when code is stable — never during streaming)
  useEffect(() => {
    const cached = svgCache.get(code);
    if (cached) {
      setSvgHtml(cached);
      setStatus("done");
      return;
    }

    setStatus("loading");
    setIframeSrc(buildIframeHtml(code, instanceId));
  }, [code, instanceId]);

  // Listen for postMessage from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.tikzId !== instanceId) return;
      if (e.data.type === "done") {
        const html = e.data.html as string;
        svgCache.set(code, html);
        setSvgHtml(html);
        setStatus("done");
        setIframeSrc(null); // Remove iframe once we have the SVG
      } else if (e.data.type === "error") {
        setStatus("error");
        setIframeSrc(null);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [code, instanceId]);

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
          <p className="font-medium mb-1">Desen indisponibil (TikZJax CDN)</p>
          <details className="cursor-pointer">
            <summary className="text-xs text-red-500 select-none">Cod TikZ</summary>
            <pre className="mt-1 overflow-x-auto text-xs text-red-700 whitespace-pre-wrap">{code}</pre>
          </details>
        </div>
      )}

      {status === "done" && svgHtml && (
        <div
          className="flex justify-center [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      )}

      {/* Hidden iframe compiles TikZ — removed once SVG is received */}
      {iframeSrc && (
        <iframe
          srcDoc={iframeSrc}
          sandbox="allow-scripts"
          title="tikz-compile"
          style={{ display: "none", width: 0, height: 0, border: "none" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
