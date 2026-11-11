/**
 * Lichtsichtbarkeit beim Nachladen beobachten (D252).
 * node tools/mess/lichterlauf.mjs <neuer-name> [url-zusatz] [sekunden]
 * Voraussetzung: Produktions-Preview auf 127.0.0.1:4173.
 * Lauf ab 0,0,310, Shift+W; Video, GLB-Anfragen und Szenenproben unter .cache/mess/<name>.
 * Die Sonde und Videoaufzeichnung belasten das Spiel; keine Performance-Messung.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { playwright } from './pw.mjs';

const [name, extra = '', dauer = '24'] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw new Error('Neuen einfachen Namen angeben.');
const sekunden = Number(dauer);
if (!Number.isFinite(sekunden) || sekunden < 4 || sekunden > 120) throw new Error('Dauer: 4 bis 120 Sekunden.');
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw new Error(`Ausgabe existiert bereits: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const kontext = await browser.newContext({ viewport: { width: 960, height: 540 },
  recordVideo: { dir: ziel, size: { width: 960, height: 540 } } });
const seite = await kontext.newPage();
const anfragen = [], fehler = [];
let beginn = null;
for (const typ of ['request', 'requestfinished', 'requestfailed']) {
  seite.on(typ, anfrage => {
    if (beginn === null) return;
    const url = new URL(anfrage.url());
    if (url.origin !== 'http://127.0.0.1:4173' || !url.pathname.endsWith('.glb')) return;
    anfragen.push({ ms: Date.now() - beginn, typ, pfad: url.pathname });
  });
}
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
try {
  await seite.goto(`http://127.0.0.1:4173/?absetzen=0,0,310&zeit=0.26&kontur=0${extra}`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  await seite.waitForTimeout(10000);
  await seite.evaluate(() => {
    window.__lichtlauf = { aktiv: true, beginn: performance.now(), proben: [] };
    function schritt() {
      const lauf = window.__lichtlauf;
      if (!lauf.aktiv) return;
      const lichter = [];
      window.__szene?.traverse(o => {
        if (!o.isHemisphereLight && !o.isDirectionalLight) return;
        let sichtbar = true;
        for (let p = o; p; p = p.parent) if (!p.visible) sichtbar = false;
        lichter.push({ art: o.type, sichtbar, staerke: o.intensity });
      });
      lauf.proben.push({ ms: performance.now() - lauf.beginn, lichter });
      requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
  });
  beginn = Date.now();
  await seite.keyboard.down('Shift');
  await seite.keyboard.down('w');
  await seite.waitForTimeout(sekunden * 1000);
  await seite.keyboard.up('w');
  await seite.keyboard.up('Shift');
  const proben = await seite.evaluate(() => { window.__lichtlauf.aktiv = false; return window.__lichtlauf.proben; });
  const dunkel = proben.filter(p => p.lichter.some(l => !l.sichtbar));
  const ohneLicht = proben.filter(p => !['HemisphereLight', 'DirectionalLight']
    .every(art => p.lichter.some(l => l.art === art)));
  const bericht = { extra, sekunden, anfragen, proben, fehler,
    zusammenfassung: { proben: proben.length, lichtUnsichtbar: dunkel.length, ohneLicht: ohneLicht.length } };
  writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify({ ziel, ...bericht.zusammenfassung, fehler }, null, 2));
  if (fehler.length || dunkel.length || ohneLicht.length || proben.length < 10) process.exitCode = 1;
} finally {
  await seite.keyboard.up('w').catch(() => {});
  await seite.keyboard.up('Shift').catch(() => {});
  await kontext.close();
  await browser.close();
}
