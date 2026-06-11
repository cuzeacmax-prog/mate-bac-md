/**
 * template.tsx — ETAPA 77 D1: tranziția consecventă între paginile aplicației
 * (fade+slide 220ms, CSS pur — re-montat de Next la fiecare navigare).
 * reduced-motion o stinge (regula globală pe animații).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter h-full flex flex-col flex-1 min-h-0">{children}</div>;
}
