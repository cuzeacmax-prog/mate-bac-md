import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedbackButtons } from "./FeedbackButtons";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
};

export default async function AdminConversationPage({
  params,
}: {
  params: { id: string };
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const [{ data: conv }, { data: messages }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, created_at, profiles(email, full_name)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  if (!conv) notFound();

  const conversation = conv as Conversation;
  const msgs = (messages ?? []) as Message[];

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/conversations"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Conversații
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {conversation.title ?? "(fără titlu)"}
          </h1>
          <p className="text-sm text-gray-500">
            {conversation.profiles?.email ?? "utilizator necunoscut"} •{" "}
            {new Date(conversation.created_at).toLocaleDateString("ro-MD", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {msgs.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-900"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.role === "assistant" && (
                <FeedbackButtons messageId={msg.id} />
              )}
            </div>
          </div>
        ))}
        {msgs.length === 0 && (
          <p className="text-center text-gray-400 py-12">
            Niciun mesaj în această conversație.
          </p>
        )}
      </div>
    </div>
  );
}
