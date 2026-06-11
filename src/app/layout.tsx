import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
// ETAPA 66 FAZA E2: katex.min.css NU mai e global — se importă doar în
// layout-urile rutelor care randează matematică (/app, /onboarding, /admin).
import { PosthogProvider } from "@/components/analytics/PosthogProvider";

// ETAPA 73: Manrope variabil — tokenul --font-sans îl referă EXPLICIT în
// globals.css (defectul vechi: --font-sans se referea pe sine → serif de sistem)
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Profesor Maxim — AI Tutor BAC Matematică Moldova",
  description:
    "Pregătire inteligentă pentru examenul de Bacalaureat la matematică în Republica Moldova. Tutor AI specializat pe curriculum MD.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      // ETAPA 73: dark = tema implicită și SINGURA în v1 (clasa activează
      // variantele dark: existente; tokens din :root sunt deja dark)
      className={`${manrope.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
          {/* ETAPA 76 E: MotionProvider NU mai e global — framer-motion (132KB)
              intra în bundle-ul landing-ului fără să fie folosit acolo */}
          <>
            <PosthogProvider>{children}</PosthogProvider>
          </>
        </body>
    </html>
  );
}
