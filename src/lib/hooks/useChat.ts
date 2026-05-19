"use client";

import { useState, useCallback } from "react";
import type { ChatMessage } from "@/app/app/chat/_components/ChatMessages";

interface UseChatOptions {
  conversationId?: string;
  initialMessages?: ChatMessage[];
  onRateLimit?: () => void;
  onConversationCreated?: (id: string) => void;
}

export function useChat({
  conversationId: initialConvId,
  initialMessages = [],
  onRateLimit,
  onConversationCreated,
}: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | undefined>(initialConvId);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setStreamingContent("");
      setIsStreaming(true);
      setError(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, conversationId: convId }),
        });

        if (res.status === 429) {
          onRateLimit?.();
          setIsStreaming(false);
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        const newConvId = res.headers.get("X-Conversation-Id");
        if (newConvId && newConvId !== convId) {
          setConvId(newConvId);
          onConversationCreated?.(newConvId);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Nu am putut citi răspunsul.");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const raw = decoder.decode(value, { stream: true });
          const lines = raw.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const json = JSON.parse(line.slice(6));
              if (json.error) throw new Error(json.error);
              if (json.text) {
                accumulated += json.text;
                setStreamingContent(accumulated);
              }
              if (json.done) {
                const assistantMsg: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: accumulated,
                };
                setMessages((prev) => [...prev, assistantMsg]);
                setStreamingContent("");
              }
            } catch {
              // Partial chunk — ignore
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Eroare necunoscută");
        // Remove optimistic user message on fatal error
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [convId, isStreaming, onRateLimit, onConversationCreated]
  );

  return {
    messages,
    streamingContent,
    isStreaming,
    error,
    convId,
    sendMessage,
  };
}
