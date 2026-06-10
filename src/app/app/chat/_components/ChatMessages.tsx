"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { MessageErrorBoundary } from "@/components/chat/MessageErrorBoundary";

export interface VerificationMeta {
  isCorrect: boolean;
  confidence: number;
}

/** ETAPA 63: verdictul evaluării încercării elevului (chat ancorat) */
export interface AttemptMeta {
  /** null = evaluat fără verdict de încredere (mastery neatins) */
  correct: boolean | null;
  method: "determinist" | "judecator";
  confidence: number;
}

export interface ChatMetadata {
  method_used?: string | null;
  method_similarity?: number | null;
  exercises_matched?: number;
  isMulti?: boolean;
  exerciseCount?: number;
  svgs?: string[];
  /** Verificare matematică silențioasă (Haiku) */
  verification?: VerificationMeta | null;
  /** ETAPA 63: verdictul încercării (atașat mesajului elevului) */
  attempt?: AttemptMeta | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** SVG-uri generate de tool use (figuri geometrice, grafice) */
  svgs?: string[];
  metadata?: ChatMetadata;
}

interface Props {
  messages: ChatMessage[];
  streamingContent?: string;
  isStreaming?: boolean;
}

export function ChatMessages({ messages, streamingContent, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground px-4 text-center">
        <p className="text-2xl">🎯</p>
        <p className="font-medium">Bun venit! Sunt Profesor Maxim.</p>
        <p className="text-sm max-w-sm">
          Pune-mi orice întrebare despre matematica BAC — de la algebră și analiză
          până la geometrie și statistică.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg) => (
        // ETAPA 72 P2: boundary PER MESAJ — un mesaj care crapă cade pe
        // fallback (text brut), restul conversației rămâne intact
        <MessageErrorBoundary key={msg.id} rawContent={msg.content}>
          <MessageBubble
            messageId={msg.id}
            role={msg.role}
            content={msg.content}
            svgs={msg.svgs}
            metadata={msg.metadata}
          />
        </MessageErrorBoundary>
      ))}
      {isStreaming && streamingContent !== undefined && (
        <MessageBubble
          role="assistant"
          content={streamingContent || ""}
          isStreaming
        />
      )}
      {isStreaming && !streamingContent && (
        <div className="flex justify-start">
          <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
            <div className="flex gap-1 items-center">
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
