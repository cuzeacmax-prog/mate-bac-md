/**
 * /admin/lectii — ETAPA 75 FAZA B4: REVIZUIREA PROFESORULUI.
 * Lista lecțiilor canonice (status, model, concept); click → preview în
 * player-preview read-only + butonul Aprobă. Badge-ul „verificată de profesor"
 * apare la elev DOAR după aprobare — niciodată implicit.
 */
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function AdminLectiiPage() {
  const svc = createServiceClient();
  const { data: lessons, error } = await svc
    .from("lesson_canonical")
    .select("id, concept_id, version, status, model, generated_at, observatii, concepts(name, slug)")
    .order("generated_at", { ascending: false });
  if (error) {
    return <div className="p-6 text-red-600">Eroare: {error.message}</div>;
  }
  const rows = (lessons ?? []) as unknown as Array<{
    id: string; version: number; status: string; model: string; generated_at: string;
    observatii: string | null;
    concepts: { name: string; slug: string } | null;
  }>;
  const approved = rows.filter((r) => r.status === "aprobat-profesor").length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Lecții canonice</h1>
      <p className="text-sm text-gray-600">
        {rows.length} lecții generate · {approved} aprobate. Aprobarea aprinde badge-ul
        «Lecție verificată de profesor» la elev.
      </p>
      <div className="bg-white rounded-xl border divide-y">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/admin/lectii/${r.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {r.concepts?.name ?? "(concept șters)"}
              </p>
              <p className="text-xs text-gray-500">
                {r.concepts?.slug} · v{r.version} · {r.model} ·{" "}
                {new Date(r.generated_at).toLocaleDateString("ro-MD")}
                {r.observatii ? " · are observații" : ""}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                r.status === "aprobat-profesor"
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {r.status === "aprobat-profesor" ? "✓ aprobată" : "de revizuit"}
            </span>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-500">
            Nicio lecție canonică încă — rulează scripts/etapa75/generate-canonical-lessons.ts.
          </p>
        )}
      </div>
    </div>
  );
}
