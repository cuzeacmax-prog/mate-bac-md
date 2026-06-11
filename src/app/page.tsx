/**
 * / — LANDING „PROFESORUL DE ÎNCREDERE, MODERNIZAT" (ETAPA 77 FAZA C).
 *
 * Direcția emoțională aprobată: părintele simte în 5 secunde „un profesor
 * adevărat din Chișinău, cu tehnologie serioasă" — căldură + competență.
 * ONESTITATE (C2): eticheta „verificate de profesor" apare DOAR cu numărul
 * real de lecții aprobate din DB; 0 aprobate → „construite pe culegerea
 * oficială BAC". Pagina e cvasi-statică (revalidate 1h) — perf-ul din 76.
 */
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Map, BookOpenCheck, Camera, LineChart, ArrowRight, ShieldCheck } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Profesor Maxim — pregătire de BAC la matematică, Republica Moldova",
  description:
    "Pregătirea de BAC la matematică cu un profesor care știe exact unde ești: hartă a cunoașterii pe programa MD, lecții pe culegerea oficială, simulare cu notă estimată. Începe gratuit cu testul de evaluare.",
  openGraph: {
    title: "Profesor Maxim — pregătire de BAC la matematică",
    description:
      "Harta cunoașterii pe programa BAC MD, lecții pe culegerea oficială, simulare cu notă estimată. Începe gratuit.",
    images: ["/og.png"],
    locale: "ro_RO",
    type: "website",
  },
};

/** stele deterministe pentru hero (varianta UȘOARĂ — nu harta completă) */
function heroStars(seed: number, count: number) {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648), s / 2147483648);
  return Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    r: rand() < 0.3 ? 1.4 : 0.9,
    o: 0.25 + rand() * 0.5,
    tw: rand() < 0.2 ? 2.5 + rand() * 3 : 0,
  }));
}
const HERO_STARS = heroStars(42, 70);

const STEPS = [
  {
    icon: BookOpenCheck,
    title: "1 · Testul de evaluare",
    text: "5–8 întrebări scurte îți găsesc frontiera reală de învățare pe graful programei — nu pornim de la zero, pornim de la tine.",
  },
  {
    icon: Map,
    title: "2 · Harta ta",
    text: "Vezi toate conceptele BAC ca o constelație: ce stăpânești, ce e deblocat, care e următorul pas. Drumul tău e mereu aprins.",
  },
  {
    icon: LineChart,
    title: "3 · Lecții cu verificare",
    text: "Lecții pas-cu-pas pe culegerea oficială, cu grafice și figuri, quiz după fiecare idee și progres care se mișcă doar pe dovezi.",
  },
] as const;

const FAQ = [
  {
    q: "E doar un chatbot?",
    a: "Nu. Sub fiecare lecție stă graful programei BAC MD, culegerea oficială cu răspunsuri verificate și o metodică de profesor. AI-ul explică — conținutul e ancorat în surse, nu inventat.",
  },
  {
    q: "Pentru ce clase e?",
    a: "Pentru liceu, cu focus pe clasa a 12-a și examenul de BAC (profil real și umanist). Harta acoperă și golurile din clasele anterioare.",
  },
  {
    q: "Cum știu că răspunsurile sunt corecte?",
    a: "Exercițiile servite vin din culegerea oficială cu răspuns verificat (inclusiv verificare algebrică automată), iar rezolvarea ta e evaluată determinist unde se poate — nu după ureche.",
  },
  {
    q: "Pot renunța oricând?",
    a: "Da. Abonamentul se anulează dintr-un click și rămâne activ până la finalul perioadei plătite. Există și plan gratuit permanent.",
  },
] as const;

export default async function LandingPage() {
  // C2 — ONESTITATE: numărul REAL de lecții aprobate de profesor
  let approvedLessons = 0;
  try {
    const { count } = await createServiceClient()
      .from("lesson_canonical")
      .select("id", { count: "exact", head: true })
      .eq("status", "aprobat-profesor");
    approvedLessons = count ?? 0;
  } catch {
    /* eticheta cade pe formularea fără număr */
  }
  const lessonsLabel =
    approvedLessons > 0
      ? `${approvedLessons} lecții verificate de profesor`
      : "lecții construite pe culegerea oficială BAC";

  return (
    <main className="min-h-screen">
      {/* ── HERO: constelația vie (ușoară), titlu pe rezultat ── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="sky-nebula"
            style={{
              background: [
                "radial-gradient(60% 70% at 25% 20%, oklch(0.45 0.2 295 / 0.35), transparent 70%)",
                "radial-gradient(55% 65% at 80% 75%, oklch(0.55 0.18 200 / 0.2), transparent 70%)",
                "oklch(0.11 0.02 265)",
              ].join(","),
            }}
          />
          <div className="absolute inset-0 sky-noise" />
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            {HERO_STARS.map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.r * 0.14}
                fill="white"
                opacity={s.o}
                className={s.tw ? "star-twinkle" : undefined}
                style={s.tw ? { animationDuration: `${s.tw}s`, animationDelay: `${(i % 5) * 0.7}s` } : undefined}
              />
            ))}
          </svg>
          <span className="sky-seal" style={{ color: "var(--domain-i)" }}>∫</span>
        </div>

        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">
            BAC matematică · Republica Moldova
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight max-w-3xl mx-auto">
            Pregătirea de BAC la matematică, cu un profesor care știe exact unde ești
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Harta cunoașterii pe programa oficială, {lessonsLabel}, simulare cu notă
            estimată — și un tutor care explică pas cu pas, în română, ca la barem.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/onboarding/welcome"
              className="btn-living rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-semibold text-base inline-flex items-center gap-2"
            >
              Începe gratuit cu testul de evaluare <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full glass-2 glass-hover px-6 py-3.5 text-sm font-medium"
            >
              Am deja cont
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Fără card. Planul gratuit rămâne gratuit.
          </p>
        </div>
      </section>

      {/* ── SECȚIUNEA PROFESORULUI ── */}
      <section className="max-w-4xl mx-auto px-6 py-14">
        <div className="glass-2 rounded-3xl p-7 md:p-9 flex flex-col md:flex-row items-center gap-7">
          {/* slot de fotografie — placeholder elegant până la poza reală */}
          <div className="shrink-0 w-32 h-32 rounded-full glass-1 flex items-center justify-center text-4xl font-bold text-primary border-2 border-primary/30">
            MC
          </div>
          <div className="text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cine e în spatele platformei
            </p>
            <h2 className="text-xl font-bold mt-1">
              Creat de Maxim Cuzeac, profesor de matematică, Chișinău
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Aceeași metodică pe care o folosesc la clasă — frontiera de învățare,
              redactarea de barem, capcanele tipice de la examen — pusă într-o platformă
              care lucrează cu fiecare elev individual. Conținutul vine din culegerea
              oficială și din programa MD; tehnologia doar îl aduce la elev, în ritmul lui.
            </p>
          </div>
        </div>
      </section>

      {/* ── CUM FUNCȚIONEAZĂ — 3 pași ── */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-center">Cum funcționează</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div key={s.title} className="glass-1 glass-hover rounded-2xl p-6">
              <s.icon className="h-7 w-7 text-primary" />
              <h3 className="font-semibold mt-3">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRODUSUL ÎN ACȚIUNE — capturi reale ── */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center">Așa arată pe ecranul elevului</h2>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Capturi reale din produs — lecția pas-cu-pas, harta cunoașterii, progresul.
        </p>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {[
            { src: "/landing/lectia.png", alt: "Lecție pas cu pas cu matematică randată", label: "Lecția-scenă" },
            { src: "/landing/harta.png", alt: "Harta cunoașterii ca o constelație", label: "Harta ta" },
            { src: "/landing/progres.png", alt: "Progresul pe domenii", label: "Progresul real" },
          ].map((img) => (
            <figure key={img.src} className="glass-1 rounded-2xl p-2.5">
              <div className="rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)]">
                <Image src={img.src} alt={img.alt} width={720} height={450} className="w-full h-auto" />
              </div>
              <figcaption className="text-xs text-muted-foreground text-center py-2">{img.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── PREȚ — comparația onestă ── */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="glass-2 rounded-3xl p-8 text-center">
          <ShieldCheck className="h-8 w-8 text-primary mx-auto" />
          <h2 className="text-2xl font-bold mt-3">199 lei pe lună · primele 7 zile gratuite</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto leading-relaxed">
            O singură ședință de meditații costă cât un abonament întreg pe o lună.
            Aici ai profesorul disponibil în fiecare zi: lecții, hartă, simulare,
            evaluare la fiecare răspuns.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/onboarding/welcome"
              className="btn-living rounded-full bg-primary text-primary-foreground px-7 py-3 font-semibold inline-flex items-center gap-2"
            >
              Începe cu testul gratuit <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-muted-foreground">Plan gratuit permanent: 30 de mesaje/lună.</p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-center mb-6">Întrebări frecvente</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="glass-1 rounded-2xl px-5 py-4 group">
              <summary className="font-medium cursor-pointer list-none flex items-center justify-between">
                {f.q}
                <span className="text-muted-foreground group-open:rotate-90 transition-transform">›</span>
              </summary>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="max-w-3xl mx-auto px-6 pb-20 pt-6 text-center">
        <h2 className="text-2xl font-bold">Începe de unde ești. Restul îl vedem pe hartă.</h2>
        <Link
          href="/onboarding/welcome"
          className="btn-living mt-6 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-8 py-4 font-semibold text-base"
        >
          Fă testul de evaluare gratuit <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="mt-10 text-xs text-muted-foreground flex items-center justify-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" /> foto→rezolvare</span>
          <span className="inline-flex items-center gap-1.5"><Map className="h-3.5 w-3.5" /> harta cunoașterii</span>
          <span className="inline-flex items-center gap-1.5"><BookOpenCheck className="h-3.5 w-3.5" /> culegerea oficială BAC</span>
        </div>
      </section>
    </main>
  );
}
