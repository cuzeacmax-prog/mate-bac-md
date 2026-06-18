/**
 * ETAPA 79 FAZA B3 — ACCEPTANȚĂ coada umană de reparare body-uri.
 * Demonstrează pe 2 exemple REALE: detecția erorii (evidențiere), reparația
 * mecanică (înainte→după) și mecanismul de „rezolvat" (findBodyErrors==0).
 *
 *   tsx --env-file=.env.local scripts/verify/etapa79-body-queue-acceptance.ts
 */
import { createServiceClient } from "../../src/lib/supabase/service";
import { findBodyErrors, mechanicalSanitize } from "../../src/lib/content/body-render";

const MECHANIC_ID = "8bd4ce18-ec08-47b6-9c6d-3e9d1f0f9429"; // bare integral → $-wrapped (structural)
const HUMAN_ID = "cc2eae5f-6413-483a-9403-a19a9858eb3d";    // radical malformat → doar-uman (R5)

async function main() {
  const svc = createServiceClient();
  const { data } = await svc.from("exercise_raw").select("id, statement, human_body_status").in("id", [MECHANIC_ID, HUMAN_ID]);
  const byId = new Map((data ?? []).map((r) => [r.id as string, r]));
  let ok = true;
  const assert = (cond: boolean, msg: string) => { console.log(`  ${cond ? "✓" : "✗"} ${msg}`); if (!cond) ok = false; };

  console.log("\n════════ FAZA B3 — coada umană (acceptanță) ════════");

  // EXEMPLU 1 — reparat MECANIC (deja aplicat în DB de triere)
  const m = byId.get(MECHANIC_ID);
  console.log(`\n[1] MECANIC ${MECHANIC_ID}`);
  console.log(`    în DB acum: ${(m?.statement ?? "").slice(0, 80)}`);
  // simulează starea „înainte" (fără delimitatori) și „după" (sanitizer mecanic)
  const before1 = (m?.statement ?? "").replace(/^\$|\$$/g, "");
  const after1 = mechanicalSanitize(before1);
  assert(findBodyErrors(before1).length > 0, "înainte: are eroare KaTeX per-formulă (în segmentarea editorului)");
  assert(after1 !== before1 && findBodyErrors(after1).length === 0, "după (sanitizer mecanic): se randează curat → reparat automat");
  assert(m?.human_body_status !== "coada", "scos din coadă (reparat mecanic)");

  // EXEMPLU 2 — DOAR-UMAN (rămâne în coadă; modelul NU rescrie matematica)
  const h = byId.get(HUMAN_ID);
  const errs = findBodyErrors(h?.statement ?? "");
  console.log(`\n[2] DOAR-UMAN ${HUMAN_ID}`);
  console.log(`    enunț: ${(h?.statement ?? "").replace(/\s+/g, " ").slice(0, 90)}`);
  for (const e of errs) console.log(`    ⚠ EVIDENȚIAT: ${e.message} — în: ${e.raw.slice(0, 60)}`);
  assert(errs.length > 0, "eroarea e detectată și evidențiată pentru Maxim");
  assert(mechanicalSanitize(h?.statement ?? "") === (h?.statement ?? "") || findBodyErrors(mechanicalSanitize(h?.statement ?? "")).length > 0, "sanitizer-ul mecanic NU o poate repara → corect lăsată omului");
  assert(h?.human_body_status === "coada", "rămâne în coadă (status='coada')");

  // MECANISMUL de rezolvare (API POST): un enunț FĂRĂ erori → marcat „rezolvat"
  assert(findBodyErrors("Calculați $2+2$ și $\\frac{1}{2}$.").length === 0, "mecanism: enunț curat → findBodyErrors==0 → API marchează 'rezolvat'");

  console.log(`\n${ok ? "✅ B3 OK — detecție + evidențiere + reparație mecanică + coadă umană + mecanism rezolvare" : "❌ B3 a picat"}`);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
