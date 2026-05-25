"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/lib/hooks/useChat";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { ModeToggle } from "@/components/chat/ModeToggle";
import { useChatModeStore } from "@/lib/stores/chat-mode-store";
import type { ChatMessage } from "./ChatMessages";

interface Props {
  conversationId?: string;
  initialMessages?: ChatMessage[];
}

export function ChatView({ conversationId, initialMessages }: Props) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const { mode } = useChatModeStore();

  const { messages, streamingContent, isStreaming, error, sendMessage } = useChat({
    conversationId,
    initialMessages,
    mode,
    onRateLimit: () => setShowRateLimitModal(true),
    onConversationCreated: (id) => {
      router.replace(`/app/chat/${id}`, { scroll: false });
    },
  });

  async function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");
    await sendMessage(text);
  }

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
      {/* Mode toggle header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm shrink-0">
        <span className="text-xs text-muted-foreground font-medium">Profesor Maxim — BAC MD</span>
        <ModeToggle />
      </div>

      <ChatMessages
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
      />

      {error && (
        <div className="px-4 pb-2">
          <p className="text-sm text-destructive text-center">{error}</p>
        </div>
      )}

      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={isStreaming}
      />

      {showRateLimitModal && (
        <RateLimitModal onClose={() => setShowRateLimitModal(false)} />
      )}
    </div>
  );
}

function RateLimitModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
        <h2 className="text-lg font-semibold">Limita lunară atinsă</h2>
        <p className="text-sm text-muted-foreground">
          Ai folosit cele 30 de mesaje gratuite pentru această lună. Upgradează
          la Premium pentru conversații nelimitate.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border rounded-lg px-4 py-2 text-sm hover:bg-accent"
          >
            Mai târziu
          </button>
          <a
            href="/app/upgrade"
            className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm text-center font-medium hover:bg-primary/90"
          >
            Upgrade — 149 lei/lună
          </a>
        </div>
      </div>
    </div>
  );
}
