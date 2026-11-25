/**
 * Messbild Spiel │ Zielbild (D445, UEBERGABE 2d / D425): Standbild an fester Kamera und 10 s Bewegung, mit echter GPU.
 *   node tools/mess/messbild.mjs <ausordner> "<x,z,grad>" "<url-zusatz mit &kamera=…&fov=…>" [1920x1080]
 * Ausgabe: <ausordner>/spiel-standbild.png (feste Kamera aus dem Zusatz), <ausordner>/spiel-bewegung.webm
 * (Spielkamera ab <x,z,grad>, 10 s Taste W) und bericht.json (Ladezeit, Dreiecke, Bildrate aus dem HUD).
 * Für die Aufnahme wird alles ausser der 3D-Leinwand ausgeblendet (Menü, Messwerte, Questtext) — das Spiel hat dafür
 * keinen Schalter, und die Überlagerungen verfälschen die Messwerte. Braucht `npm run preview` auf 127.0.0.1:4173.
 */
import { mkdirSync, writeFileSync, renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { playwright } from './pw.mjs';

const [aus, ort, zusatz = '', format = '1920x1080'] = process.argv.slice(2);
if (!aus || !ort) throw new Error('Aufruf: messbild.mjs <ausordner> "<x,z,grad>" "<&kamera=…>" [BxH]');
const [width, height] = format.split('x').map(Number);
mkdirSync(aus, { recursive: true });
const { chromium } = await playwright();
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const BASIS = process.env.MESS_URL ?? 'http://127.0.0.1:4173';   // Entwicklungsserver: MESS_URL=http://127.0.0.1:5174
const NUR_LEINWAND = '* { visibility: hidden !important; } canvas { visibility: visible !important; }';

async function bereit(p) {
  await p.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) { if ((await p.textContent('body')).includes('Ladezeit')) break; await p.waitForTimeout(500); }
  let letzte = '', seit = Date.now(); const t1 = Date.now();          // Bauwerke laden nach: warten, bis die Dreieckszahl 4 s steht
  while (Date.now() - t1 < 60000) {
    const m = /([\d.]+)\s*Dreiecke/.exec(await p.textContent('body')); const jetzt = m ? m[1] : '';
    if (jetzt !== letzte) { letzte = jetzt; seit = Date.now(); } else if (Date.now() - seit > 4000) break;
    await p.waitForTimeout(500);
  }
  const text = await p.textContent('body');
  return { ladezeit: (/Ladezeit\s*([\d.,]+\s*s)/.exec(text) || [])[1] ?? null, dreiecke: (/([\d.]+)\s*Dreiecke/.exec(text) || [])[1] ?? null,
           bildrate: (/(\d+)\s*B\/s/.exec(text) || [])[1] ?? null };
}

const bericht = {};
{ // Standbild an der Zielbild-Kamera
  const p = await b.newPage({ viewport: { width, height } });
  await p.goto(`${BASIS}/?absetzen=${ort}${zusatz}`, { waitUntil: 'domcontentloaded' });
  bericht.standbild = await bereit(p);
  await p.waitForTimeout(3000);
  await p.addStyleTag({ content: NUR_LEINWAND }); await p.waitForTimeout(500);
  await p.screenshot({ path: join(aus, 'spiel-standbild.png') });
  await p.close();
}
if (process.env.MESS_NUR_STAND !== '1') { // 10 s Bewegung mit der Spielkamera (ohne feste Kamera), auf den Bogen zu
  const ohneKamera = zusatz.replace(/&kamera=[^&]*/, '').replace(/&fov=[^&]*/, '');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: aus, size: { width: 1280, height: 720 } } });
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/?absetzen=${ort}${ohneKamera}`, { waitUntil: 'domcontentloaded' });
  bericht.bewegung = await bereit(p);
  // Kein Mausklick: der setzt die Zeigersperre und kippt die Kamera (erster Lauf D445). Ausblenden als fester Knoten am
  // Ende von <body> und je Sekunde erneut, weil die Oberfläche Knoten neu einhängt.
  const blende = () => p.evaluate(css => { let s = document.getElementById('messbild'); if (!s) { s = document.createElement('style'); s.id = 'messbild'; s.textContent = css; } document.body.appendChild(s); }, NUR_LEINWAND);
  await blende(); await p.focus('canvas').catch(() => {}); await p.waitForTimeout(1500);
  await p.keyboard.down('w');
  for (let i = 0; i < 10; i++) { await blende(); await p.waitForTimeout(1000); }
  await p.keyboard.up('w');
  await p.waitForTimeout(800);
  await ctx.close();
  const webm = readdirSync(aus).filter(f => f.endsWith('.webm') && f !== 'spiel-bewegung.webm');
  if (webm.length) renameSync(join(aus, webm[webm.length - 1]), join(aus, 'spiel-bewegung.webm'));
}
writeFileSync(join(aus, 'bericht.json'), JSON.stringify(bericht, null, 1));
console.log('MESSBILD', JSON.stringify(bericht));
await b.close();
