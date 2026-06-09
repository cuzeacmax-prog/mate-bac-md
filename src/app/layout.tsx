import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// ETAPA 66 FAZA E2: katex.min.css NU mai e global — se importă doar în
// layout-urile rutelor care randează matematică (/app, /onboarding, /admin).
import { PosthogProvider } from "@/components/analytics/PosthogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
          <PosthogProvider>{children}</PosthogProvider>
        </body>
    </html>
  );
}
