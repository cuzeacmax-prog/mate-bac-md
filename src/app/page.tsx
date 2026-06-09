import Link from "next/link";
import { BookOpen, Brain, Camera, BarChart2, CheckCircle2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const FEATURES = [
  {
    icon: Brain,
    title: "Tutor AI personalizat",
    description:
      "Explică pas cu pas, în română, exact cum se cere la BAC MD. Nu dă răspunsul direct — te ghidează să înțelegi.",
  },
  {
    icon: Camera,
    title: "Foto exercițiu",
    description:
      "Fotografiezi exercițiul din caietul tău și AI-ul îl rezolvă cu explicații complete.",
  },
  {
    icon: BarChart2,
    title: "Simulare BAC",
    description:
      "Variantă completă tip BAC MD, evaluată automat cu notă estimativă și feedback detaliat.",
  },
  {
    icon: CheckCircle2,
    title: "Progres pe capitole",
    description:
      "Urmărești ce stăpânești și unde ai nevoie de mai multă practică.",
  },
] as const;

const PRICING_FREE = [
  "30 mesaje AI pe lună",
  "5 exerciții generate pe zi",
  "Acces la toate capitolele",
];

const PRICING_PREMIUM = [
  "500 mesaje AI pe lună",
  "Exerciții nelimitate",
  "Foto OCR — rezolvare din poze",
  "Simulare BAC completă",
  "Dashboard progres avansat",
];

export default function LandingPage() {
  // ETAPA 66 FAZA E3: pagina e STATICĂ (○). Redirectul userilor logați
  // se face în proxy (middleware) — fără cookies/auth aici.
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Profesor Maxim</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Intră în cont</Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm">Începe gratuit</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              Specializat 100% pe BAC Matematică Moldova
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Pregătire inteligentă pentru{" "}
              <span className="text-primary">BAC Matematică MD</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tutor AI creat de Profesor Maxim — explică exact cum se cere la examen,
              cu notația și terminologia din programa moldovenească.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/signup">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Începe gratuit
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Vezi prețurile
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Gratuit: 30 mesaje/lună, fără card
            </p>
          </div>
        </section>

        <Separator />

        {/* Features */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">Ce poți face</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <Card key={title}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base">{title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <Separator />

        {/* Pricing */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">Prețuri simple</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Free */}
              <Card>
                <CardHeader>
                  <CardTitle>Gratuit</CardTitle>
                  <p className="text-3xl font-bold">0 lei</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {PRICING_FREE.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {item}
                    </div>
                  ))}
                  <Link href="/auth/signup" className="block pt-4">
                    <Button variant="outline" className="w-full">Începe gratuit</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Premium */}
              <Card className="border-primary/50 shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Premium</CardTitle>
                    <span className="text-xs font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      Recomandat
                    </span>
                  </div>
                  <div>
                    <span className="text-3xl font-bold">149 lei</span>
                    <span className="text-muted-foreground text-sm">/lună</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    sau 599 lei · sezon BAC (feb–iun)
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {PRICING_PREMIUM.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {item}
                    </div>
                  ))}
                  <Link href="/auth/signup" className="block pt-4">
                    <Button className="w-full">Încearcă gratuit</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <Separator />

        {/* CTA meditații */}
        <section className="py-16 px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold">Preferi meditații în persoană?</h2>
            <p className="text-muted-foreground">
              Profesor Maxim oferă meditații individuale la Chișinău și online pentru
              elevii din diaspora.
            </p>
            <Link href="/contact">
              <Button variant="outline" size="lg" className="gap-2">
                Contactează-mă
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© 2026 Profesor Maxim. Toate drepturile rezervate.</span>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-foreground transition-colors">Despre</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Prețuri</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
