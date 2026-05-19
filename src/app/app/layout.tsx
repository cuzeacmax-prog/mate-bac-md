import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("full_name, email, subscription_status, messages_used_this_month")
    .eq("id", user.id)
    .single()) as unknown as {
    data: {
      full_name: string | null;
      email: string | null;
      subscription_status: string | null;
      messages_used_this_month: number | null;
    } | null;
    error: unknown;
  };

  const isPremium =
    profile?.subscription_status === "premium" ||
    (profile?.subscription_status ?? "").startsWith("family");

  return (
    <div className="flex flex-col h-screen">
      <Header
        userEmail={profile?.email ?? user.email ?? null}
        userName={profile?.full_name ?? null}
        messagesUsed={profile?.messages_used_this_month ?? 0}
        isPremium={isPremium}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
