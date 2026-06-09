import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIX = "/app";
const AUTH_PREFIX = "/auth";

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // ETAPA 66 FAZA E3: redirectul userilor logați de pe landing s-a mutat AICI
  // din app/page.tsx, ca pagina / să rămână STATICĂ (○) — fără cookies în page.
  if (pathname === "/" && user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();
    const dest = request.nextUrl.clone();
    dest.pathname = profile?.onboarding_completed ? "/app" : "/onboarding/welcome";
    return NextResponse.redirect(dest);
  }

  if (pathname.startsWith(PROTECTED_PREFIX) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith(AUTH_PREFIX) && user) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/app";
    return NextResponse.redirect(appUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
