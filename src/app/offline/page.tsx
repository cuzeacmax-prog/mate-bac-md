/**
 * ETAPA 78 FAZA A — ecranul offline pe brand, servit de service worker când
 * navigarea eșuează. ONEST: nu promitem funcționare offline — lecțiile și
 * harta au nevoie de internet.
 *
 * TOTUL inline (defect prins de bucla vizuală): offline, CSS-urile hash-uite
 * nu se pot încărca, deci clasele Tailwind ar fi moarte → pagină albă.
 */
export const metadata = { title: "Offline — Profesor Maxim" };

const S = {
  wrap: {
    minHeight: "100vh",
    margin: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 24px",
    textAlign: "center" as const,
    background: "radial-gradient(circle at 30% 20%, #1a1430 0%, #070d18 65%)",
    color: "#e8e6f0",
    fontFamily: "Manrope, 'Segoe UI', sans-serif",
  },
  glyph: {
    margin: "0 auto",
    height: 80,
    width: 80,
    borderRadius: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 48,
    fontWeight: 700,
    background: "radial-gradient(circle at 30% 25%, #2d2150, #070d18 70%)",
    color: "#cdb9ff",
    fontFamily: "Georgia, serif",
    boxShadow: "0 0 40px -8px rgba(158,113,253,0.5)",
  },
  h1: { fontSize: 22, fontWeight: 600, margin: "20px 0 8px" },
  p: { fontSize: 14, lineHeight: 1.7, color: "#a7a3b8", margin: "0 0 20px" },
  btn: {
    display: "inline-block",
    borderRadius: 999,
    background: "#9e71fd",
    color: "#0d0a1a",
    padding: "11px 26px",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
  },
};

export default function OfflinePage() {
  return (
    <div style={S.wrap}>
      <div style={{ maxWidth: 360 }}>
        <div aria-hidden style={S.glyph}>∫</div>
        <h1 style={S.h1}>Ești offline</h1>
        <p style={S.p}>
          Lecțiile, harta și exercițiile au nevoie de internet — aici nu te pot
          ajuta fără el. Verifică conexiunea și reîncearcă.
        </p>
        <a href="/app/azi" style={S.btn}>Reîncearcă</a>
      </div>
    </div>
  );
}
