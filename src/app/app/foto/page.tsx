"use client";

/**
 * /app/foto — ETAPA 77 F: FOTO → REZOLVARE.
 *
 * Upload sau cameră (mobil) → transcriere cu vision → CONFIRMAREA ELEVULUI
 * obligatorie (transcrierea se arată EDITABILĂ — anti-eroare de citire) →
 * abia apoi fluxul NORMAL de chat (biblioteca-întâi, lecție cu vizualuri).
 * Sub pragul de încredere (0.55) se cere re-poză, nu se riscă o rezolvare.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, RefreshCw } from "lucide-react";
import { MathText } from "@/components/MathText";
import { BreathingOrb } from "@/components/motion/BreathingOrb";

type Phase = "alege" | "transcriu" | "confirma" | "fara-mate" | "pornesc";

export default function FotoPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("alege");
  const [preview, setPreview] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [retake, setRetake] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (file.size > 6 * 1024 * 1024) {
      setError("Poza e prea mare (max 6MB). Încearcă o rezoluție mai mică.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setPreview(dataUrl);
    setPhase("transcriu");
    try {
      const resp = await fetch("/api/foto/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      if (!data.hasMath) {
        setPhase("fara-mate");
        return;
      }
      setStatement(data.statement);
      setConfidence(data.confidence);
      setRetake(Boolean(data.retake));
      setPhase("confirma");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
      setPhase("alege");
    }
  }

  // F2 → fluxul NORMAL: mesajul confirmat pleacă prin /api/chat
  // (biblioteca-întâi cu embeddings persistate, apoi rezolvarea cu vizualuri)
  async function confirmAndSolve() {
    if (!statement.trim()) return;
    setPhase("pornesc");
    setError(null);
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: statement.trim(), mode: "study" }),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let convId: string | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        for (const line of buf.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.conversationId) convId = ev.conversationId;
          } catch { /* parțial */ }
        }
      }
      if (!convId) throw new Error("conversația nu s-a creat");
      router.push(`/app/chat/${convId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
      setPhase("confirma");
    }
  }

  const reset = () => {
    setPhase("alege");
    setPreview(null);
    setStatement("");
    setConfidence(null);
    setRetake(false);
  };

  return (
    <div className="relative max-w-[700px] mx-auto px-6 py-10 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Foto → rezolvare</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fotografiază exercițiul din culegere sau caiet. Îți arăt ce am citit,
          tu confirmi — apoi îl rezolvăm împreună, ca la barem.
        </p>
      </div>

      {phase === "alege" && (
        <div className="glass-2 rounded-3xl p-8 text-center space-y-4">
          <Camera className="h-10 w-10 text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">JPEG/PNG/WebP, până la 6MB. Poza intră în cota ta de mesaje.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-living rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-semibold inline-flex items-center gap-2"
          >
            <Upload className="h-4 w-4" /> Alege sau fă o poză
          </button>
        </div>
      )}

      {preview && phase !== "alege" && (
        <div className="glass-1 rounded-2xl p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Poza exercițiului" className="w-full rounded-xl max-h-80 object-contain" />
        </div>
      )}

      {phase === "transcriu" && (
        <div className="text-center py-6">
          <BreathingOrb size="lg" label="Citesc exercițiul din poză…" />
        </div>
      )}

      {phase === "fara-mate" && (
        <div className="glass-solid rounded-2xl p-5 space-y-3 text-center">
          <p className="text-sm">
            Nu văd un exercițiu de matematică în poza asta. Încearcă o poză cu enunțul —
            tipărit sau scris de mână, cât mai drept și luminat.
          </p>
          <button onClick={reset} className="rounded-full glass-2 px-5 py-2.5 text-sm font-medium inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Altă poză
          </button>
        </div>
      )}

      {phase === "confirma" && (
        <div className="glass-solid rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Asta e exercițiul tău?</p>
            {confidence != null && (
              <span className={`text-xs rounded-full px-2.5 py-1 font-semibold ${retake ? "bg-danger-bg text-danger-foreground" : "bg-success-bg text-success-foreground"}`}>
                încredere {Math.round(confidence * 100)}%
              </span>
            )}
          </div>
          {retake && (
            <p className="text-xs text-danger-foreground">
              Citirea e nesigură — recomand o poză mai clară (dreaptă, lumină bună).
              Poți totuși corecta textul de mai jos și continua.
            </p>
          )}
          {/* transcrierea EDITABILĂ — anti-eroare de citire */}
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={4}
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="rounded-xl bg-[var(--math-surface)] border px-4 py-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Cum se va vedea:</p>
            <MathText text={statement} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={confirmAndSolve}
              className="btn-living flex-1 rounded-xl bg-primary text-primary-foreground py-3 font-semibold"
            >
              Da, rezolvăm →
            </button>
            <button onClick={reset} className="rounded-xl glass-2 px-4 py-3 text-sm font-medium inline-flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4" /> Altă poză
            </button>
          </div>
        </div>
      )}

      {phase === "pornesc" && (
        <div className="text-center py-6">
          <BreathingOrb size="lg" label="Pornesc rezolvarea…" />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
