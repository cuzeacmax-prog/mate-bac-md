import { ChatSidebarPanel } from "./_components/ChatSidebarPanel";
import { LessonOrChat } from "./_components/LessonOrChat";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getConceptAnchor, buildIntroMessage } from "@/lib/concepts/anchor";
import { chisinauToday, computeStreak } from "@/lib/daily/daily";
import { domainKeyForSlug } from "@/lib/map/layouts";
import type { ChatMessage } from "./_components/ChatMessages";

export const metadata = { title: "Lecție și chat · Profesor Maxim" };

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

  // ETAPA 67 FAZA C: streak-ul pentru micro-celebrarea din player
  let streak = 0;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) streak = await computeStreak(createServiceClient(), user.id, chisinauToday());
  } catch { /* streak e decorativ aici */ }

  // ETAPA 71 D: culoarea domeniului curge în player (server-side lookup)
  const domainKey = anchorSlug ? domainKeyForSlug(anchorSlug) : null;

  return (
    <>
      <ChatSidebarPanel />
      <LessonOrChat
        initialMessages={initialMessages}
        conceptSlug={anchorSlug}
        streak={streak}
        domainKey={domainKey}
      />
    </>
  );
}
