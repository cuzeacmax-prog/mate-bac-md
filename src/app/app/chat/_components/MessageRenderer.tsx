"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm"; // ETAPA 67 D2: tabele markdown în chatul liber
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";
import { KATEX_MACROS } from "@/lib/content/katex-macros";

// Limbajele viz din mesaje sunt servite din bibliotecă (SVG static), nu randate client-side.
// Componentele TikZRenderer/GeoGebraEmbed/ThreeRenderer au fost șterse în ETAPA 59 (cod mort).
const VIZ_LANGS = new Set(["tikz", "geogebra", "three"]);

interface Props {
  content: string;
  isStreaming?: boolean;
}

/**
 * ETAPA 66 FAZA E1: împarte markdown-ul în blocuri STABILE (paragrafe),
 * fără să rupă code fence-urile (```) sau display math ($$...$$).
 * Pur — testat în tests/chat/split-blocks.test.ts.
 */
export function splitMarkdownBlocks(content: string): string[] {
  const lines = content.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let inMath = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const doubleDollars = (line.match(/\$\$/g) ?? []).length;
    if (doubleDollars % 2 === 1) inMath = !inMath;
    if (!inFence && !inMath && line.trim() === "") {
      if (current.length) {
        blocks.push(current.join("\n"));
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

/** contor de randări pe blocuri — dovada memoizării în teste (E1) */
export const __blockRenderCounter = { count: 0 };

// KaTeX options — throwOnError:false prevents raw LaTeX from leaking when formula fails
const KATEX_OPTIONS = {
  throwOnError: false,
  strict: false,
  trust: false,
  // ETAPA 74 B2: aceleași macro-uri ca MathText (modul partajat)
  macros: KATEX_MACROS,
};

// Componentele de override sunt la NIVEL DE MODUL (referințe stabile) —
// altfel React.memo pe blocuri n-ar avea efect.
function makeComponents(isStreaming: boolean): Components {
  return {
    // pre handles block code — intercepts visualization languages before the prose wrapper
    pre: ({ children }) => {
      const childArray = React.Children.toArray(children);
      if (childArray.length === 1) {
        const child = childArray[0];
        if (React.isValidElement(child)) {
          if (typeof child.type !== "string") {
            return <>{children}</>;
          }
          if (child.type === null) {
            return null;
          }
        }
      }
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

      if (VIZ_LANGS.has(lang)) {
        if (isStreaming) return null;
        return (
          <span className="text-xs text-muted-foreground italic">
            [Vizualizare disponibilă curând în bibliotecă]
          </span>
        );
      }

      if (className?.includes("language-")) {
        return (
          <code className="block text-sm font-mono">
            {children}
          </code>
        );
      }

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
}

const COMPONENTS_STATIC = makeComponents(false);
const COMPONENTS_STREAMING = makeComponents(true);

/**
 * ETAPA 66 FAZA E1: un bloc COMPLET se parsează și se randează O DATĂ
 * (React.memo pe conținut); la streaming doar blocul-coadă se re-randează
 * per chunk. Înainte: TOT mesajul trecea prin ReactMarkdown+KaTeX la fiecare chunk.
 */
const MarkdownBlock = React.memo(function MarkdownBlock({ content }: { content: string }) {
  // instrumentare de test (dovada E1) — efect deliberat, inofensiv la randare dublă
  // eslint-disable-next-line react-hooks/immutability
  __blockRenderCounter.count++;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
      components={COMPONENTS_STATIC}
    >
      {content}
    </ReactMarkdown>
  );
});

const PROSE_CLASSES = [
  "prose prose-sm dark:prose-invert max-w-none break-words",
  "[&_.katex-display]:overflow-x-auto",
  // Markdown table styles (variation tables, etc.)
  "[&_table]:border-collapse [&_table]:w-full [&_table]:text-sm [&_table]:my-3",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-center",
  "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-center",
].join(" ");

export function MessageRenderer({ content, isStreaming }: Props) {
  const blocks = useMemo(() => splitMarkdownBlocks(content), [content]);
  // ultimul bloc e „în curs" doar la streaming — restul sunt stabile (memo)
  const stableBlocks = isStreaming ? blocks.slice(0, -1) : blocks;
  const tailBlock = isStreaming && blocks.length > 0 ? blocks[blocks.length - 1] : null;

  return (
    <div className={PROSE_CLASSES}>
      {stableBlocks.map((block, i) => (
        <MarkdownBlock key={i} content={block} />
      ))}
      {tailBlock !== null && (
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
          components={COMPONENTS_STREAMING}
        >
          {tailBlock}
        </ReactMarkdown>
      )}
    </div>
  );
}
