/**
 * Bildrate an fester Kamera, mehrere Varianten nacheinander (D450): je Variante laden, warten bis die Dreieckszahl
 * steht, dann 10 s lang jede Sekunde die HUD-Werte lesen (B/s, Dreiecke, Aufrufe) und den Median nehmen.
 *   node tools/mess/bildrate.mjs "<basis-zusatz>" "<name>=<zusatz>" ["<name>=<zusatz>" …]
 *   MESS_URL=http://127.0.0.1:5174 MESS_FORMAT=1920x1080 MESS_DPR=1 [MESS_UNGEDECKELT=1]
 * MESS_GANG=1 misst den 10-s-Gang ab absetzen mit W (ohne feste Kamera oder Videoaufnahme).
 * Im Standmodus bleibt die Kamera fest (`&kamera=…` im Basis-Zusatz), die Figur 3 m dahinter; ein Lauf misst die GPU des Rechners,
 * auf dem er läuft — parallel laufende Blender-Renders verfälschen ihn.
 */
import { playwright } from './pw.mjs';

const [basis, ...varianten] = process.argv.slice(2);
if (!basis || !varianten.length) throw new Error('Aufruf: bildrate.mjs "<basis>" "<name>=<zusatz>" …');
const BASIS = process.env.MESS_URL ?? 'http://127.0.0.1:4173';
const [width, height] = (process.env.MESS_FORMAT ?? '1920x1080').split('x').map(Number);
const dpr = Number(process.env.MESS_DPR ?? '1');
const { chromium } = await playwright();
// MESS_UNGEDECKELT=1: ohne Bildsynchronisation — zeigt, wie viel Luft über 60 B/s bleibt (D464)
const frei = process.env.MESS_UNGEDECKELT === '1' ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [];
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...frei] });
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const zahl = t => Number(String(t).replace(/\./g, '').replace(',', '.'));

// Ab Tastendruck an der Spielposition messen. Ein Film belastet die GPU und läuft deshalb getrennt.
async function gehprobe(seite, adresse) {
  const start = adresse.searchParams.get('absetzen')?.split(',').map(Number);
  if (!start || start.length < 2 || adresse.searchParams.has('kamera')) throw new Error('Gang braucht absetzen=x,z,grad und freie Spielkamera.');
  await seite.evaluate(([x, z]) => {
    const figuren = window.__szene.children.filter(o => o.type === 'Object3D' && Math.hypot(o.position.x - x, o.position.z - z) < 0.8);
    if (figuren.length !== 1) throw new Error('Spielfigur am Routenstart nicht eindeutig.');
    const position = figuren[0].position;
    window.addEventListener('keydown', function start(e) {
      if (e.code !== 'KeyW') return;
      window.removeEventListener('keydown', start);
      const messung = window.__ortgang = { aktiv: true, zeitpunkte: [], meter: 0 };
      let altX = position.x, altZ = position.z;
      const schritt = t => {
        if (!messung.aktiv) return;
        messung.zeitpunkte.push(t);
        messung.meter += Math.hypot(position.x - altX, position.z - altZ);
        altX = position.x; altZ = position.z;
        requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    });
  }, start);
  await seite.keyboard.down('w');
  try { await seite.waitForTimeout(10000); } finally { await seite.keyboard.up('w'); }
  const { zeitpunkte, meter } = await seite.evaluate(() => {
    window.__ortgang.aktiv = false;
    return window.__ortgang;
  });
  if (zeitpunkte.length < 2 || meter < 1) throw new Error('Gang ohne messbaren Fortschritt.');
  const delta = zeitpunkte.slice(1).map((t, i) => t - zeitpunkte[i]).sort((a, b) => a - b);
  const fps = 1000 * delta.length / (zeitpunkte.at(-1) - zeitpunkte[0]);
  return { meter, fps, p95: delta[Math.floor(delta.length * 0.95)], spitze: delta.at(-1), ueber50: delta.filter(t => t > 50).length };
}
for (const v of varianten) {
  const i = v.indexOf('='); const name = v.slice(0, i), zusatz = v.slice(i + 1);
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const p = await ctx.newPage();
  const fehler = [];
  p.on('pageerror', e => fehler.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  const adresse = new URL(`/?${basis}${zusatz}`, BASIS);
  await p.goto(adresse.href, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await p.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  let letzte = '', seit = Date.now(); const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const m = /([\d.]+)\s*Dreiecke/.exec(await p.textContent('body')); const jetzt = m ? m[1] : '';
    if (jetzt !== letzte) { letzte = jetzt; seit = Date.now(); } else if (jetzt && Date.now() - seit > 5000) break;
    await p.waitForTimeout(500);
  }
  if (process.env.MESS_GANG === '1') {
    const m = await gehprobe(p, adresse);
    if (fehler.length) throw new Error(fehler.join('\n'));
    console.log(`${name}   ${m.meter.toFixed(1)} m   ${m.fps.toFixed(2)} B/s   p95 ${m.p95.toFixed(2)} ms   max ${m.spitze.toFixed(2)} ms   >50 ms: ${m.ueber50}`);
    await ctx.close();
    continue;
  }
  const bps = [], dr = [], auf = [];
  for (let k = 0; k < 10; k++) {
    await p.waitForTimeout(1000);
    const t = await p.textContent('body');
    const a = /(\d+)\s*B\/s/.exec(t), d = /([\d.]+)\s*Dreiecke/.exec(t), c = /(\d+)\s*Aufrufe/.exec(t);
    if (a) bps.push(Number(a[1])); if (d) dr.push(zahl(d[1])); if (c) auf.push(Number(c[1]));
  }
  if (fehler.length) throw new Error(fehler.join('\n'));
  if (!bps.length || !dr.length || !auf.length) throw new Error('HUD-Messwerte fehlen.');
  console.log(`${name.padEnd(24)} ${String(median(bps)).padStart(3)} B/s  ${(median(dr) / 1e6).toFixed(2).padStart(6)} Mio. Dreiecke  ${String(median(auf)).padStart(5)} Aufrufe`);
  await ctx.close();
}
await b.close();
