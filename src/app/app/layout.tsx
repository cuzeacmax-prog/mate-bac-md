import { redirect } from "next/navigation";
import "katex/dist/katex.min.css"; // ETAPA 66 E2: math doar pe rutele care o randează

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { chisinauToday, computeStreak } from "@/lib/daily/daily";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { LivingBackdrop } from "@/components/motion/LivingBackdrop";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { PwaSetup } from "@/components/pwa/PwaSetup";

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

  // Citim contorul real din rate_limits (sursa de adevăr), nu din profiles
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  // ETAPA 76 E (cauza #2 din baseline: TTFB — lanț de query-uri secvențiale):
  // cele 3 interogări sunt independente → un singur round-trip logic
  const [profileRes, rateRes, streakRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, subscription_status")
      .eq("id", user.id)
      .single(),
    supabase
      .from("rate_limits")
      .select("message_count")
      .eq("user_id", user.id)
      .eq("period_type", "monthly")
      .gte("period_start", periodStart.toISOString())
      .maybeSingle(),
    computeStreak(createServiceClient(), user.id, chisinauToday()).catch((err) => {
      console.error("[app/layout] streak failed:", err instanceof Error ? err.message : err);
      return 0;
    }),
  ]);
  const profile = profileRes.data as {
    full_name: string | null;
    email: string | null;
    subscription_status: string | null;
  } | null;
  const isAdmin = profile?.subscription_status === "admin";
  const isPremium =
    profile?.subscription_status === "premium" ||
    (profile?.subscription_status ?? "").startsWith("family");
  const messagesUsed = (rateRes.data as { message_count: number | null } | null)?.message_count ?? 0;
  const streak = streakRes;

  return (
    <MotionProvider>
    <div className="flex flex-col h-screen">
      {/* ETAPA 74 A1: fundalul viu pe TOATE ecranele elevului */}
      <LivingBackdrop />
      {/* ETAPA 78 A: SW + prompt instalare discret (după momentul de valoare) */}
      <PwaSetup />
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
    </MotionProvider>
  );
}
