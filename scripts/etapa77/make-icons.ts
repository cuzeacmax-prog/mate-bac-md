/** ETAPA 77 E — favicon + apple-touch de brand: ∫ pe nebuloasă. */
import { chromium } from 'playwright';
import { join } from 'node:path';

function html(size: number) {
  return `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background: radial-gradient(70% 70% at 30% 25%, rgba(124,77,255,0.55), transparent 75%), radial-gradient(60% 60% at 75% 80%, rgba(38,198,218,0.3), transparent 75%), #0b0c16;
    border-radius:${Math.round(size * 0.18)}px; overflow:hidden;">
    <div style="font-family:Georgia, serif; font-weight:700; font-size:${Math.round(size * 0.62)}px; color:#cdb9ff;">∫</div>
  </body></html>`;
}

async function shot(size: number, out: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: size, height: size } })).newPage();
  await page.setContent(html(size));
  await page.screenshot({ path: out, omitBackground: false });
  await browser.close();
  console.log('✓', out);
}

async function main() {
  await shot(512, join(process.cwd(), 'src', 'app', 'icon.png'));
  await shot(180, join(process.cwd(), 'src', 'app', 'apple-icon.png'));
}
main();
