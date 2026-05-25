"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MessageRenderer } from "./MessageRenderer";
import { BlockSelectableMessage } from "@/components/chat/BlockSelectableMessage";
import { VoicePlayer } from "@/components/chat/VoicePlayer";
import { VerificationBadge } from "@/components/chat/VerificationBadge";
import type { ChatMetadata } from "./ChatMessages";

interface Props {
  role: "user" | "assistant";
  content: string;
  /** Unique stable ID for this message (for interaction store keying) */
  messageId?: string;
  isStreaming?: boolean;
  /** SVG-uri generate de tool use */
  svgs?: string[];
  /** Metadata din backend (method, verification, etc.) */
  metadata?: ChatMetadata;
}

export const MessageBubble = React.memo(function MessageBubble({
  role,
  content,
  messageId,
  isStreaming,
  svgs,
  metadata,
}: Props) {
  const isUser = role === "user";
  const hasSvgs = !isUser && Array.isArray(svgs) && svgs.length > 0;
  const showInteractive = !isUser && !isStreaming && !!messageId;

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
        {/* ── User message ─────────────────────────────────────── */}
        {isUser && (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        )}

        {/* ── Assistant message ────────────────────────────────── */}
        {!isUser && (
          <>
            {showInteractive ? (
              <BlockSelectableMessage
                messageId={messageId!}
                content={content}
                isStreaming={isStreaming}
              />
            ) : (
              <MessageRenderer content={content} isStreaming={isStreaming} />
            )}

            {/* SVG-uri geometrice */}
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

            {/* ── Footer: verification badge + voice player ────── */}
            {!isStreaming && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {metadata?.verification && (
                  <VerificationBadge verification={metadata.verification} />
                )}
                <VoicePlayer text={content} voice="nova" />
              </div>
            )}
          </>
        )}

        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current opacity-70 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
});
