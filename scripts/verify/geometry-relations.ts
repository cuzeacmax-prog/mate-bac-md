/**
 * ETAPA 42 — Probă pentru STRATUL DE DEFINIȚII TIPIZATE. Dovada că e CONCEPTUAL, nu o regulă punctuală:
 * ACELAȘI cuvânt („distanța", „lungime"), obiecte DIFERITE → metrici DIFERITE, toate corecte — pentru că
 * obiectele determină metrica, nu AI-ul.   Rulează:  npm run verify:geo-relations
 */
import { distance, coneSection, verifyConeSection, type GeoObject } from "../../src/lib/figures/relations";

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

interface Row { enunt: string; tipuri: string; canonic: string; numere: string; pass: boolean; verdict: string }
const rows: Row[] = [];
let allOk = true;
const push = (r: Row) => { rows.push(r); if (!r.pass) allOk = false; };

// Con din V=18π, H=6 → (1/3)πR²H=18π → R=3, generatoare=√(9+36)=3√5.
const R = 3, H = 6;

// 1) „distanța de la vârf la planul ∥ bază = 2” → distanță(punct,plan) = perpendiculara → axial 2, r=1, arie π.
{
  const sec = coneSection(R, H, { rel: "distanceApexToParallelPlane", value: 2 });
  const v = verifyConeSection(R, H, { rel: "distanceApexToParallelPlane", value: 2 }, { axial: 2, radius: 1, area: Math.PI });
  push({
    enunt: "con R3 H6, plan ∥ bază la distanța 2 de vârf",
    tipuri: "distanță(punct=V, plan)", canonic: sec.canonical,
    numere: `axial=${r3(sec.axialFromApex)} r=${r3(sec.radius)} arie=${r3(sec.area)} (π=${r3(Math.PI)})`,
    pass: v.ok, verdict: v.ok ? "ACCEPTAT ✅" : "RESPINS ⛔",
  });
}

// 2) ACELAȘI con, „punct pe generatoare la 2 de vârf” → lungimePeDreaptă → axial = 4/√5 (ALT rezultat).
{
  const expAxial = 4 / Math.sqrt(5);
  const sec = coneSection(R, H, { rel: "lengthAlongGeneratrixFromApex", value: 2 });
  const v = verifyConeSection(R, H, { rel: "lengthAlongGeneratrixFromApex", value: 2 }, { axial: expAxial });
  const distinct = !eq(sec.axialFromApex, 2); // TREBUIE să difere de cazul 1
  push({
    enunt: "ACELAȘI con, punct pe generatoare la lungimea 2 de vârf",
    tipuri: "lungimePeDreaptă(generatoare, de la V)", canonic: sec.canonical,
    numere: `axial=${r3(sec.axialFromApex)}=4/√5 (≠2: ${distinct}) r=${r3(sec.radius)} arie=${r3(sec.area)}`,
    pass: v.ok && distinct, verdict: v.ok && distinct ? "ACCEPTAT ✅ (alt enunț, alt rezultat)" : "RESPINS ⛔",
  });
}

// 3) „distanța de la un punct la o dreaptă” → perpendiculara (NU distanța la un punct anume al dreptei).
{
  const P: GeoObject = { type: "point", at: [0, 3, 0] };
  const line: GeoObject = { type: "line", through: [[0, 0, 0], [1, 0, 0]] }; // Ox
  const m = distance(P, line);
  const wrong = distance(P, { type: "point", at: [4, 0, 0] }).value!; // dist la un punct anume = 5 (greșit)
  const pass = m.ok && eq(m.value!, 3) && !eq(wrong, 3);
  push({
    enunt: "distanța de la P(0,3,0) la dreapta Ox",
    tipuri: "distanță(punct, dreaptă)", canonic: m.canonical,
    numere: `perpendiculara=${r3(m.value!)} (=3) · dist-la-un-punct=${r3(wrong)} (≠3, deci NU asta)`,
    pass, verdict: pass ? "ACCEPTAT ✅" : "RESPINS ⛔",
  });
}

// 4) „distanța de la un punct la un punct” → segment (cel mai simplu membru al familiei).
{
  const m = distance({ type: "point", at: [0, 0, 0] }, { type: "point", at: [3, 4, 0] });
  const pass = m.ok && eq(m.value!, 5);
  push({ enunt: "distanța de la (0,0,0) la (3,4,0)", tipuri: "distanță(punct, punct)", canonic: m.canonical, numere: `segment=${r3(m.value!)} (=5)`, pass, verdict: pass ? "ACCEPTAT ✅" : "RESPINS ⛔" });
}

// 5) CONTROL — substituția COMODĂ prinsă: pt. enunțul „distanță(vârf,plan)=2”, dacă AI-ul folosește lungimePeDreaptă
//    obține axial 4/√5 ≠ 2 → plasa de siguranță (ETAPA 41) RESPINGE construcția greșită.
{
  const wrong = verifyConeSection(R, H, { rel: "lengthAlongGeneratrixFromApex", value: 2 }, { axial: 2 }); // așteptat 2 (din enunț)
  const caught = !wrong.ok; // trebuie să PICE
  push({
    enunt: "CONTROL: enunț „distanță(vârf,plan)=2”, dar construcție lungimePeDreaptă (substituție comodă)",
    tipuri: "lungimePeDreaptă în loc de distanță(punct,plan)", canonic: "greșit — altă metrică",
    numere: `axial=${r3(4 / Math.sqrt(5))} ≠ 2 cerut → auto-verificarea PICĂ`,
    pass: caught, verdict: caught ? "RESPINS ⛔ (corect — substituția prinsă)" : "ACCEPTAT (BUG)",
  });
}

// 6) Semnătură de tip NESUPORTATĂ → NU ghici, respinge.
{
  const m = distance({ type: "body", kind: "con" }, { type: "body", kind: "sferă" });
  const pass = !m.ok;
  push({ enunt: "distanța între două corpuri (nedefinită canonic)", tipuri: "distanță(corp, corp)", canonic: m.error ?? "—", numere: "—", pass, verdict: pass ? "RESPINS ⛔ (corect — nedefinit)" : "ACCEPTAT (BUG)" });
}

console.log("\n════════ DEFINIȚII TIPIZATE — relația determinată de OBIECTE, nu de parafrază ════════\n");
for (const r of rows) {
  console.log(`${r.pass ? "✓" : "✗"} ${r.enunt}`);
  console.log(`    relația tipizată : ${r.tipuri}`);
  console.log(`    metrica canonică : ${r.canonic}`);
  console.log(`    numere           : ${r.numere}`);
  console.log(`    → ${r.verdict}\n`);
}
console.log(allOk
  ? "✅ Conceptual confirmat: același cuvânt + obiecte diferite ⇒ metrici diferite, toate corecte; substituția comodă RESPINSĂ."
  : "❌ Stratul de definiții tipizate nu distinge corect.");
process.exit(allOk ? 0 : 1);
