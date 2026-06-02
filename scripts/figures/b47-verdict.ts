// ETAPA 47 — aplică verdictele VIZUALE ale subagentului Sonnet. Argument: JSON [{slug,verdict,reason}].
import { createServiceClient } from "../../src/lib/supabase/service";
async function main() {
  const arg = process.argv[2] ?? "[]";
  const items = JSON.parse(arg) as Array<{ slug: string; verdict: string; reason?: string }>;
  const svc = createServiceClient();
  let ok = 0;
  for (const it of items) {
    const status = it.verdict === "accept" ? "auto-acceptat" : "marcat-uman";
    const { data } = await svc.from("figura_autor").select("gates").eq("slug", it.slug).single();
    const gates = (data?.gates ?? {}) as Record<string, unknown>;
    gates.visual_human = { verdict: it.verdict, reason: it.reason ?? "" };
    const { error } = await svc.from("figura_autor").update({ status, gates, updated_at: new Date().toISOString() }).eq("slug", it.slug);
    if (error) console.error("ERR", it.slug, error.message); else ok++;
  }
  console.log(`updated ${ok}/${items.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
