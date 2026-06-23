# ETAPA 83 FAZA E — Informația în pătrățele (carduri)

## Stare: dashboard-urile sunt deja card-structurate (verificat) + ajustări

- **/app/azi**: card de salut (F) + cardul daily + carduri per concept de frontieră
  (titlu = numele conceptului, esență = clasa + exerciții, detaliu = „de ce e următorul").
- **/app/progres**: grilă `StatCard` (4 cifre) + card predicție + harta + card „Unde
  greșești des" + card „Ultimele activități" — toate `rounded-2xl … p-5`, ierarhie
  titlu/esență/detaliu. Adăugat `stagger-children` (intrare eșalonată 40ms, ETAPA 77).
- **/app/setari**: secțiuni-card (clasă+obiectiv, notificări, email părinte).
- **Fluxul de rezolvare matematică**: NU a fost cardificat (rămâne flux liniar) — conform mandatului.

## Registrul de vocabular implicit = comun/punte (NU barem)
- `LessonPlayer.tsx:95` pornește pe `"punte"`; override manual (Simplu↔Riguros) persistă.
- `masteryToRegister`: mastery 0 → **comun**, [0.3,0.6) → **punte**, ≥0.6 → barem
  (barem doar pentru concept STĂPÂNIT). Elevul mediu (evidență mică) primește comun/punte.
- Lăcătuit cu test de regres (`tests/lesson/vocab.test.ts` — „ETAPA 83 E").

## Concluzie
Aplicația era deja orientată pe carduri (nu pereți de text), iar registrul implicit
era deja comun/punte (ETAPA 81). FAZA E a confirmat + lăcătuit aceste invariante și a
adăugat intrarea eșalonată pe dashboard-ul de progres. Zero churn riscant pe un UI funcțional.
