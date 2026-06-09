import { ChatSidebarPanel } from "./_components/ChatSidebarPanel";
import { ChatView } from "./_components/ChatView";
import { createServiceClient } from "@/lib/supabase/service";
import { getConceptAnchor, buildIntroMessage } from "@/lib/concepts/anchor";
import type { ChatMessage } from "./_components/ChatMessages";

export const dynamic = "force-dynamic";

/**
 * /app/chat — chat nou; cu ?concept=<slug> devine SESIUNE ANCORATĂ în concept
 * (ETAPA 60 PAS 5): primul mesaj al asistentului = intro din teoria grafului +
 * primul exercițiu VERIFICAT (template determinist, zero LLM).
 */
export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string }>;
}) {
  const { concept: conceptSlug } = await searchParams;

  let initialMessages: ChatMessage[] | undefined;
  let anchorSlug: string | undefined;

  if (conceptSlug) {
    const service = createServiceClient();
    const anchor = await getConceptAnchor(service, conceptSlug);
    if (anchor) {
      anchorSlug = anchor.slug;
      initialMessages = [
        {
          id: `concept-intro-${anchor.slug}`,
          role: "assistant",
          content: buildIntroMessage(anchor),
        },
      ];
    } else {
      console.error(`[chat] concept inexistent în graf, sesiune ne-ancorată: ${conceptSlug}`);
    }
  }

  return (
    <>
      <ChatSidebarPanel />
      <ChatView initialMessages={initialMessages} conceptSlug={anchorSlug} />
    </>
  );
}
