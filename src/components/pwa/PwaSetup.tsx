"use client";

/**
 * ETAPA 78 FAZA A — înregistrarea service worker-ului + promptul de instalare
 * DISCRET: banner mic jos, doar după momentul de valoare (prima lecție sau al
 * 3-lea daily), niciodată la prima vizită; respins → tăcere 14 zile.
 */
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import {
  valueMomentReached,
  installDismissedRecently,
  dismissInstall,
} from "@/lib/pwa/value-moments";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaSetup() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          /* fără SW nu pierdem nimic esențial */
        });
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // re-evaluăm vizibilitatea când avem promptul amânat (și la mount)
  useEffect(() => {
    if (!deferred) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (standalone || installDismissedRecently() || !valueMomentReached()) return;
    setVisible(true);
  }, [deferred]);

  if (!visible || !deferred) return null;

  return (
    <div
      data-testid="pwa-install-banner"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-solid rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl max-w-[92vw]"
    >
      <Download className="h-5 w-5 text-primary shrink-0" />
      <p className="text-sm">
        Ține-l pe <span className="font-semibold">Profesor Maxim</span> pe ecranul
        de start — un singur tap până la daily.
      </p>
      <button
        onClick={async () => {
          setVisible(false);
          await deferred.prompt();
          setDeferred(null);
        }}
        className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shrink-0"
      >
        Instalează
      </button>
      <button
        aria-label="Nu acum"
        onClick={() => {
          dismissInstall();
          setVisible(false);
        }}
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
