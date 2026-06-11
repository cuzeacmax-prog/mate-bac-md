/**
 * /app/harta — ETAPA 71 FAZA B: HARTA CUNOAȘTERII (ecranul-emblemă).
 * Server component: UN singur fetch agregat (getKnowledgeMap — layout
 * precomputat + stări din mastery/frontieră + focus + țintă). ZERO LLM.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getKnowledgeMap } from "@/lib/map/state";
import { MapView, MapErrorBoundary } from "./MapView";

export const dynamic = "force-dynamic";

export default async function HartaPage({
  searchParams,
}: {
  searchParams: Promise<{ tinta?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // proxy-ul redirectează

  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("grade_level")
    .eq("id", user.id)
    .maybeSingle();
  const grade = (profileRow?.grade_level as number | null) ?? 12;

  // ETAPA 76 F1: ?tinta=<slug> — venirea din lecție face pan animat pe nod
  const { tinta } = await searchParams;
  const map = await getKnowledgeMap(createServiceClient(), user.id, grade);
  return (
    <MapErrorBoundary>
      <MapView map={map} tinta={tinta ?? null} />
    </MapErrorBoundary>
  );
}
