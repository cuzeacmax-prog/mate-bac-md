import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import { NewChatButton } from "./NewChatButton";

interface Props {
  activeId?: string;
}

export async function ChatSidebarPanel({ activeId }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(30);

  return (
    <aside className="w-64 shrink-0 border-r flex flex-col h-full bg-background">
      <div className="p-3 border-b">
        <NewChatButton />
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {((conversations ?? []) as { id: string; title: string | null }[]).map((conv) => (
          <Link
            key={conv.id}
            href={`/app/chat/${conv.id}`}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm truncate transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              activeId === conv.id && "bg-accent text-accent-foreground font-medium"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate">{conv.title ?? "Conversație"}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
