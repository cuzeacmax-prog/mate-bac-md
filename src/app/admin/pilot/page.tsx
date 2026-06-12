import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { gatherPilotPanel } from "@/lib/admin/pilot-data";
import { FeedbackStatusButton, PilotToggle } from "./PilotActions";

/**
 * ETAPA 78 FAZA D — panoul pilotului: un singur ecran, citibil dimineața în
 * 2 minute, ZERO LLM. Gating-ul admin e în layout-ul /admin.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Pilot — Admin" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

const ratingLabel: Record<string, string> = {
  good: "✅", bad: "❌", needs_improvement: "⚠️",
};

export default async function AdminPilotPage() {
  const data = await gatherPilotPanel(createServiceClient());
  const t = data.totals;
  const acc = t.attempts7 > 0 ? Math.round((100 * t.correct7) / t.attempts7) : null;
  const feedbackNou = data.feedback.filter((f) => f.status === "nou").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Panoul pilotului</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cohorta pilot, dimineața în 2 minute — totul din date reale, zero LLM.
        </p>
      </div>

      {/* ── cifrele zilei ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="useri pilot" value={String(t.pilots)} />
        <Stat label="activi azi" value={String(t.activeToday)} />
        <Stat label="activi 7 zile" value={String(t.active7)} />
        <Stat label="lecții (7z)" value={String(t.lessons7)} />
        <Stat label="acuratețe quiz (7z)" value={acc === null ? "—" : `${acc}%`} />
        <Stat label="cost AI (7z)" value={`$${t.costUsd7.toFixed(2)}`} />
      </div>

      {/* ── per user ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Userii pilot</h2>
        {data.pilots.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-4">
            Cohorta e goală — adaugă useri din lista de mai jos.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-2 py-2 font-medium">Azi</th>
                  <th className="px-2 py-2 font-medium">Streak</th>
                  <th className="px-2 py-2 font-medium">Lecții 7z</th>
                  <th className="px-2 py-2 font-medium">Corecte/încercate 7z</th>
                  <th className="px-2 py-2 font-medium">Cost 7z</th>
                  <th className="px-4 py-2 font-medium text-right">Cohortă</th>
                </tr>
              </thead>
              <tbody>
                {data.pilots.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 text-gray-900">{p.name ?? p.email}</td>
                    <td className="px-2 py-2">{p.activeToday ? "🟢" : "⚪"}</td>
                    <td className="px-2 py-2 text-gray-700">{p.streak > 0 ? `🔥 ${p.streak}` : "0"}</td>
                    <td className="px-2 py-2 text-gray-700">{p.lessons7}</td>
                    <td className="px-2 py-2 text-gray-700">
                      {p.correct7}/{p.attempts7}
                      {p.attempts7 > 0 && (
                        <span className="text-gray-400"> ({Math.round((100 * p.correct7) / p.attempts7)}%)</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-700">${p.costUsd7.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <PilotToggle userId={p.id} isPilot={true} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── top concepte ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Top concepte lucrate (7 zile, pilot)</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            {data.topConcepts.length === 0 ? (
              <p className="text-sm text-gray-500">Nicio evidență săptămâna aceasta.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.topConcepts.map((c) => (
                  <li key={c.name} className="flex justify-between text-sm">
                    <span className="text-gray-800">{c.name}</span>
                    <span className="text-gray-500">{c.count} useri</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── erori recente ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Erori recente (KaTeX + randare client)
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
            {data.errors.length === 0 ? (
              <p className="text-sm text-gray-500">Nicio eroare logată. 🎉</p>
            ) : (
              data.errors.map((e, i) => (
                <div key={i} className="text-xs border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                  <p className="text-gray-500">
                    {new Date(e.created_at).toLocaleString("ro-RO")} · {e.source ?? "?"}
                  </p>
                  <p className="text-red-700 truncate">{e.error}</p>
                  {e.raw && <p className="text-gray-400 truncate font-mono">{e.raw.slice(0, 120)}</p>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── inbox feedback ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">
          Inbox feedback {feedbackNou > 0 && <span className="text-red-600">({feedbackNou} noi)</span>}
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {data.feedback.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">Inbox gol.</p>
          ) : (
            data.feedback.map((f) => (
              <div key={f.id} className="p-3 flex items-start gap-3">
                <span className="text-base shrink-0">{ratingLabel[f.rating] ?? "·"}</span>
                <div className="min-w-0 flex-1">
                  {f.message && <p className="text-sm text-gray-800 truncate">{f.message}</p>}
                  {f.notes && <p className="text-xs text-gray-500 mt-0.5">{f.notes}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(f.created_at).toLocaleString("ro-RO")}
                    {f.conversation_id && (
                      <>
                        {" · "}
                        <Link href={`/admin/conversations/${f.conversation_id}`} className="underline">
                          conversația
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <FeedbackStatusButton id={f.id} status={f.status} />
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── adaugă în cohortă ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Adaugă în cohortă (ultimii useri)</h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {data.candidates.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">Niciun candidat.</p>
          ) : (
            data.candidates.map((c) => (
              <div key={c.id} className="px-4 py-2 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-800 truncate">{c.name ? `${c.name} · ` : ""}{c.email}</span>
                <PilotToggle userId={c.id} isPilot={false} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
