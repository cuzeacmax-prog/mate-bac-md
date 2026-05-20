"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

const TikZRenderer = dynamic(
  () => import("@/components/chat/TikZRenderer").then((m) => ({ default: m.TikZRenderer })),
  { ssr: false }
);

const GeoGebraEmbed = dynamic(
  () => import("@/components/chat/GeoGebraEmbed").then((m) => ({ default: m.GeoGebraEmbed })),
  { ssr: false }
);

const ThreeRenderer = dynamic(
  () => import("@/components/chat/ThreeRenderer").then((m) => ({ default: m.ThreeRenderer })),
  { ssr: false }
);

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const lang = className?.replace("language-", "") ?? "";
    const content = String(children).trimEnd();

    if (lang === "tikz") return <TikZRenderer code={content} />;
    if (lang === "geogebra") return <GeoGebraEmbed commands={content} />;
    if (lang === "three") return <ThreeRenderer spec={content} />;

    if (className?.includes("language-")) {
      return (
        <code className="block bg-muted rounded p-3 text-sm font-mono overflow-x-auto">
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
};

interface Props {
  content: string;
}

export function MessageRenderer({ content }: Props) {
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
