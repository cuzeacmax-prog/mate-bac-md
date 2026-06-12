import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWelcomeOnce } from "@/lib/notify/email-cron";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` is set by the OAuth redirect (e.g. /onboarding/diagnostic-intro)
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If the caller specified a destination, honour it (onboarding flow)
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // Otherwise decide based on onboarding completion
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // ETAPA 78 C1: BUN VENIT la prima confirmare a contului — idempotent
        // (notifications_log), iar un email eșuat nu blochează login-ul
        try {
          await sendWelcomeOnce(createServiceClient(), user.id);
        } catch (err) {
          console.error("[auth/callback] welcome email failed:", err instanceof Error ? err.message : err);
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        if (profile?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/app`);
        } else {
          return NextResponse.redirect(`${origin}/onboarding/welcome`);
        }
      }

      return NextResponse.redirect(`${origin}/app`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
