/**
 * ETAPA 77 C3 — OG image: titlu pe nebuloasă cu sigiliul ∫ → public/og.png.
 *   npx tsx scripts/etapa77/make-og.ts
 */
import { chromium } from 'playwright';
import { join } from 'node:path';

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; width:1200px; height:630px; font-family: 'Segoe UI', system-ui, sans-serif;
    background:
      radial-gradient(60% 70% at 25% 20%, rgba(124,77,255,0.4), transparent 70%),
      radial-gradient(55% 65% at 80% 75%, rgba(38,198,218,0.25), transparent 70%),
      #0b0c16;
    color: #f2f1f7; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
  .seal { position:absolute; right:60px; top:50%; transform:translateY(-50%); font-size:430px; font-weight:700; color:#9b7bff; opacity:0.14; }
  .star { position:absolute; background:white; border-radius:50%; }
  .wrap { position:relative; max-width:760px; padding-left:80px; }
  .kicker { font-size:22px; letter-spacing:4px; text-transform:uppercase; color:#b39dff; font-weight:600; }
  h1 { font-size:58px; line-height:1.15; margin:18px 0 14px; font-weight:700; }
  p { font-size:26px; color:#b9b7c9; margin:0; }
</style></head><body>
  <div class="seal">∫</div>
  ${Array.from({ length: 60 }, (_, i) => {
    const x = (i * 73) % 1200, y = (i * 137) % 630, r = i % 4 === 0 ? 2.4 : 1.4, o = 0.2 + ((i * 29) % 60) / 100;
    return `<div class="star" style="left:${x}px;top:${y}px;width:${r}px;height:${r}px;opacity:${o}"></div>`;
  }).join('')}
  <div class="wrap">
    <div class="kicker">BAC matematică · Republica Moldova</div>
    <h1>Profesorul care știe exact unde ești</h1>
    <p>Harta cunoașterii · lecții pe culegerea oficială · simulare cu notă estimată</p>
  </div>
</body></html>`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
  await page.setContent(HTML, { waitUntil: 'load' });
  await page.screenshot({ path: join(process.cwd(), 'public', 'og.png') });
  await browser.close();
  console.log('✓ public/og.png (1200×630)');
}
main();
