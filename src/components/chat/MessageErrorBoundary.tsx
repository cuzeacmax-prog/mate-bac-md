"use client";

/**
 * MessageErrorBoundary — ETAPA 72 P2: NICIUN mesaj nu dispare vreodată.
 *
 * Boundary PER MESAJ: dacă randarea unui mesaj aruncă, DOAR acel mesaj cade
 * pe fallback (textul brut + „afișare simplificată"), restul conversației
 * rămâne intact. Eroarea se loghează client → server (katex_error_report)
 * ca să vedem ce conținut sparge randarea.
 */
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** conținutul brut al mesajului — fallback-ul care nu poate crăpa */
  rawContent: string;
}

export class MessageErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[mesaj] randare crăpată, fallback:", error.message);
    // fire-and-forget: logăm CE conținut a spart randarea
    void fetch("/api/log/render-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: `${error.name}: ${error.message}`,
        content: this.props.rawContent.slice(0, 2000),
      }),
    }).catch(() => { /* logarea nu are voie să facă rău */ });
  }

  render() {
    if (this.state.error) {
      return (
        <div>
          <p className="text-sm whitespace-pre-wrap break-words">{this.props.rawContent}</p>
          <p className="text-[10px] text-muted-foreground mt-1.5 italic">afișare simplificată</p>
        </div>
      );
    }
    return this.props.children;
  }
}
