/**
 * Blick auf den Charakter-Editor (D175): lädt `?held=editor`, klickt eine Folge von Knöpfen und legt je
 * Schritt ein Bild nach .cache/bilder/held_NN.png.
 *   node tools/mess/held.mjs ["weiblich,lang"] [breite] [hoehe]
 */
import { playwright } from './pw.mjs';
const { chromium } = await playwright();
const [folgeText = '', breite = '1100', hoehe = '700'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: Number(breite), height: Number(hoehe) } });
p.on('console', m => { if (m.type() === 'error') console.log('KONSOLE', m.text().slice(0, 200)); });
await p.goto('http://127.0.0.1:4173/?held=editor', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('text=Aufbrechen', { timeout: 240000 });
await p.waitForTimeout(6000);
let n = 0;
await p.screenshot({ path: `.cache/bilder/held_${String(n++).padStart(2, '0')}.png` });
for (const t of folgeText.split(',').filter(Boolean)) {
  await p.getByRole('button', { name: t, exact: true }).first().click();
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `.cache/bilder/held_${String(n++).padStart(2, '0')}.png` });
  console.log(n - 1, t);
}
await b.close();
