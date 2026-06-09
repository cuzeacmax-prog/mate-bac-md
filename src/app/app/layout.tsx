import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { chisinauToday, computeStreak } from "@/lib/daily/daily";
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
    .select("full_name, email, subscription_status")
    .eq("id", user.id)
    .single()) as unknown as {
    data: {
      full_name: string | null;
      email: string | null;
      subscription_status: string | null;
    } | null;
    error: unknown;
  };

  const isAdmin = profile?.subscription_status === "admin";
  const isPremium =
    profile?.subscription_status === "premium" ||
    (profile?.subscription_status ?? "").startsWith("family");

  // Citim contorul real din rate_limits (sursa de adevăr), nu din profiles
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const { data: rateRow } = (await supabase
    .from("rate_limits")
    .select("message_count")
    .eq("user_id", user.id)
    .eq("period_type", "monthly")
    .gte("period_start", periodStart.toISOString())
    .maybeSingle()) as unknown as {
    data: { message_count: number | null } | null;
    error: unknown;
  };

  const messagesUsed = rateRow?.message_count ?? 0;

  // ETAPA 14: streak-ul calculat server-side din streak_log (zero LLM)
  let streak = 0;
  try {
    streak = await computeStreak(createServiceClient(), user.id, chisinauToday());
  } catch (err) {
    console.error("[app/layout] streak failed:", err instanceof Error ? err.message : err);
  }

  return (
    <div className="flex flex-col h-screen">
      <Header
        userEmail={profile?.email ?? user.email ?? null}
        userName={profile?.full_name ?? null}
        messagesUsed={messagesUsed}
        isPremium={isPremium}
        isAdmin={isAdmin}
        streak={streak}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
