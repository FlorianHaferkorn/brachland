/** Gleicher spielbarer Lauf fuer A/B-Proben; neue Ausgabe, keine Bilder waehrend der Zeitmessung.
 * node tools/mess/vergleich.mjs <name> [zusaetzliche-urlparameter] [x,z,grad] */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { playwright } from './pw.mjs';

const [name, extra = '', ort = '0,0,310'] = process.argv.slice(2);
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
try {
  await seite.goto(`http://127.0.0.1:4173/?absetzen=${ort}&zeit=0.26&kontur=0${extra}`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  await seite.waitForTimeout(15000);
  await seite.screenshot({ path: `${ziel}/start.png` });
  const startHud = await seite.textContent('body');
  await seite.evaluate(() => {
    window.__vergleich = { zeiten: [], aktiv: true };
    let vorher = performance.now();
    const tick = jetzt => {
      const v = window.__vergleich;
      if (!v.aktiv) return;
      v.zeiten.push(jetzt - vorher); vorher = jetzt;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await seite.keyboard.down('Shift');
  await seite.keyboard.down('w');
  await seite.waitForTimeout(12000);
  await seite.keyboard.up('w');
  await seite.keyboard.up('Shift');
  const zeiten = await seite.evaluate(() => { window.__vergleich.aktiv = false; return window.__vergleich.zeiten; });
  const endeHud = await seite.textContent('body');
  const reflexion = await seite.evaluate(() => window.__szene?.userData.wasserReflexMessung ?? null);
  await seite.screenshot({ path: `${ziel}/ende.png` });
  const sortiert = [...zeiten].sort((a, b) => a - b);
  const summe = zeiten.reduce((a, b) => a + b, 0);
  const quantil = p => sortiert[Math.min(sortiert.length - 1, Math.floor(sortiert.length * p))] ?? null;
  const bericht = { ort, extra, dauerZielSek: 12, bilder: zeiten.length, dauerMs: summe,
    fps: zeiten.length * 1000 / summe, medianMs: quantil(0.5), p95Ms: quantil(0.95),
    maxMs: quantil(1), ueber50ms: zeiten.filter(z => z > 50).length, startHud, endeHud, reflexion, fehler };
  writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify(bericht, null, 2));
  if (fehler.length || zeiten.length < 10) process.exitCode = 1;
} finally {
  await browser.close();
}
