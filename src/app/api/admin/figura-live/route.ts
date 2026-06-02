import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { validateSpec, type FigureSpec2D } from '@/lib/figures/spec';
import { solvePyramid, solvePerpFromVertex, solvePolyhedron, validateScene, normalizeScene, type Body3D, type RegularPyramidSpec, type PerpFromVertexSpec, type PolyhedronBody, type Scene3D, type FigureSpec3D } from '@/lib/figures/spec3d';
import { verifyFigure2D, verifyFigure3D, type VerifyResult } from '@/lib/figures/verify';
import { axialSection, dihedralSection } from '@/lib/figures/axial';
import { solveAndVerify, solveAndVerify3D, type GeoProblem, type GeoProblem3D } from '@/lib/figures/cas';
import { coneSectionFigure, coneSectionScene, verifyConeSection, type ConeCut } from '@/lib/figures/relations';
import { modelAndView, type Entity } from '@/lib/figures/object-model';

const failedInvariants = (v: VerifyResult): string => v.checks.filter((c) => !c.pass).map((c) => `${c.name} (${c.detail})`).join(' · ');

const SUPPORTED_3D = ['regularPyramid', 'perpFromVertex', 'cube', 'box', 'prism', 'tetrahedron', 'frustum', 'cone', 'cylinder', 'sphere'];
const POLY_KINDS = ['cube', 'box', 'prism', 'tetrahedron', 'frustum'];

/** Validează parametrii unui corp 3D rulând solverul potrivit. */
function validateBody(b: Body3D): string | null {
  try {
    if (b.kind === 'regularPyramid') solvePyramid(b as RegularPyramidSpec);
    else if (b.kind === 'perpFromVertex') solvePerpFromVertex(b as PerpFromVertexSpec);
    else if (POLY_KINDS.includes(b.kind)) solvePolyhedron(b as PolyhedronBody);
    else if (b.kind === 'cone' || b.kind === 'cylinder') { if (!(b.radius > 0) || !(b.height > 0)) return 'radius și height trebuie pozitive.'; }
    else if (b.kind === 'sphere') { if (!(b.radius > 0)) return 'radius trebuie pozitiv.'; }
    else return 'kind necunoscut';
    return null;
  } catch (e) { return (e as Error).message; }
}

/**
 * ETAPA 27/28 — playground live enunț → figură. Admin-gated. FĂRĂ persistare, FĂRĂ căutare în DB:
 * extractorul rulează MEREU pe textul brut primit. Auto-reparare (max 2 runde) dacă validateSpec pică.
 * Diagnostic clar pe cazuri când nu se poate desena. ONESTITATE: 3D fără șablon → spune, nu fabrică.
 */
const MODEL = 'claude-sonnet-4-6';

export const SYSTEM_PROMPT =
  'Ești un extractor de FIGURI din enunțuri de geometrie (BAC MD). Clasifici și (dacă se poate) emiți o ' +
  'specificație, DOAR prin tool-ul record_figure_live.\n\n' +
  '🧩 DOUĂ ETAPE SEPARATE (ETAPA 43) — NU clasifica „2D/3D" după cum e comod de desenat:\n' +
  '  1) MODELEAZĂ OBIECTUL: emite ÎNTOTDEAUNA `object`={entities:[{kind,id?,role?}], relations:[…]}. Dimensiunea ține ' +
  'de ENTITATE: con/piramidă/sferă/cilindru/prismă/cub/poliedru/trunchi/tetraedru = CORP 3D, MEREU — chiar dacă secțiunea ' +
  'lui e un triunghi. triunghi/trapez/cerc/paralelogram/pătrat/romb ca obiect PRIMAR = 2D. relations ex.: "section", ' +
  '"inscribed", "tangent". Un con cu plan de secțiune NU devine „2D" fiindcă secțiunea e triunghi — rămâne corp 3D.\n' +
  '  2) Motorul ALEGE VEDEREA din model (pictogramă 3D implicit; secțiune axială DOAR la corpuri tangente înscrise — ' +
  'ambiguitate). Tu emiți datele de randare (geo3d/coneCut/scene/spec2d) potrivite obiectului; verdict reflectă obiectul.\n\n' +
  'PREFERĂ SĂ DESENEZI: emite ce poți. fara_figura DOAR pentru probleme pur algebrice/numerice fără desen. Pentru un ' +
  'CORP 3D folosește verdict="3d" (chiar dacă desenezi și o secțiune) — NU „figurabil_2d" doar fiindcă apare un triunghi.\n\n' +
  'CLASIFICARE:\n' +
  "- 'figurabil_2d' = obiect PRIMAR plan (triunghi/patrulater/trapez/romb/pătrat/cerc în plan). Emite spec2d/geo.\n" +
  '⛓ DEFINIȚII TIPIZATE (regulă conceptuală, NU pe enunț): un termen metric e DEFINIT de obiectele pe care le leagă; ' +
  'nu alegi tu construcția. „Distanța" e o FAMILIE după tipuri: distanță(punct,punct)=segment; distanță(punct,dreaptă)=' +
  'PERPENDICULARA (piciorul); distanță(punct,plan)=PERPENDICULARA. „la lungimea d PE o dreaptă/muchie/generatoare" = ' +
  'lungimePeDreaptă — RELAȚIE DISTINCTĂ, NU distanță. Mapează relația AȘA CUM E ENUNȚATĂ; NU substitui o construcție mai ' +
  'comodă (ex. NU pune un punct pe generatoare când enunțul spune distanța la PLAN). Obiectele impun metrica.\n' +
  '• OPERATOR „coneCut” — secțiune de con printr-un plan ∥ bază, poziționat după relația TIPIZATĂ din enunț: ' +
  'emite coneCut={cone:{radius,height}, by:{rel, value}} unde rel="distanceApexToParallelPlane" (enunțul dă distanța ' +
  'de la VÂRF la PLAN → perpendiculara) SAU rel="lengthAlongGeneratrixFromApex" (enunțul dă lungimea PE GENERATOARE de ' +
  'la vârf). Calculează radius din volum dacă e dat: V=(1/3)πR²H. Motorul derivă poziția axială canonic și o verifică.\n' +
  '⭐ OPERATOR PREFERAT „geo” (GEOMETRY CAS) — pentru ORICE figură PLANĂ cu NUMERE DATE (lungimi, unghiuri, arii, ' +
  'rapoarte, tangențe). NU plasezi NICIODATĂ coordonate. Emiți DOAR: entități + relații (construcție) + numerele DATE ' +
  '(constrângeri). Motorul calculează toate punctele prin FORMULE și RESPINGE automat dacă figura nu reproduce numerele.\n' +
  '  geo = { build:[pași constructivi, în ordine], givens:[numerele din enunț de reprodus] }\n' +
  '  build (seed-uri de cadru — motorul alege coordonatele): {op:"triangleSSS", ids:[A,B,C], ab, bc, ca} (laturile A-B,B-C,C-A) · ' +
  '{op:"isoFromBaseHeight", apex, left, right, base, height} (triunghi isoscel simetric; ex. SECȚIUNE AXIALĂ con: base=2R, height=H) · ' +
  '{op:"rightTriangle", right, legEnd, vert, leg, angleAtLegEnd} (triunghi dreptunghic; ex. DIEDRU la bază: leg=apotema r, angleAtLegEnd=diedru) · ' +
  '{op:"parallelogram", ids:[A,B,C,D], angleAt, angle, sideRatio:[r1,r2], scaleBy:{diagonal:"AC"|"BD"|"AB"|"AD", length}} · ' +
  '{op:"baseSegment", a, b, length}\n' +
  '  build (primitive generale riglă&compas): {op:"circle", id, center, radius?|through?} · {op:"line", id, through:[P,Q]} · ' +
  '{op:"perpLine"|"parallelLine", id, through, to:[P,Q]|idDreaptă} · {op:"intersect", id, of:[ref,ref], pick?:"upper"|"lower"|"left"|"right"|"first"|"second"|{near|far:P}} ' +
  '(ref=idDreaptă|idCerc|[P,Q]) · {op:"midpoint", id, of:[P,Q]} · {op:"foot", id, from:P, to:[Q,R]} · ' +
  '{op:"onSegment", id, seg:[P,Q], ratio?|dist?} · {op:"center", id, kind:"incenter"|"circumcenter"|"centroid"|"orthocenter", tri:[A,B,C]} · ' +
  '{op:"bisectorFoot", id, tri:[A,B,C], from} (piciorul bisectoarei pe latura opusă). radius/lungime poate fi {dist:[P,Q]}.\n' +
  '  givens (FIECARE număr din enunț): {kind:"length", of:[P,Q], value} · {kind:"angle", at, rays:[P,Q], value} · ' +
  '{kind:"rightAngle", at, rays:[P,Q]} · {kind:"area", of:[ids], value} · {kind:"incircleRadius", tri:[A,B,C], value} · ' +
  '{kind:"ratio", of:[[P,Q],[R,S]], value} · {kind:"tangent", circle:id, line:[P,Q]} · {kind:"collinear", points:[ids]}.\n' +
  '  Pune ÎN givens TOATE numerele din enunț (chiar consecințe verificabile: ex. în isoscel bisectoarea ⟂ baza). ' +
  'Pentru valori iraționale dă numărul exact (ex. 4√3 → 6.928203230275509). Motorul ACCEPTĂ doar dacă toate se potrivesc.\n' +
  '⭐ OPERATOR „geo3d” (GEOMETRY CAS 3D) — pentru SOLIDE cu NUMERE DATE (piramidă cu diedru la bază, apotemă, ' +
  'înălțime). Desenează SOLIDUL + construcția auxiliară (înălțime, apotemă, înclinată, diedru marcat) — NU un triunghi ' +
  'gol. NU plasezi coordonate; emiți construcția + numerele, motorul rezolvă prin formule și RESPINGE dacă nu se reproduc.\n' +
  '  geo3d = { build:[…], solid:{base:[ids în ordine], apex}, draw:{segments:[{of:[P,Q], dashed?, label?}], dihedral:{at, rays:[P,Q], label}}, givens:[…] }\n' +
  '  build (formule, ZERO coordonate): {op:"isoTrapezoidTangential", ids:[josStg,josDr,susDr,susStg], center, bottomBase, topBase} ' +
  '(trapez isoscel CIRCUMSCRIPTIBIL în baza piramidei; laturi=(a+b)/2, înălțime=√(latură²−((b−a)/2)²), incentru=center pe axă) · ' +
  '{op:"footOnEdge", id, from:center, edge:[P,Q]} (piciorul apotemei M pe muchia bazei) · ' +
  '{op:"apexOverPoint", apex, over:center, height:{mulTan:[{dist3:[center,M]}, diedru_grade]}} (V deasupra incentrului la H=r·tan(diedru)) · ' +
  '{op:"midpoint3", id, of:[P,Q]}. height poate fi număr, {dist3:[P,Q]}, {scale3:[expr,k]} sau {mulTan:[expr,grade]}.\n' +
  '  givens (FIECARE număr): {kind:"length3", of:[P,Q], value} · {kind:"angle3", at, rays:[P,Q], value} (diedrul = angle3 la M între center și apex) · ' +
  '{kind:"sumEqual", left:[[P,Q]…], right:[[R,S]…], name?} (tangențial: Σbaze=Σlaturi). Valori iraționale exacte (4√3→6.928203230275509).\n' +
  '  draw: înălțimea center→apex (dashed:true), apotema center→M, înclinata apex→M, dihedral la M cu eticheta „60°".\n' +
  '  Ex. „piramidă cu baza trapez circumscriptibil baze 4 și 16, diedru la baza mare 60°”: isoTrapezoidTangential(16,4) → ' +
  'footOnEdge(M pe baza lungă) → apexOverPoint(H=r·tan60); solid={base:[cele 4 colțuri], apex:V}; givens cu bazele, latura 10, ' +
  'sumEqual tangențial, OM=4, ∠OMV=60, VO=4√3, VM=8.\n' +
  'PRINCIPIU: figura de stereometrie arată MĂRIMEA cerută (diedru, apotemă, înălțime, tangență) = SECȚIUNEA/construcția ' +
  'auxiliară din rezolvare, NU solidul gol. NU desena tu secțiunea cu coordonate — exprimi COMPOZIȚIA, motorul o realizează prin OPERATORI:\n' +
  '• OPERATOR „secțiune axială” — corpuri de ROTAȚIE înscrise/tangente/secționate (sferă-con, cilindru-con, sferă-cilindru, con-sferă, ' +
  'sau un singur corp de rotație despre care se cere o secțiune): emite `scene`={elements:[…]} cu cone3d{id,radius,height}, ' +
  'sphere3d{radius}, cylinder3d{id,radius,height}, inscribedSphere{in:idCorp}, segment3d (axă/apotemă auxiliară) ȘI render3d:"axial". ' +
  'Motorul secționează fiecare corp (con→triunghi isoscel, sferă înscrisă→cercul înscris tangent, cilindru→dreptunghi) și compune figura 2D. NU pune coordonate.\n' +
  '• OPERATOR „secțiune diedru la bază” — unghi diedru la baza piramidei / apotemă / înălțime via diedru: emite ' +
  'section={kind:"dihedralBase", apothem:r, angle:diedru_grade}, unde r = apotema bazei (o CALCULEZI din bază: trapez ' +
  'circumscriptibil baze a,b → laturi (a+b)/2, înălțime h=√(latură²−((b−a)/2)²), r=h/2; pătrat latură a → r=a/2; etc.). ' +
  'Motorul desenează triunghiul dreptunghic VOM (OM=r, OV=H=r·tan(diedru), ∠M=diedru, unghi drept la O).\n' +
  "- '3d' = STEREOMETRIE (un SINGUR corp simplu: pictogramă 3D). Șabloane disponibile (emite body3d cu kind potrivit; calculează parametrii din date):\n" +
  '    • {kind:"regularPyramid", baseSides, baseEdge, height, labels?} — piramidă regulată\n' +
  '    • {kind:"cube", edge, labels?} — cub\n' +
  '    • {kind:"box", length, width, height, labels?} — paralelipiped dreptunghic\n' +
  '    • {kind:"prism", baseSides, baseEdge, height, labels?} — prismă regulată\n' +
  '    • {kind:"tetrahedron", edge, labels?} — tetraedru regulat\n' +
  '    • {kind:"frustum", baseSides, baseEdge, topEdge, height, labels?} — trunchi de piramidă regulată\n' +
  '    • {kind:"cone", radius, height} — con · {kind:"cylinder", radius, height} — cilindru · {kind:"sphere", radius} — sferă\n' +
  '    • {kind:"perpFromVertex", triangle:{sides:{AB,BC,CA}}, apexFrom, apexHeight, apexLabel?, labels?} — triunghi în plan + ' +
  'segment perpendicular pe plan dintr-un vârf (teorema celor 3 perpendiculare; distanța de la un punct la o dreaptă). ' +
  'Echilateral cu aria S → latura = sqrt(4·S/√3) (arie 4√3 → latura 4).\n' +
  '  Dacă NICIUN șablon de mai sus nu se potrivește (corp NEREGULAT/COMPUS: piramidă cu bază oarecare, ' +
  'combinație de corpuri, corp înscris în alt corp), COMPUNE o `scene` din primitive GENERALE — NU refuza:\n' +
  '  scene = { points:[…], elements:[…] }\n' +
  '  points: {id,x,y,z} explicit · {gen:"regularPolygon3d", ids:[…], sides, edge|circumradius, z?, center?} · ' +
  '{gen:"pointOnAxis", id, height, overCentroidOf?:[ids]|over?:[x,y]} (vârf pe axă) · {gen:"midpoint3d", id, of:[p,q]} · {gen:"centroid3d", id, of:[ids]}\n' +
  '  elements: {kind:"polyhedron", vertices:[ids], faces:[[ids]…]} (ORICE poliedru) · {kind:"sphere3d", center?, radius} · ' +
  '{kind:"cone3d", id?, radius, height, baseCenter?} · {kind:"cylinder3d", id?, radius, height, baseCenter?} · ' +
  '{kind:"inscribedSphere", in:idCon} (REFERĂ un cone3d existent prin id; ia R,H din el; tangența ρ rezolvată) · ' +
  '{kind:"segment3d", of:[p,q], dash?} · {kind:"label3d", at, text}\n' +
  '  Ex. „sferă înscrisă într-un con r=6 h=8”: DOUĂ elemente — {kind:"cone3d", id:"con", radius:6, height:8} ȘI ' +
  '{kind:"inscribedSphere", in:"con"}. NU pune referințe la puncte inexistente (baseCenter implicit = originea).\n' +
  '  Ex. piramidă cu bază dreptunghi: points = 4 colțuri explicite + {gen:"pointOnAxis", id:"V", height, overCentroidOf:[colțuri]}; ' +
  'elements = polyhedron cu fețele bazei + 4 fețe laterale către V.\n' +
  '  REFUZĂ (fără body3d/scene, doar body3d_name) DOAR ce e genuin nereprezentabil (suprafețe curbe complexe, loc geometric continuu).\n' +
  "- 'fara_figura' = fără desen (algebră, ecuații, combinatorică, probabilitate, „pătrat perfect” = număr).\n\n" +
  'SCHEMA spec2d (DOAR aceste kind-uri, constrângeri NU coordonate inventate):\n' +
  '{ points:[{id,x,y,label?}], elements:[…], intersections?:"detect"|"label-all"|[{of:[ref,ref],label?}] }\n' +
  'REGULĂ: `points` e GOL ([]) când nu există coordonate explicite — vârfurile vin din `ids`/`labels` ale generatorilor.\n' +
  '- triangleFromSides {ids:[A,B,C], sides:{AB,BC,CA}} (cheile EXACT AB, BC, CA — laturile A-B, B-C, C-A; NU „AC”) · quadFromConstraints {ids:[A,B,C,D], angleAt, angle, sideRatio:[r1,r2], scaleBy:{diagonal:"AC"|"BD"|"AB"|"AD", length}}\n' +
  '- polygon {points:[ids], shade?, hatch?} · segment {between:[a,b], label?, showLength?, id?} · midpoint {of:[a,b], label?, id?}\n' +
  '- pointOnSegment {on:[a,b], ratio?|distanceFromA?, label?, id?} · median|bisector|altitude|perpBisector {of:[A,B,C], from, label?, id?}\n' +
  '- circle {center, through?|radius?, centerLabel?, id?} · incircle|circumcircle {of:[A,B,C], centerLabel?}\n' +
  '- point {from:"incenter"|"circumcenter"|"centroid"|"orthocenter", of?:[A,B,C], label?, id?} · point {from:"intersection", of:[ref,ref], label?, id?}\n' +
  '- angle {at, from:[p1,p2], value?:true, label?} · rightAngle {at, from:[p1,p2]} · equalAngle {at, from, count?}\n' +
  '- perpendicular|parallel {through, toSegment:[a,b], id?} · parallelAtDistance {parallelTo:[a,b], offsetFrom, distance, id?}\n' +
  '- equalMark|parallelMark {on:[a,b], count?} · tangentLines {from, to:idCerc, pointLabels?}\n' +
  'ref = id de element SAU [idP,idP]. Dacă o relație cerută NU se poate exprima cu kind-urile de mai sus, ' +
  'pune unsupported_relation = descrierea ei (și emite restul figurii ce se poate).\n\n' +
  'EXEMPLE (enunț → spec2d):\n' +
  '1) „Triunghi ABC cu AB=7, BC=8, CA=9; mediana din A.” → {"points":[],"elements":[' +
  '{"kind":"triangleFromSides","ids":["A","B","C"],"sides":{"AB":7,"BC":8,"CA":9}},' +
  '{"kind":"polygon","points":["A","B","C"]},{"kind":"median","of":["A","B","C"],"from":"A"}]}\n' +
  '2) „Paralelogram ABCD, ∠A=60°, AB:AD=1:2, BD=3.” → {"points":[],"elements":[' +
  '{"kind":"quadFromConstraints","ids":["A","B","C","D"],"angleAt":"A","angle":60,"sideRatio":[1,2],"scaleBy":{"diagonal":"BD","length":3}},' +
  '{"kind":"polygon","points":["A","B","C","D"]},{"kind":"segment","between":["B","D"],"label":"BD"},' +
  '{"kind":"angle","at":"A","from":["B","D"],"value":true}]}\n' +
  '3) „Triunghi ABC (6,7,8) cu cercul înscris.” → {"points":[],"elements":[' +
  '{"kind":"triangleFromSides","ids":["A","B","C"],"sides":{"AB":6,"BC":7,"CA":8}},' +
  '{"kind":"polygon","points":["A","B","C"]},{"kind":"incircle","of":["A","B","C"],"centerLabel":"I"}]}';

export const TOOL: Anthropic.Messages.Tool = {
  name: 'record_figure_live',
  description: 'Clasifică enunțul și emite spec2d (2D) / body3d (piramidă regulată) / body3d_name (3D fără șablon).',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['figurabil_2d', '3d', 'fara_figura'] },
      reason: { type: 'string' },
      object: { type: ['object', 'null'], description: 'MODELUL OBIECTULUI (ETAPA 43): entități + relații. Dimensiunea se DEDUCE din entitate (con/piramidă/sferă=3D), NU din desen. {entities:[{kind,id?,role?}], relations:[…]}', properties: { entities: { type: 'array' }, relations: { type: 'array', items: { type: 'string' } } } },
      geo: { type: ['object', 'null'], description: 'GEOMETRY CAS 2D: build (constrângeri, ZERO coordonate) + givens (numerele din enunț). Preferat pentru figuri plane cu numere.', properties: { build: { type: 'array' }, givens: { type: 'array' } } },
      geo3d: { type: ['object', 'null'], description: 'GEOMETRY CAS 3D: solid din constrângeri (build) + solid{base,apex} + draw{segments,dihedral} + givens. Pentru piramide/corpuri cu numere date (diedru, apotemă, înălțime). ZERO coordonate.', properties: { build: { type: 'array' }, solid: { type: 'object' }, draw: { type: 'object' }, givens: { type: 'array' } } },
      coneCut: { type: ['object', 'null'], description: 'Secțiune de con prin plan ∥ bază, după relația TIPIZATĂ. {cone:{radius,height}, by:{rel:"distanceApexToParallelPlane"|"lengthAlongGeneratrixFromApex", value}}.', properties: { cone: { type: 'object', properties: { radius: { type: 'number' }, height: { type: 'number' } } }, by: { type: 'object', properties: { rel: { type: 'string' }, value: { type: 'number' } } } } },
      spec2d: { type: ['object', 'null'], properties: { points: { type: 'array' }, elements: { type: 'array' }, intersections: {} } },
      body3d: {
        type: ['object', 'null'],
        properties: {
          kind: { type: 'string', enum: ['regularPyramid', 'cube', 'box', 'prism', 'tetrahedron', 'frustum', 'cone', 'cylinder', 'sphere', 'perpFromVertex'] },
          baseSides: { type: 'integer' }, baseEdge: { type: 'number' }, topEdge: { type: 'number' }, height: { type: 'number' },
          edge: { type: 'number' }, length: { type: 'number' }, width: { type: 'number' }, radius: { type: 'number' },
          labels: { type: 'array', items: { type: 'string' } },
          triangle: { type: 'object', properties: { sides: { type: 'object', properties: { AB: { type: 'number' }, BC: { type: 'number' }, CA: { type: 'number' } } } } },
          apexFrom: { type: 'string' }, apexHeight: { type: 'number' }, apexLabel: { type: 'string' },
        },
      },
      body3d_name: { type: 'string', description: 'Tipul corpului 3D doar dacă e GENUIN nereprezentabil (nici body3d, nici scene).' },
      scene: { type: ['object', 'null'], description: 'Scenă 3D compusă din primitive (pt. corpuri ne-standard/compuse).', properties: { points: { type: 'array' }, elements: { type: 'array' } } },
      render3d: { type: 'string', enum: ['axial', 'pictogram'], description: 'axial = motorul face SECȚIUNEA AXIALĂ 2D a scenei (corpuri de rotație înscrise/tangente).' },
      section: { type: ['object', 'null'], description: 'Operator de secțiune. dihedralBase: {kind:"dihedralBase", apothem, angle}.', properties: { kind: { type: 'string' }, apothem: { type: 'number' }, angle: { type: 'number' } } },
      unsupported_relation: { type: 'string', description: 'Relație 2D care nu se poate exprima cu kind-urile date.' },
    },
    required: ['verdict', 'reason'],
  },
};

interface ModelOut { verdict?: string; reason?: string; object?: { entities?: Entity[]; relations?: string[] } | null; geo?: GeoProblem | null; geo3d?: GeoProblem3D | null; coneCut?: { cone?: { radius?: number; height?: number }; by?: ConeCut } | null; spec2d?: unknown; body3d?: (Body3D & { kind?: string }) | null; scene?: Scene3D | null; body3d_name?: string; unsupported_relation?: string; render3d?: string; section?: { kind?: string; apothem?: number; angle?: number } }

/** Verifică o figură 2D (structură + invariante) → {valid, error}. */
function check2D(spec: FigureSpec2D): { valid: boolean; error: string | null } {
  const v = validateSpec(spec);
  if (v.errors.length) return { valid: false, error: v.errors.join(' · ') };
  const ver = verifyFigure2D(spec);
  return ver.ok ? { valid: true, error: null } : { valid: false, error: failedInvariants(ver) };
}

async function callTool(anthropic: Anthropic, userContent: string): Promise<ModelOut> {
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 3000, system: SYSTEM_PROMPT,
    tools: [TOOL], tool_choice: { type: 'tool', name: 'record_figure_live' },
    messages: [{ role: 'user', content: userContent }],
  });
  const tu = msg.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
  return (tu?.input ?? {}) as ModelOut;
}

function check(spec: unknown): { valid: boolean; error: string | null } {
  try { const v = validateSpec(spec as FigureSpec2D); return { valid: v.errors.length === 0, error: v.errors.join(' · ') || null }; }
  catch (e) { return { valid: false, error: `validateSpec: ${(e as Error).message}` }; }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
  if (profile?.subscription_status !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  let body: { text?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 4000) : '';
  if (!text) return NextResponse.json({ error: 'Lipsește enunțul.' }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Lipsește ANTHROPIC_API_KEY.' }, { status: 500 });

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // Rulează MEREU extractorul pe textul brut (fără căutare în DB).
    const out = await callTool(anthropic, `Enunț:\n${text}\n\nClasifică și extrage prin record_figure_live.`);
    const verdict = out.verdict ?? 'fara_figura';
    const reason = out.reason ?? '';
    const unsupportedRelation = out.unsupported_relation || null;

    // ── ETAPA 43: MODELUL OBIECTULUI (dimensiune intrinsecă) → ALEGEREA VEDERII (cu motiv). NU clasificăm 2D/3D după desen. ──
    const objView = out.object && Array.isArray(out.object.entities) && out.object.entities.length
      ? modelAndView(out.object.entities as Entity[], out.object.relations ?? [])
      : null;
    const objMeta = objView ? { object: { dim: objView.model.intrinsicDim, reason: objView.model.reason }, view: objView.choice.view, viewReason: objView.choice.reason, viewDetail: objView.choice.alongside } : {};

    // ── GEOMETRY CAS (ETAPA 41): constrângeri → solver → auto-verificare. Se AUTO-RESPINGE dacă nu reproduce numerele. ──
    if (out.geo && typeof out.geo === 'object' && Array.isArray(out.geo.build) && out.geo.build.length) {
      const res = solveAndVerify(out.geo as GeoProblem);
      if (!res.accepted) {
        const diagnostic = `CAS a RESPINS (figura nu reproduce numerele date): ${res.reason ?? 'inconsistență'}`;
        return NextResponse.json({ dim: '2d', verdict: 'figurabil_2d', reason, valid: false, error: res.reason, diagnostic, cas: true, checks: res.checks });
      }
      return NextResponse.json({ dim: '2d', verdict: 'figurabil_2d', reason, spec: res.spec, valid: true, error: null, cas: true, checks: res.checks });
    }

    // ── RELAȚIE TIPIZATĂ + VEDERE (ETAPA 42/43): secțiune de con. OBIECTUL e 3D → IMPLICIT pictogramă 3D ──
    if (out.coneCut && out.coneCut.cone && out.coneCut.by && typeof out.coneCut.cone.radius === 'number' && typeof out.coneCut.cone.height === 'number') {
      const { radius, height } = out.coneCut.cone; const by = out.coneCut.by as ConeCut;
      const v = verifyConeSection(radius, height, by, {}); // recompune din coordonate (plasa de siguranță)
      // Vederea: conul e CORP 3D ⇒ pictogramă 3D (con + cerc-secțiune), NU triunghi 2D. Secțiune 2D doar dacă vederea aleasă o cere.
      const wantSection2D = objView?.choice.view === 'axialSection';
      if (!wantSection2D) {
        const scene = coneSectionScene(radius, height, by);
        if (!scene) return NextResponse.json({ dim: '3d', verdict: '3d', reason, valid: false, error: 'con/secțiune invalidă', diagnostic: 'coneCut: parametri invalizi', typed: true, ...objMeta });
        const ver = verifyFigure3D({ scene } as FigureSpec3D);
        if (!ver.ok) return NextResponse.json({ dim: '3d', verdict: '3d', reason, spec: { scene }, valid: false, error: failedInvariants(ver), diagnostic: `invariante 3D picate: ${failedInvariants(ver)}`, typed: true, ...objMeta });
        return NextResponse.json({ dim: '3d', verdict: '3d', reason, spec: { scene }, valid: true, error: null, typed: true, relation: by.rel, checks: v.checks, ...objMeta });
      }
      const spec = coneSectionFigure(radius, height, by);
      if (!spec) return NextResponse.json({ dim: '2d', verdict: 'figurabil_2d', reason, valid: false, error: 'con/secțiune invalidă', diagnostic: 'coneCut: parametri invalizi', typed: true, ...objMeta });
      const { valid, error } = check2D(spec);
      return NextResponse.json({ dim: '2d', verdict: 'figurabil_2d', reason, spec, valid, error, typed: true, relation: by.rel, checks: v.checks, ...objMeta });
    }

    // ── GEOMETRY CAS 3D (ETAPA 42): solid din constrângeri → proiecție + construcție auxiliară. Auto-respinge. ──
    if (out.geo3d && typeof out.geo3d === 'object' && Array.isArray(out.geo3d.build) && out.geo3d.build.length) {
      const res = solveAndVerify3D(out.geo3d as GeoProblem3D);
      if (!res.accepted) {
        const diagnostic = `CAS 3D a RESPINS (solidul nu reproduce numerele date): ${res.reason ?? 'inconsistență'}`;
        return NextResponse.json({ dim: '3d', verdict: '3d', reason, valid: false, error: res.reason, diagnostic, cas: true, checks: res.checks });
      }
      // re-validează scena prin invariantele 3D (poartă comună cu randorul)
      const ver = verifyFigure3D(res.spec as FigureSpec3D);
      if (!ver.ok) return NextResponse.json({ dim: '3d', verdict: '3d', reason, spec: res.spec, valid: false, error: failedInvariants(ver), diagnostic: `invariante 3D picate: ${failedInvariants(ver)}`, cas: true });
      return NextResponse.json({ dim: '3d', verdict: '3d', reason, spec: res.spec, valid: true, error: null, cas: true, composed: true, checks: res.checks });
    }

    // ── OPERATORI GENERALI (compun figura 2D din concepte — fără ramuri per-problemă) ──
    if (out.section?.kind === 'dihedralBase' && typeof out.section.apothem === 'number' && typeof out.section.angle === 'number') {
      const spec = dihedralSection(out.section.apothem, out.section.angle);
      const { valid, error } = check2D(spec);
      return NextResponse.json({ dim: '2d', verdict: 'figurabil_2d', reason, spec, valid, error, composed: true, operator: 'dihedralBase' });
    }
    if (out.render3d === 'axial' && out.scene && typeof out.scene === 'object') {
      const scene = normalizeScene(out.scene as Scene3D);
      const sv = validateScene(scene);
      if (sv.errors.length) return NextResponse.json({ dim: '2d', verdict, reason, valid: false, error: sv.errors.join(' · '), diagnostic: `scenă invalidă: ${sv.errors.join(' · ')}` });
      const spec = axialSection(scene);
      const { valid, error } = check2D(spec);
      return NextResponse.json({ dim: '2d', verdict: 'figurabil_2d', reason, spec, valid, error, composed: true, operator: 'axialSection' });
    }

    if (verdict === 'figurabil_2d' && out.spec2d && typeof out.spec2d === 'object') {
      let spec = out.spec2d;
      let { valid, error } = check(spec);
      let repaired = 0;
      // AUTO-REPARARE: max 2 runde, retrimite specul + eroarea exactă.
      while (!valid && repaired < 2) {
        repaired++;
        const fix = await callTool(anthropic,
          `Enunț:\n${text}\n\nSpecul tău anterior A PICAT validarea cu erorile:\n${error}\n\n` +
          `Specul anterior:\n${JSON.stringify(spec)}\n\nCorectează-l (DOAR aceleași kind-uri, verdict="figurabil_2d") și re-emite prin record_figure_live.`);
        if (fix.spec2d && typeof fix.spec2d === 'object') { spec = fix.spec2d; ({ valid, error } = check(spec)); }
        else break;
      }
      // INVARIANTE numerice (peste validarea structurală)
      if (valid) { const ver = verifyFigure2D(spec as FigureSpec2D); if (!ver.ok) { valid = false; error = `invariante picate: ${failedInvariants(ver)}`; } }
      const diagnostic = valid ? null : `validare eșuată după reparare (${repaired} runde): ${error}`;
      return NextResponse.json({ dim: '2d', verdict, reason, spec, valid, error, repaired, unsupportedRelation, diagnostic });
    }

    if (verdict === '3d') {
      const b = out.body3d;
      // 1) corp standard (șablon)
      if (b && b.kind && SUPPORTED_3D.includes(b.kind)) {
        const err = validateBody(b as Body3D);
        if (err) return NextResponse.json({ dim: '3d', verdict, reason, valid: false, error: err, diagnostic: `parametri 3D invalizi: ${err}` });
        const ver = verifyFigure3D({ body: b } as FigureSpec3D);
        if (!ver.ok) return NextResponse.json({ dim: '3d', verdict, reason, spec: { body: b }, valid: false, error: failedInvariants(ver), diagnostic: `invariante picate: ${failedInvariants(ver)}` });
        return NextResponse.json({ dim: '3d', verdict, reason, spec: { body: b }, valid: true, error: null });
      }
      // 2) corp ne-standard/compus → scenă din primitive generale (normalizată: refs de plasare danglinge → origine)
      if (out.scene && typeof out.scene === 'object') {
        const scene = normalizeScene(out.scene as Scene3D);
        const v = validateScene(scene);
        if (v.errors.length) return NextResponse.json({ dim: '3d', verdict, reason, spec: { scene }, valid: false, error: v.errors.join(' · '), diagnostic: `scenă invalidă: ${v.errors.join(' · ')}` });
        const ver = verifyFigure3D({ scene } as FigureSpec3D);
        if (!ver.ok) return NextResponse.json({ dim: '3d', verdict, reason, spec: { scene }, valid: false, error: failedInvariants(ver), diagnostic: `invariante picate: ${failedInvariants(ver)}`, composed: true });
        return NextResponse.json({ dim: '3d', verdict, reason, spec: { scene }, valid: true, error: null, composed: true });
      }
      // 3) genuin nereprezentabil
      const name = out.body3d_name || 'necunoscut';
      return NextResponse.json({ dim: '3d', verdict, reason, unsupported: true, message: `3D nereprezentabil deocamdată: „${name}”.`, diagnostic: `3D nereprezentabil: „${name}”` });
    }

    if (unsupportedRelation) {
      return NextResponse.json({ dim: 'none', verdict, reason, message: `Relație neacoperită: ${unsupportedRelation}`, diagnostic: `relație neacoperită: ${unsupportedRelation}` });
    }
    return NextResponse.json({ dim: 'none', verdict: 'fara_figura', reason, message: `Fără figură${reason ? `: ${reason}` : ''}.`, diagnostic: `fără figură${reason ? `: ${reason}` : ''}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
