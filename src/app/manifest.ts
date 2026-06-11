import type { MetadataRoute } from "next";

/**
 * ETAPA 78 FAZA A — manifestul PWA. Culorile sunt hex-urile srgb ale tokens
 * (--background, --primary din globals.css; oklch nu e valid în manifest).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Profesor Maxim — Mate BAC Moldova",
    short_name: "Prof. Maxim",
    description:
      "Pregătire pentru BAC la matematică în Republica Moldova: lecții verificate, hartă de concepte, exerciții din culegeri oficiale.",
    id: "/app/azi",
    start_url: "/app/azi",
    display: "standalone",
    background_color: "#070d18",
    theme_color: "#070d18",
    lang: "ro",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
