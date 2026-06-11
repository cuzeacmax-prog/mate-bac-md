/**
 * 404 — ETAPA 77 E: pe temă. „Te-ai rătăcit printre stele — înapoi la hartă."
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(55% 60% at 30% 25%, oklch(0.45 0.2 295 / 0.3), transparent 70%), oklch(0.11 0.02 265)",
        }}
      />
      <span aria-hidden className="sky-seal" style={{ color: "var(--domain-i)" }}>∅</span>
      <div className="relative space-y-4 max-w-md">
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="text-xl font-semibold">Te-ai rătăcit printre stele.</h1>
        <p className="text-sm text-muted-foreground">
          Pagina asta nu există pe nicio constelație. Hai înapoi pe drumul tău.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/app/harta" className="btn-living rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold">
            Înapoi la hartă →
          </Link>
          <Link href="/" className="rounded-full glass-2 px-5 py-3 text-sm">
            Pagina principală
          </Link>
        </div>
      </div>
    </main>
  );
}
