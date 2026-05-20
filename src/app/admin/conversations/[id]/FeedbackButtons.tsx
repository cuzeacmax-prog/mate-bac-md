"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Rating = "good" | "bad" | "needs_improvement";

interface Props {
  messageId: string;
}

export function FeedbackButtons({ messageId }: Props) {
  const [saved, setSaved] = useState<Rating | null>(null);
  const [open, setOpen] = useState<Rating | null>(null);
  const [idealResponse, setIdealResponse] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(rating: Rating, ideal?: string, note?: string) {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("admin_feedback").insert({
      admin_id: user.id,
      message_id: messageId,
      rating,
      ideal_response: ideal || null,
      notes: note || null,
    });

    setSaved(rating);
    setOpen(null);
    setIdealResponse("");
    setNotes("");
    setSaving(false);
  }

  if (saved) {
    const labels: Record<Rating, string> = {
      good: "✅ Bun",
      bad: "❌ Greșit",
      needs_improvement: "⚠️ De îmbunătățit",
    };
    return (
      <span className="text-xs text-gray-400 italic">{labels[saved]} — salvat</span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => save("good")}
          className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-colors"
          title="Răspuns bun"
        >
          ✅ Bun
        </button>
        <button
          onClick={() => setOpen("bad")}
          className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-red-50 hover:border-red-300 transition-colors"
          title="Răspuns greșit"
        >
          ❌ Greșit
        </button>
        <button
          onClick={() => setOpen("needs_improvement")}
          className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
          title="De îmbunătățit"
        >
          ⚠️ De îmbunătățit
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
            <h2 className="font-semibold text-gray-900 mb-4">
              {open === "bad" ? "❌ Răspuns greșit" : "⚠️ De îmbunătățit"}
            </h2>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Răspuns ideal
            </label>
            <textarea
              value={idealResponse}
              onChange={(e) => setIdealResponse(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="Scrie cum ar trebui să arate răspunsul corect..."
            />

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notițe (opțional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
              placeholder="De ex: formulă greșită, lipsă pași intermediari..."
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setOpen(null);
                  setIdealResponse("");
                  setNotes("");
                }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Anulează
              </button>
              <button
                onClick={() => save(open, idealResponse, notes)}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Se salvează..." : "Salvează feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
