/**
 * render-test.ts — VERIFICARE randare JPEG2000 (ETAPA 2.3), FĂRĂ vision, FĂRĂ cost.
 *
 * Rulează DOAR randarea PDF→PNG cu MuPDF pe paginile care dădeau erori la pdfjs
 * ("JpxError: OpenJPEG failed to initialize") și salvează PNG-urile pe disc pentru
 * inspecție umană. NU apelează modelul, NU scrie în DB, NU costă nimic.
 *
 * Rulează:  npx tsx scripts/extraction/render-test.ts
 *           (sau cu argumente: --pdf <cale> --pages "85,86,87" --dpi 130)
 *
 * Output:   scripts/extraction/output/_render-test/<nume-pdf>-page-<N>.png
 */

import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPdfForRender, OUTPUT_DIR } from './01-inventory';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Valori implicite = exact cazul raportat (clasa 3, paginile 85-87, ~130 DPI).
const DEFAULT_PDF = path.resolve(__dirname, '../../docs/manuale-source/clasa-03.pdf');
const DEFAULT_PAGES = [85, 86, 87];
const DEFAULT_DPI = 130;

function parsePagesArg(spec: string | undefined): number[] {
  if (!spec || spec.trim() === '') return DEFAULT_PAGES;
  return spec
    .split(',')
    .map((t) => parseInt(t.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      pdf: { type: 'string' },
      pages: { type: 'string' },
      dpi: { type: 'string' },
    },
  });

  const pdfPath = values.pdf ? path.resolve(values.pdf) : DEFAULT_PDF;
  const pages = parsePagesArg(values.pages);
  const dpi = values.dpi ? parseInt(values.dpi, 10) : DEFAULT_DPI;

  const testDir = path.join(OUTPUT_DIR, '_render-test');
  await fs.mkdir(testDir, { recursive: true });

  const pdfName = path.basename(pdfPath, path.extname(pdfPath));

  console.log(`🧪 RENDER-TEST (fără vision, fără cost)`);
  console.log(`   PDF:    ${pdfPath}`);
  console.log(`   Pagini: [${pages.join(', ')}]  @ ${dpi} DPI`);
  console.log(`   Output: ${testDir}\n`);

  // Capturăm orice warning de decodare emis în consolă (ex. JPEG2000/JPX).
  let decodeWarnings = 0;
  const origWarn = console.warn.bind(console);
  const origErr = console.error.bind(console);
  const watch = (sink: (...a: unknown[]) => void) => (...args: unknown[]) => {
    const msg = args.map(String).join(' ');
    if (/jpx|jpeg ?2000|openjpeg|decode/i.test(msg)) decodeWarnings++;
    sink(...args);
  };
  console.warn = watch(origWarn) as typeof console.warn;
  console.error = watch(origErr) as typeof console.error;

  const doc = await openPdfForRender(pdfPath, dpi);
  console.log(`   → ${doc.length} pagini în PDF.\n`);

  for (const p of pages) {
    if (p > doc.length) {
      console.log(`  ⚠️  pagina ${p} depășește numărul de pagini (${doc.length}) — sar.`);
      continue;
    }
    const png = doc.getPage(p);
    const outPath = path.join(testDir, `${pdfName}-page-${p}.png`);
    await fs.writeFile(outPath, png);
    console.log(`  ✓ pagina ${p} → ${path.basename(outPath)}  (${(png.length / 1024).toFixed(0)} KB)`);
  }

  console.warn = origWarn;
  console.error = origErr;

  console.log('\n──────── REZULTAT ────────');
  if (decodeWarnings === 0) {
    console.log('✅ Niciun warning de decodare (JPEG2000/JPX/OpenJPEG). PNG-urile sunt pe disc.');
  } else {
    console.log(`⚠️  ${decodeWarnings} warning-uri de decodare detectate — verifică manual.`);
  }
  console.log('👀 Uită-te la PNG-uri în:', testDir);
  console.log('   (verificare manuală: ilustrațiile trebuie să fie COMPLETE, nu goale.)');
}

main().catch((err) => {
  console.error('\n💥 Eroare fatală la render-test:', err);
  process.exit(1);
});
