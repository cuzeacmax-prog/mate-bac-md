import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (profile?.subscription_status !== "admin") redirect("/app");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <span className="font-semibold text-gray-900">Admin</span>
        <Link href="/admin/conversations" className="text-sm text-gray-600 hover:text-gray-900">
          Conversații
        </Link>
        <Link href="/admin/feedback" className="text-sm text-gray-600 hover:text-gray-900">
          Feedback
        </Link>
        <Link href="/admin/metrics" className="text-sm text-gray-600 hover:text-gray-900">
          Metrici
        </Link>
        <Link href="/admin/test-construction" className="text-sm text-gray-600 hover:text-gray-900">
          Test Constr.
        </Link>
        <Link href="/admin/library/review" className="text-sm text-gray-600 hover:text-gray-900">
          Library
        </Link>
        <Link href="/admin/health" className="text-sm text-gray-600 hover:text-gray-900">
          Health
        </Link>
        <Link href="/admin/library/preview" className="text-sm text-gray-600 hover:text-gray-900">
          Preview
        </Link>
        <Link href="/admin/methodologies" className="text-sm text-gray-600 hover:text-gray-900">
          Metodologii
        </Link>
        <Link href="/admin/graf" className="text-sm text-gray-600 hover:text-gray-900">
          Graf
        </Link>
        <Link href="/admin/continut" className="text-sm text-gray-600 hover:text-gray-900">
          Conținut
        </Link>
        <Link href="/admin/figuri" className="text-sm text-gray-600 hover:text-gray-900">
          Figuri
        </Link>
        <Link href="/admin/verificare" className="text-sm text-gray-600 hover:text-gray-900">
          Verificare
        </Link>
        <Link href="/admin/figuri-revizie" className="text-sm text-gray-600 hover:text-gray-900">
          Figuri-revizie
        </Link>
        <Link href="/admin/figuri-3d" className="text-sm text-gray-600 hover:text-gray-900">
          Figuri-3D
        </Link>
        <Link href="/admin/figura-live" className="text-sm text-gray-600 hover:text-gray-900">
          Figură-live
        </Link>
        <Link href="/admin/figura-autor" className="text-sm text-gray-600 hover:text-gray-900">
          Figură-autor
        </Link>
        <Link href="/app" className="text-sm text-gray-600 hover:text-gray-900 ml-auto">
          ← App
        </Link>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
