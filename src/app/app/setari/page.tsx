import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveGoal } from "@/lib/profile/goal";
import { NotifSettings } from "./NotifSettings";
import { ParentEmail } from "./ParentEmail";
import { ClassGoal } from "./ClassGoal";

/**
 * ETAPA 78 B2 — setările notificărilor: o pagină simplă cu toggle-uri per tip.
 * Promisiunea de bun-simț e scrisă negru pe alb: max 1 push/zi, liniște 21–09,
 * opt-out la un click.
 */
export const metadata = { title: "Setări — Profesor Maxim" };

export default async function SetariPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("notification_preferences, parent_email, grade_level, goal, target_bac_score")
    .eq("id", user.id)
    .maybeSingle();
  const prefs = (profile?.notification_preferences ?? {}) as {
    streak_reminders?: boolean;
    daily_challenge?: boolean;
    email?: boolean;
  };

  return (
    <div className="max-w-[640px] mx-auto px-6 py-10 space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-semibold">Setări</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Notificările sunt servitori, nu spam: maximum un push pe zi, liniște
          între 21:00 și 09:00, și le oprești oricând de aici.
        </p>
      </div>
      <ClassGoal
        initialGrade={(profile?.grade_level as number | null) ?? null}
        initialGoal={resolveGoal(profile?.goal)}
      />
      <NotifSettings
        initialPrefs={{
          streak_reminders: prefs.streak_reminders !== false,
          daily_challenge: prefs.daily_challenge === true,
          email: prefs.email !== false,
        }}
      />
      <ParentEmail initial={profile?.parent_email ?? ""} />
    </div>
  );
}
