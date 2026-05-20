import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type FeedbackRow = {
  id: string;
  rating: "good" | "bad" | "needs_improvement";
  ideal_response: string | null;
  notes: string | null;
  created_at: string;
  messages: {
    id: string;
    content: string;
    conversation_id: string;
  } | null;
};

const ratingLabel: Record<string, string> = {
  good: "✅ Bun",
  bad: "❌ Greșit",
  needs_improvement: "⚠️ De îmbunătățit",
};

const ratingColor: Record<string, string> = {
  good: "bg-green-100 text-green-800",
  bad: "bg-red-100 text-red-800",
  needs_improvement: "bg-yellow-100 text-yellow-800",
};

export default async function AdminFeedbackPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: rows, error } = await supabase
    .from("admin_feedback")
    .select("id, rating, ideal_response, notes, created_at, messages(id, content, conversation_id)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <p className="text-red-500">Eroare: {error.message}</p>;
  }

  const feedback = (rows ?? []) as FeedbackRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        Feedback salvat ({feedback.length})
      </h1>

      <div className="space-y-4">
        {feedback.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <span
                className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${
                  ratingColor[item.rating] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {ratingLabel[item.rating] ?? item.rating}
              </span>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>
                  {new Date(item.created_at).toLocaleDateString("ro-MD", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {item.messages?.conversation_id && (
                  <Link
                    href={`/admin/conversations/${item.messages.conversation_id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Vezi conversația →
                  </Link>
                )}
              </div>
            </div>

            <div className="text-sm text-gray-700 mb-2">
              <span className="font-medium text-gray-500">Răspuns AI: </span>
              <span className="italic line-clamp-2">
                {item.messages?.content
                  ? item.messages.content.slice(0, 200) + (item.messages.content.length > 200 ? "..." : "")
                  : "—"}
              </span>
            </div>

            {item.ideal_response && (
              <div className="text-sm text-gray-700 mb-2">
                <span className="font-medium text-gray-500">Răspuns ideal: </span>
                <span className="whitespace-pre-wrap">{item.ideal_response}</span>
              </div>
            )}

            {item.notes && (
              <div className="text-sm text-gray-500">
                <span className="font-medium">Notițe: </span>
                {item.notes}
              </div>
            )}
          </div>
        ))}

        {feedback.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            Niciun feedback salvat încă. Deschide o conversație și marchează răspunsurile.
          </div>
        )}
      </div>
    </div>
  );
}
