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
  /** ETAPA 60: sesiune ancorată într-un concept din graf (slug) */
  conceptSlug?: string;
  /** ETAPA 78 E: exercițiul ales din /app/exercitii — pre-încărcat */
  exerciseId?: string;
}

export function ChatView({ conversationId, initialMessages, conceptSlug, exerciseId }: Props) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const { mode } = useChatModeStore();

  const { messages, streamingContent, isStreaming, error, sendMessage } = useChat({
    conversationId,
    initialMessages,
    mode,
    conceptSlug,
    exerciseId,
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

  // ETAPA 70 D: chips de ajutor sub exercițiul activ (doar în sesiunea ancorată);
  // fiecare chip = un mesaj din cota existentă
  const [hintLevel, setHintLevel] = useState(0);
  async function sendHelp(kind: "start" | "hint" | "solution") {
    if (isStreaming) return;
    if (kind === "start") {
      await sendMessage("Nu știu cum să încep.", { help: { kind } });
    } else if (kind === "hint") {
      const level = Math.min(hintLevel + 1, 3);
      setHintLevel(level);
      await sendMessage(`Dă-mi un indiciu (${level}/3).`, { help: { kind, level } });
    } else {
      await sendMessage("Arată-mi rezolvarea completă.", { help: { kind } });
    }
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

      {conceptSlug && (
        <div className="px-4 pb-1.5 flex flex-wrap gap-2 justify-center shrink-0">
          <HelpChip onClick={() => sendHelp("start")} disabled={isStreaming}>
            Nu știu cum să încep
          </HelpChip>
          <HelpChip onClick={() => sendHelp("hint")} disabled={isStreaming || hintLevel >= 3}>
            💡 Dă-mi un indiciu {hintLevel > 0 ? `(${Math.min(hintLevel + 1, 3)}/3)` : "(1/3)"}
          </HelpChip>
          <HelpChip onClick={() => sendHelp("solution")} disabled={isStreaming}>
            Arată-mi rezolvarea
          </HelpChip>
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

function HelpChip({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-primary/30 bg-primary/5 text-primary px-3.5 py-1.5 text-xs font-medium hover:bg-primary/10 active:scale-95 transition disabled:opacity-40 disabled:cursor-default"
    >
      {children}
    </button>
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
            href="/app/abonament"
            className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm text-center font-medium hover:bg-primary/90"
          >
            Vezi abonamentul →
          </a>
        </div>
      </div>
    </div>
  );
}
