import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ConvRow = {
  id: string;
  title: string | null;
  created_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
};

export default async function AdminConversationsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, profiles(email, full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <p className="text-red-500">Eroare: {error.message}</p>;
  }

  const rows = (conversations ?? []) as ConvRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        Toate conversațiile ({rows.length})
      </h1>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Utilizator</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Titlu</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Data</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((conv) => (
              <tr key={conv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">
                  {conv.profiles?.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                  {conv.title ?? "(fără titlu)"}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(conv.created_at).toLocaleDateString("ro-MD", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/conversations/${conv.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Deschide
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Nicio conversație găsită.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
