-- ETAPA 72 P3b: marcarea body-urilor cu probleme LaTeX (delimitatori
-- nebalansați, formule suspecte) pentru revizuire — NU se rescrie conținut.
alter table concepts add column if not exists body_latex_issues text;
