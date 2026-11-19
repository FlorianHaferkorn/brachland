/** Gleicher spielbarer Lauf fuer A/B-Proben; neue Ausgabe, keine Bilder waehrend der Zeitmessung.
 * node tools/mess/vergleich.mjs <name> [zusaetzliche-urlparameter] [x,z,grad|hofwest] */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { playwright } from './pw.mjs';
import { HOFWEST_START, bereiteHofwestroute, hofwestZeiten, laufeHofwestroute } from './hofwestroute.mjs';

const [name, extra = '', strecke = '0,0,310'] = process.argv.slice(2);
const hofwest = strecke === 'hofwest';
const ort = hofwest ? HOFWEST_START : strecke;
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw new Error('Neuen einfachen Namen angeben.');
if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(ort)) throw new Error('Ort als x,z,grad angeben.');
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw new Error(`Ausgabe existiert bereits: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const seite = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const fehler = [];
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
function kennzahlen(zeiten) {
  const sortiert = [...zeiten].sort((a, b) => a - b);
  const dauerMs = zeiten.reduce((a, b) => a + b, 0);
  const quantil = p => sortiert[Math.min(sortiert.length - 1, Math.floor(sortiert.length * p))] ?? null;
  return { bilder: zeiten.length, dauerMs, fps: dauerMs > 0 ? zeiten.length * 1000 / dauerMs : null,
    medianMs: quantil(0.5), p95Ms: quantil(0.95), maxMs: quantil(1), ueber50ms: zeiten.filter(z => z > 50).length };
}
try {
  await seite.goto(`http://127.0.0.1:4173/?absetzen=${ort}&zeit=0.26&kontur=0${extra}`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  await seite.waitForTimeout(15000);
  await seite.screenshot({ path: `${ziel}/start.png` });
  const startHud = await seite.textContent('body');
  if (hofwest) {
    await bereiteHofwestroute(seite);
    const route = await laufeHofwestroute(seite);
    const abschnitte = Object.fromEntries(Object.entries(hofwestZeiten(route))
      .map(([abschnitt, zeiten]) => [abschnitt, kennzahlen(zeiten)]));
    if (route.fehler) fehler.push(route.fehler);
    const bericht = { ort, extra, ...abschnitte.gesamt, abschnitte, route, fehler };
    writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
    console.log(JSON.stringify({ ort, extra, abschnitte, wegpunkte: route.wegpunkte, fehler }, null, 2));
    await seite.screenshot({ path: `${ziel}/ende.png` });
    if (fehler.length || abschnitte.gesamt.bilder < 10) process.exitCode = 1;
  } else {
    await seite.evaluate(() => {
      const start = performance.now();
      const lauf = { start, zeitpunkte: [], tastendruck: null, loslassen: null, aktiv: true };
      window.__vergleich = lauf;
      window.addEventListener('keydown', e => {
        if (e.code === 'KeyW' && lauf.tastendruck === null) lauf.tastendruck = performance.now() - start;
      });
      window.addEventListener('keyup', e => {
        if (e.code === 'KeyW') lauf.loslassen = performance.now() - start;
      });
      const tick = jetzt => {
        if (!lauf.aktiv) return;
        lauf.zeitpunkte.push(jetzt - start);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await seite.keyboard.down('Shift');
    await seite.keyboard.down('w');
    await seite.waitForTimeout(12000);
    await seite.keyboard.up('w');
    await seite.keyboard.up('Shift');
    const lauf = await seite.evaluate(() => {
      const l = window.__vergleich; l.aktiv = false;
      return { zeitpunkte: l.zeitpunkte, tastendruck: l.tastendruck, loslassen: l.loslassen };
    });
    const zeiten = lauf.zeitpunkte.map((zeit, i) => zeit - (lauf.zeitpunkte[i - 1] ?? 0));
    const endeHud = await seite.textContent('body');
    const reflexion = await seite.evaluate(() => window.__szene?.userData.wasserReflexMessung ?? null);
    await seite.screenshot({ path: `${ziel}/ende.png` });
    const bericht = { ort, extra, dauerZielSek: 12, ...kennzahlen(zeiten), lauf, startHud, endeHud, reflexion, fehler };
    writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
    console.log(JSON.stringify(bericht, null, 2));
    if (fehler.length || zeiten.length < 10) process.exitCode = 1;
  }
} finally {
  await browser.close();
}
