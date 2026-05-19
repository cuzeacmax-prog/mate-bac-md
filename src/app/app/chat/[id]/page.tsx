import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatSidebarPanel } from "../_components/ChatSidebarPanel";
import { ChatView } from "../_components/ChatView";
import type { ChatMessage } from "../_components/ChatMessages";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (!conversation || conversation.user_id !== user.id) notFound();

  const { data: rawMessages } = await supabase
    .from("messages")
    .select("id, role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const messages: ChatMessage[] = ((rawMessages ?? []) as { id: string; role: string; content: string | null }[])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));

  return (
    <>
      <ChatSidebarPanel activeId={id} />
      <ChatView conversationId={id} initialMessages={messages} />
    </>
  );
}
