import { createServiceClient } from "@/lib/supabase/service";
import FiguraAutorPanel, { type AutorItem } from "./FiguraAutorPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bucla de autorat" };

type Row = Record<string, unknown>;

export default async function FiguraAutorPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("figura_autor")
    .select("id, slug, condition, desired_kind, desired_ref, input_kind, gates, render_png, status, verdict_uman, remarci, iteratii, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const items: AutorItem[] = (data as Row[] ?? []).map((r) => ({
    id: r.id as string,
    slug: (r.slug as string) ?? "",
    condition: (r.condition as string) ?? "",
    desiredKind: (r.desired_kind as string | null) ?? null,
    desiredRef: (r.desired_ref as string | null) ?? null,
    inputKind: (r.input_kind as string | null) ?? null,
    gates: (r.gates as AutorItem["gates"]) ?? null,
    renderPng: (r.render_png as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    verdict: (r.verdict_uman as string | null) ?? null,
    remarci: (r.remarci as AutorItem["remarci"]) ?? null,
    iteratii: (r.iteratii as number | null) ?? 1,
  }));

  return <FiguraAutorPanel items={items} />;
}
