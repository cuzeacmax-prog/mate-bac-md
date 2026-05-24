"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MessageRenderer } from "./MessageRenderer";

interface Props {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  /** SVG-uri generate de tool use (figuri geometrice, grafice) */
  svgs?: string[];
}

export const MessageBubble = React.memo(function MessageBubble({ role, content, isStreaming, svgs }: Props) {
  const isUser = role === "user";
  const hasSvgs = !isUser && Array.isArray(svgs) && svgs.length > 0;

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <>
            <MessageRenderer content={content} isStreaming={isStreaming} />
            {hasSvgs && (
              <div className="mt-3 space-y-3">
                {svgs!.map((svg, idx) => (
                  <div
                    key={idx}
                    className="border border-border rounded-lg p-2 bg-background overflow-x-auto"
                    // SVG-uri vin exclusiv de la backend (Railway TikZ service) — trusted
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current opacity-70 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
});
