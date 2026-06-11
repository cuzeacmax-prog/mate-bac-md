/**
 * /admin/lectii/[id] — ETAPA 75 FAZA B4: preview-ul unei lecții canonice +
 * Aprobă / observații. Transcriptul refolosește LessonTranscript (read-only).
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { LessonTranscript } from "@/components/chat/LessonTranscript";
import { ApproveLessonForm } from "./ApproveLessonForm";

export const dynamic = "force-dynamic";

export default async function AdminLectiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = createServiceClient();
  const { data: lesson } = await svc
    .from("lesson_canonical")
    .select("id, version, status, model, generated_at, observatii, blocks, surse, concepts(name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!lesson) notFound();
  const concept = lesson.concepts as unknown as { name: string; slug: string } | null;
  const surse = lesson.surse as { exercise_ids?: string[]; theory_figure?: string | null };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <Link href="/admin/lectii" className="text-sm text-gray-500 hover:text-gray-900">
        ← toate lecțiile
      </Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">{concept?.name}</h1>
        <p className="text-sm text-gray-500">
          {concept?.slug} · v{lesson.version} · {lesson.model} · surse:{" "}
          {surse.exercise_ids?.length ?? 0} exerciții
          {surse.theory_figure ? ` + figura ${surse.theory_figure}` : ""}
        </p>
      </div>

      <ApproveLessonForm
        id={lesson.id as string}
        status={lesson.status as string}
        observatii={(lesson.observatii as string | null) ?? ""}
      />

      {/* preview-ul lecției — pe fundal închis, cum o vede elevul */}
      <div className="rounded-2xl bg-[oklch(0.16_0.025_260)] text-[oklch(0.95_0.01_260)] p-5">
        <LessonTranscript
          concept={concept?.name}
          blocks={(lesson.blocks as Array<{ tip: string }>) ?? []}
        />
      </div>
    </div>
  );
}
