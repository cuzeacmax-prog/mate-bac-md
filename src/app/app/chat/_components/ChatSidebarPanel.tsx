import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import { NewChatButton } from "./NewChatButton";

interface Props {
  activeId?: string;
}

/** ETAPA 73: lista de conversații curățată — grupare pe zi, titluri trunchiate */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Azi";
  if (sameDay(d, yesterday)) return "Ieri";
  return d.toLocaleDateString("ro-MD", { day: "numeric", month: "short" });
}

function cleanTitle(title: string | null): string {
  const t = (title ?? "Conversație").replace(/\s+/g, " ").trim();
  return t.length > 34 ? `${t.slice(0, 33)}…` : t;
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

  // gruparea pe zi (Azi / Ieri / dată)
  const groups: Array<{ label: string; items: { id: string; title: string | null }[] }> = [];
  for (const conv of (conversations ?? []) as { id: string; title: string | null; updated_at: string }[]) {
    const label = dayLabel(conv.updated_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(conv);
    else groups.push({ label, items: [conv] });
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col h-full glass-1 border-y-0 border-l-0">
      <div className="p-3">
        <NewChatButton />
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/app/chat/${conv.id}`}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors",
                    "text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)]",
                    activeId === conv.id && "bg-[var(--glass-3)] text-foreground font-medium"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  <span className="truncate">{cleanTitle(conv.title)}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
