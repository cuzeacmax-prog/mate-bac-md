/**
 * /app/simulare — ETAPA 69: simularea BAC (MVP onest, variantă parțială).
 * Server component: face auditul pool-ului (P1 — structura e dictată de pool)
 * și îl dă player-ului client. Zero LLM la randare.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { auditExamPool } from "@/lib/simulare/exam";
import { SimularePlayer } from "./SimularePlayer";

export const dynamic = "force-dynamic";

export default async function SimularePage() {
  const audit = await auditExamPool(createServiceClient());
  return <SimularePlayer audit={audit} />;
}
