"use client";

/**
 * LessonOrChat — ETAPA 67 FAZA C: comutatorul dintre player-ul de lecție și chat.
 *
 * Study mode + ancoră de concept → LessonPlayer (calea NOUĂ).
 * Solve mode sau chat liber → ChatView EXACT ca înainte (neatins, fallback).
 * Eșecul streamului structurat sau „chat liber" → ChatView cu intro-ul ancorat.
 */
import { useState } from "react";
import { ChatView } from "./ChatView";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { useChatModeStore } from "@/lib/stores/chat-mode-store";
import type { ChatMessage } from "./ChatMessages";

interface Props {
  conceptSlug?: string;
  initialMessages?: ChatMessage[];
  streak: number;
  /** ETAPA 71 D: cheia domeniului — accentul lecției poartă culoarea lui */
  domainKey?: string | null;
}

export function LessonOrChat({ conceptSlug, initialMessages, streak, domainKey }: Props) {
  const { mode } = useChatModeStore();
  const [forceChat, setForceChat] = useState(false);

  if (conceptSlug && mode === "study" && !forceChat) {
    return (
      <LessonPlayer
        conceptSlug={conceptSlug}
        streak={streak}
        domainKey={domainKey ?? null}
        onFallback={() => setForceChat(true)}
        onExitToChat={() => setForceChat(true)}
      />
    );
  }
  return <ChatView initialMessages={initialMessages} conceptSlug={conceptSlug} />;
}
