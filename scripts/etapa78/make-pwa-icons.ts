/**
 * ETAPA 78 FAZA A — iconurile PWA de brand (∫ pe nebuloasă, ca favicon-ul din 77)
 * în toate mărimile manifestului + variantele maskable (fundal plin, safe-zone 80%).
 * Tipărește și hex-urile tokens (oklch → srgb prin canvas) pentru manifest.
 *
 *   npx tsx scripts/etapa78/make-pwa-icons.ts
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const OUT = join(process.cwd(), 'public', 'icons');

function html(size: number, maskable: boolean) {
  // maskable: fundal plin până la margini, glifa în safe-zone (~62% din latură)
  const radius = maskable ? 0 : Math.round(size * 0.18);
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));
  return `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background: radial-gradient(circle at 30% 25%, oklch(0.30 0.09 295), oklch(0.16 0.025 260) 70%);
    border-radius:${radius}px; overflow:hidden;">
    <div style="font-family:Georgia, serif; font-weight:700; font-size:${glyph}px; color:#cdb9ff;">∫</div>
  </body></html>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  for (const { size, maskable, name } of [
    { size: 192, maskable: false, name: 'icon-192.png' },
    { size: 512, maskable: false, name: 'icon-512.png' },
    { size: 192, maskable: true, name: 'maskable-192.png' },
    { size: 512, maskable: true, name: 'maskable-512.png' },
  ]) {
    const page = await (await browser.newContext({ viewport: { width: size, height: size } })).newPage();
    await page.setContent(html(size, maskable));
    await page.screenshot({ path: join(OUT, name), omitBackground: !maskable });
    console.log(`  ✓ ${name}`);
  }
  // oklch → hex pentru manifest (canvas normalizează la srgb)
  const page = await (await browser.newContext()).newPage();
  // string-evaluate: tsx/esbuild injectează helperul __name în funcțiile nested
  // și Playwright nu-l are în contextul paginii
  const hexes = await page.evaluate(`(() => {
    const toHex = (css) => {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      const ctx = c.getContext('2d');
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    };
    return {
      background: toHex('oklch(0.16 0.025 260)'),
      primary: toHex('oklch(0.66 0.20 295)'),
    };
  })()`);
  console.log('hex pentru manifest:', hexes);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
