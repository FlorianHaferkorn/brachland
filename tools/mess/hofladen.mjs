/** Kalter HTTP-Lauf ohne Service Worker: Datenbedarf und lokale Ladezeit getrennt vom Precache.
 * node tools/mess/hofladen.mjs <neuer-name> <0|1>
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { playwright } from './pw.mjs';
const [name, probe] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name) || !['0', '1'].includes(probe)) throw Error('Name und 0|1 angeben.');
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw Error(`Ausgabe existiert bereits: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const kontext = await browser.newContext({ viewport: { width: 960, height: 540 }, serviceWorkers: 'block' });
const seite = await kontext.newPage(), fehler = [];
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
seite.on('requestfailed', r => fehler.push(`${r.url()}: ${r.failure()?.errorText}`));
try {
  const start = performance.now();
  await seite.goto(`http://127.0.0.1:4173/?absetzen=1441,418,0&stimmung=zielbild&echt=1&hausfront=1&scanhof=${probe}&kontur=0&zeit=0.26&kamera=1440,36.8,421,1433,37.8,434&fov=60&umgebung=6&sonne=0.8&umlichtstaerke=1.2&schatten=0.4`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 120000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  // Das Lade-HUD meldet Terrain/Bänder; GLB-Props und ihre erst beim Zeichnen
  // angeforderten Texturen kommen danach. Dasselbe Nachladefenster wie im Kostenlauf.
  await seite.waitForTimeout(15000);
  await seite.waitForLoadState('networkidle', { timeout: 120000 });
  const netzRuheMs = performance.now() - start;
  const daten = await seite.evaluate(() => ({
    hud: document.body.textContent,
    hofBereit: window.__szene?.userData.hofProbe?.bereit?.value ?? 0,
    ressourcen: performance.getEntriesByType('resource').map(r => ({
      pfad: new URL(r.name).pathname, transfer: r.transferSize, datei: r.encodedBodySize, ausgepackt: r.decodedBodySize,
    })),
  }));
  const summe = a => a.reduce((s, r) => s + r.datei, 0);
  const hof = daten.ressourcen.filter(r => r.pfad.startsWith('/material/hof-'));
  const bericht = { probe, netzRuheMs, nachladeFensterMs: 15000, dateiBytes: summe(daten.ressourcen), hofBytes: summe(hof),
    serviceWorker: 'blockiert; nur unmittelbarer Spielbedarf, kein Precache', fehler, ...daten };
  writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify({ ...bericht, ressourcen: undefined, hud: undefined }, null, 2));
  if (fehler.length || (probe === '1' && daten.hofBereit !== 1)) process.exitCode = 1;
} finally { await browser.close(); }
