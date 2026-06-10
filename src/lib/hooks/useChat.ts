"use client";

import { useState, useCallback } from "react";
import { feedSse } from "@/lib/chat/sse";
import type { ChatMessage, ChatMetadata } from "@/app/app/chat/_components/ChatMessages";

interface UseChatOptions {
  conversationId?: string;
  initialMessages?: ChatMessage[];
  mode?: 'study' | 'solve';
  /** ETAPA 60: sesiune ancorată într-un concept din graf (slug) */
  conceptSlug?: string;
  onRateLimit?: () => void;
  onConversationCreated?: (id: string) => void;
}

export function useChat({
  conversationId: initialConvId,
  initialMessages = [],
  mode = 'study',
  conceptSlug,
  onRateLimit,
  onConversationCreated,
}: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | undefined>(initialConvId);

  const sendMessage = useCallback(
    /** ETAPA 70 D: opts.help — chip de ajutor pe exercițiul activ */
    async (text: string, opts?: { help?: { kind: 'start' | 'hint' | 'solution'; level?: number } }) => {
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
          body: JSON.stringify({
            message: text,
            conversationId: convId,
            mode,
            concept: conceptSlug,
            ...(opts?.help ? { help: opts.help } : {}),
          }),
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

        // Capture conversation ID from header but don't navigate yet —
        // router.replace during streaming would unmount ChatView and lose messages
        const newConvId = res.headers.get("X-Conversation-Id");
        if (newConvId && newConvId !== convId) {
          setConvId(newConvId);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Nu am putut citi răspunsul.");

        const decoder = new TextDecoder();
        let accumulated = "";
        // ETAPA 72 P2: bufferul SSE se POARTĂ între read-uri — un eveniment
        // tăiat la graniță de chunk nu se mai pierde (cauza mesajelor dispărute)
        let sseBuffer = "";
        let committed = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const fed = feedSse(sseBuffer, decoder.decode(value, { stream: true }));
          sseBuffer = fed.buffer;

          for (const json of fed.events) {
            if (json.ping) continue; // heartbeat inițial
            if (json.error) {
              // Eroare explicită din server — surfacează în UI
              throw new Error(json.error as string);
            }
            if (json.text) {
              accumulated += json.text as string;
              setStreamingContent(accumulated);
            }
            if (json.done) {
              const meta = json.metadata as ChatMetadata | undefined;
              const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: accumulated,
                svgs: meta?.svgs ?? [],
                metadata: meta,
              };
              committed = true;
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingContent("");
              // Navigate only after streaming completes — server has saved messages by now
              if (newConvId) {
                onConversationCreated?.(newConvId);
              }
            }
            // ETAPA 63: verdictul încercării sosește DUPĂ done — patch pe
            // metadata ultimului mesaj al ELEVULUI (feedback discret sub mesaj).
            if (json.attempt) {
              const attempt = json.attempt as NonNullable<ChatMetadata["attempt"]>;
              setMessages((prev) => {
                const next = [...prev];
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].role === "user") {
                    next[i] = {
                      ...next[i],
                      metadata: { ...(next[i].metadata ?? {}), attempt } as ChatMetadata,
                    };
                    break;
                  }
                }
                return next;
              });
            }
            // ETAPA 59 (P5): verificarea sosește DUPĂ done, ca eveniment separat —
            // patch pe metadata ultimului mesaj de asistent, fără să blocheze UI-ul.
            if (json.verification) {
              const verification = json.verification as NonNullable<ChatMetadata["verification"]>;
              setMessages((prev) => {
                const next = [...prev];
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].role === "assistant") {
                    next[i] = {
                      ...next[i],
                      metadata: { ...(next[i].metadata ?? {}), verification } as ChatMetadata,
                    };
                    break;
                  }
                }
                return next;
              });
            }
          }
        }

        // ETAPA 72 P2: plasă de siguranță — dacă done nu a sosit (stream rupt),
        // textul acumulat NU dispare: se comite ca mesaj (serverul l-a salvat)
        if (!committed && accumulated) {
          console.error("[useChat] stream încheiat fără done — comit textul acumulat");
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: accumulated },
          ]);
          if (newConvId) onConversationCreated?.(newConvId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Eroare necunoscută");
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [convId, mode, conceptSlug, isStreaming, onRateLimit, onConversationCreated]
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
