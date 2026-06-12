import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, BadgeCheck, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MathText } from "@/components/MathText";
import { LayeredFigure } from "@/components/lesson/LayeredFigure";
import { MODULE_DOMAINS } from "@/lib/map/domain-colors";
import {
  filterExercises,
  listServableExercises,
  type ExercitiiFilters,
} from "@/lib/exercitii/data";

/**
 * /app/exercitii — ETAPA 78 FAZA E: biblioteca SERVIBILĂ navigabilă (R5: doar
 * conținut cu răspuns verificat/oficial; restul NU există aici). Ultimul
 * „Curând" din navigație moare. Click pe exercițiu → chat-ul ancorat pe
 * conceptul lui, cu exercițiul pre-încărcat. Zero LLM la randare.
 */
export const metadata = { title: "Exerciții · Profesor Maxim" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Params = {
  domeniu?: string;
  clasa?: string;
  dificultate?: string;
  q?: string;
  pagina?: string;
};

function urlWith(params: Params, patch: Partial<Params>): string {
  const merged: Record<string, string | undefined> = { ...params, ...patch };
  if (!("pagina" in patch)) merged.pagina = undefined; // schimbarea filtrului resetează pagina
  const qs = Object.entries(merged)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return qs ? `/app/exercitii?${qs}` : "/app/exercitii";
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "glass-1 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function ExercitiiPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const filters: ExercitiiFilters = {
    domeniu: params.domeniu || undefined,
    clasa: params.clasa ? Number(params.clasa) : undefined,
    dificultate:
      params.dificultate === "accesibil" || params.dificultate === "avansat"
        ? params.dificultate
        : undefined,
    q: params.q?.trim() || undefined,
  };

  const all = await listServableExercises(createServiceClient());
  const filtered = filterExercises(all, filters);

  const page = Math.max(1, Number(params.pagina) || 1);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // domeniile prezente în bibliotecă (nu promitem module fără conținut)
  const presentDomains = [...new Set(all.map((r) => r.domainKey).filter(Boolean))] as string[];
  const domainChips = Object.values(MODULE_DOMAINS).filter((d) => presentDomains.includes(d.key));
  const presentGrades = [...new Set(all.map((r) => r.grade_level).filter((g) => g !== null))].sort() as number[];

  return (
    <div className="max-w-[860px] mx-auto px-6 py-8 space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-semibold">Exerciții</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {all.length} exerciții din culegerea oficială BAC — fiecare cu răspuns
          verificat sau oficial. Alege unul și îl lucrăm împreună.
        </p>
      </div>

      {/* ── căutare ── */}
      <form method="get" action="/app/exercitii" className="relative">
        {filters.domeniu && <input type="hidden" name="domeniu" value={filters.domeniu} />}
        {filters.clasa && <input type="hidden" name="clasa" value={filters.clasa} />}
        {filters.dificultate && <input type="hidden" name="dificultate" value={filters.dificultate} />}
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Caută în enunțuri și concepte (ex.: primitivă, arie, piramidă)…"
          className="w-full rounded-full glass-1 pl-11 pr-4 py-2.5 text-sm bg-transparent border border-[var(--glass-2)] outline-none focus:border-primary"
        />
      </form>

      {/* ── filtre ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Chip href={urlWith(params, { domeniu: undefined })} active={!filters.domeniu}>
            Toate domeniile
          </Chip>
          {domainChips.map((d) => (
            <Chip
              key={d.key}
              href={urlWith(params, { domeniu: d.key })}
              active={filters.domeniu === d.key}
            >
              {d.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip href={urlWith(params, { clasa: undefined })} active={!filters.clasa}>
            Toate clasele
          </Chip>
          {presentGrades.map((g) => (
            <Chip key={g} href={urlWith(params, { clasa: String(g) })} active={filters.clasa === g}>
              Clasa {g}
            </Chip>
          ))}
          <span className="w-3" />
          <Chip href={urlWith(params, { dificultate: undefined })} active={!filters.dificultate}>
            Orice dificultate
          </Chip>
          <Chip
            href={urlWith(params, { dificultate: "accesibil" })}
            active={filters.dificultate === "accesibil"}
          >
            Accesibil
          </Chip>
          <Chip
            href={urlWith(params, { dificultate: "avansat" })}
            active={filters.dificultate === "avansat"}
          >
            Avansat
          </Chip>
        </div>
      </div>

      {/* ── rezultate ── */}
      <p className="text-xs text-muted-foreground">
        {filtered.length === all.length
          ? `${all.length} exerciții`
          : `${filtered.length} din ${all.length} exerciții`}
        {pages > 1 && ` · pagina ${page}/${pages}`}
      </p>

      {slice.length === 0 ? (
        <div className="glass-solid rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Niciun exercițiu nu se potrivește filtrelor. Lărgește căutarea.
        </div>
      ) : (
        <div className="space-y-3">
          {slice.map((ex) => {
            const href = ex.concept_slug
              ? `/app/chat?concept=${encodeURIComponent(ex.concept_slug)}&exercise=${ex.id}`
              : null;
            const card = (
              <article
                data-testid="exercitiu-card"
                className="glass-solid rounded-2xl p-5 space-y-3 transition-colors hover:border-primary/40 border border-transparent"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {ex.tier === "verificat" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-bg text-success-foreground px-2 py-0.5 font-medium">
                      <BadgeCheck className="h-3 w-3" /> verificat
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full glass-1 text-muted-foreground px-2 py-0.5 font-medium">
                      <BookOpen className="h-3 w-3" /> culegerea oficială
                    </span>
                  )}
                  {ex.domainLabel && (
                    <span
                      className="rounded-full px-2 py-0.5 font-medium"
                      style={{
                        background: ex.domainKey ? `var(--domain-${ex.domainKey}-bg)` : "var(--glass-1)",
                        color: ex.domainKey ? `var(--domain-${ex.domainKey}-fg)` : "var(--muted-foreground)",
                      }}
                    >
                      {ex.domainLabel}
                    </span>
                  )}
                  {ex.grade_level && (
                    <span className="text-muted-foreground">clasa {ex.grade_level}</span>
                  )}
                  <span className="text-muted-foreground">· {ex.difficulty}</span>
                </div>
                <div className="text-sm leading-relaxed">
                  <MathText text={ex.statement} />
                </div>
                {ex.has_figure && <LayeredFigure exerciseId={ex.id} />}
                {ex.concept_name && (
                  <p className="text-xs text-muted-foreground">
                    Concept: <span className="text-foreground font-medium">{ex.concept_name}</span>
                    {href && <span className="text-primary"> → lucrează-l cu profesorul</span>}
                  </p>
                )}
              </article>
            );
            return href ? (
              <Link key={ex.id} href={href} className="block">
                {card}
              </Link>
            ) : (
              <div key={ex.id}>{card}</div>
            );
          })}
        </div>
      )}

      {/* ── paginare ── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {page > 1 && (
            <Link
              href={urlWith(params, { pagina: String(page - 1) })}
              className="rounded-full glass-1 px-4 py-2 text-sm"
            >
              ← Înapoi
            </Link>
          )}
          <span className="text-xs text-muted-foreground px-2">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link
              href={urlWith(params, { pagina: String(page + 1) })}
              className="rounded-full glass-1 px-4 py-2 text-sm"
            >
              Înainte →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
