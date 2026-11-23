/**
 * Bildrate an fester Kamera, mehrere Varianten nacheinander (D450): je Variante laden, warten bis die Dreieckszahl
 * steht, dann 10 s lang jede Sekunde die HUD-Werte lesen (B/s, Dreiecke, Aufrufe) und den Median nehmen.
 *   node tools/mess/bildrate.mjs "<basis-zusatz>" "<name>=<zusatz>" ["<name>=<zusatz>" …]
 *   MESS_URL=http://127.0.0.1:5174 MESS_FORMAT=1920x1080 MESS_DPR=1 [MESS_UNGEDECKELT=1]
 * Die Kamera steht fest (`&kamera=…` im Basis-Zusatz), die Figur 3 m dahinter; ein Lauf misst die GPU des Rechners,
 * auf dem er läuft — parallel laufende Blender-Renders verfälschen ihn.
 */
import { playwright } from './pw.mjs';

const [basis, ...varianten] = process.argv.slice(2);
if (!basis || !varianten.length) throw new Error('Aufruf: bildrate.mjs "<basis>" "<name>=<zusatz>" …');
const BASIS = process.env.MESS_URL ?? 'http://127.0.0.1:4173';
const [width, height] = (process.env.MESS_FORMAT ?? '1920x1080').split('x').map(Number);
const dpr = Number(process.env.MESS_DPR ?? '1');
const { chromium } = await playwright();
// MESS_UNGEDECKELT=1: ohne Bildsynchronisation — zeigt, wie viel Luft über 60 B/s bleibt (D457)
const frei = process.env.MESS_UNGEDECKELT === '1' ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [];
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...frei] });
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const zahl = t => Number(String(t).replace(/\./g, '').replace(',', '.'));

const zeilen = [];
for (const v of varianten) {
  const i = v.indexOf('='); const name = v.slice(0, i), zusatz = v.slice(i + 1);
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/?${basis}${zusatz}`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  let letzte = '', seit = Date.now(); const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const m = /([\d.]+)\s*Dreiecke/.exec(await p.textContent('body')); const jetzt = m ? m[1] : '';
    if (jetzt !== letzte) { letzte = jetzt; seit = Date.now(); } else if (Date.now() - seit > 5000) break;
    await p.waitForTimeout(500);
  }
  const bps = [], dr = [], auf = [];
  for (let k = 0; k < 10; k++) {
    await p.waitForTimeout(1000);
    const t = await p.textContent('body');
    const a = /(\d+)\s*B\/s/.exec(t), d = /([\d.]+)\s*Dreiecke/.exec(t), c = /(\d+)\s*Aufrufe/.exec(t);
    if (a) bps.push(Number(a[1])); if (d) dr.push(zahl(d[1])); if (c) auf.push(Number(c[1]));
  }
  zeilen.push({ name, bps: median(bps), dreiecke: median(dr), aufrufe: median(auf) });
  console.log(`${name.padEnd(24)} ${String(median(bps)).padStart(3)} B/s  ${(median(dr) / 1e6).toFixed(2).padStart(6)} Mio. Dreiecke  ${String(median(auf)).padStart(5)} Aufrufe`);
  await ctx.close();
}
await b.close();
