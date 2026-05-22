"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

// Viz renderers disabled — moving to library-based static SVG approach (Phase 3)
// const TikZRenderer = dynamic(
//   () => import("@/components/chat/TikZRenderer").then((m) => ({ default: m.TikZRenderer })),
//   { ssr: false }
// );
// const GeoGebraEmbed = dynamic(
//   () => import("@/components/chat/GeoGebraEmbed").then((m) => ({ default: m.GeoGebraEmbed })),
//   { ssr: false }
// );
// const ThreeRenderer = dynamic(
//   () => import("@/components/chat/ThreeRenderer").then((m) => ({ default: m.ThreeRenderer })),
//   { ssr: false }
// );

const VIZ_LANGS = new Set(["tikz", "geogebra", "three"]);

interface Props {
  content: string;
  isStreaming?: boolean;
}

export function MessageRenderer({ content, isStreaming }: Props) {
  const components: Components = {
    // pre handles block code — intercepts visualization languages before the prose wrapper
    pre: ({ children }) => {
      const childArray = React.Children.toArray(children);
      if (childArray.length === 1) {
        const child = childArray[0];
        if (React.isValidElement(child)) {
          // If code override returned a visualization component, unwrap it
          if (typeof child.type !== "string") {
            return <>{children}</>;
          }
          // If code override returned null (streaming + viz lang), hide the entire block
          if (child.type === null) {
            return null;
          }
        }
      }
      // Check for null/undefined children (code returned null during streaming)
      if (!children || (Array.isArray(children) && children.every((c) => c == null))) {
        return null;
      }
      return (
        <pre className="bg-muted rounded p-3 text-sm font-mono overflow-x-auto">
          {children}
        </pre>
      );
    },

    // code handles both inline and block code
    code: ({ className, children }) => {
      const lang = className?.replace("language-", "") ?? "";
      const codeContent = String(children).trimEnd();

      if (VIZ_LANGS.has(lang)) {
        if (isStreaming) return null;
        // Viz renderers disabled — will serve from library (Phase 3)
        // if (lang === "tikz")     return <TikZRenderer code={codeContent} />;
        // if (lang === "geogebra") return <GeoGebraEmbed commands={codeContent} />;
        // if (lang === "three")    return <ThreeRenderer spec={codeContent} />;
        return (
          <span className="text-xs text-muted-foreground italic">
            [Vizualizare disponibilă curând în bibliotecă]
          </span>
        );
      }

      // Other fenced code blocks
      if (className?.includes("language-")) {
        return (
          <code className="block text-sm font-mono">
            {children}
          </code>
        );
      }

      // Inline code
      return (
        <code className="bg-muted rounded px-1 py-0.5 text-sm font-mono">
          {children}
        </code>
      );
    },

    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        {children}
      </a>
    ),
  };

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_.katex-display]:overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
