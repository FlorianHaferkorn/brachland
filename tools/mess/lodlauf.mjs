/**
 * LOD waehrend echter Bewegung pruefen: Video, Bilder, Instanzwechsel und Browserfehler.
 * node tools/mess/lodlauf.mjs <neuer-name> [x,z,grad] [sekunden]
 * Preview auf 127.0.0.1:4173; neue Ausgabe unter .cache/mess/<name>, nie eine Baseline ersetzen.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { playwright } from './pw.mjs';

const [name, ort = '0,0,310', dauer = '24'] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw new Error('Neuen einfachen Laufnamen angeben.');
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
const fehler = [];
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
const proben = [], wechsel = {};
let vorher = new Map(), doppelt = 0;
try {
  await seite.goto(`http://127.0.0.1:4173/?absetzen=${ort}&zeit=0.26&kontur=0`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  await seite.waitForTimeout(10000);
  for (let n = 0; n <= Math.ceil(sekunden / 2); n++) {
    const probe = await seite.evaluate(() => {
      const instanzen = [];
      window.__szene.traverse(o => {
        if (!o.isInstancedMesh || !o.name.startsWith('baum:')) return;
        const [, art, variante, stufe] = o.name.split(':');
        const werte = o.instanceMatrix.array;
        for (let i = 0; i < o.count; i++) {
          const k = i * 16;
          instanzen.push([`${art}:${variante}:${werte[k + 12]},${werte[k + 13]},${werte[k + 14]}`, stufe]);
        }
      });
      return { instanzen, hud: document.body.textContent };
    });
    const haeufigkeit = new Map();
    for (const [id] of probe.instanzen) haeufigkeit.set(id, (haeufigkeit.get(id) ?? 0) + 1);
    const doppelte = [...haeufigkeit].filter(([, anzahl]) => anzahl > 1);
    const jetzt = new Map(probe.instanzen);
    doppelt += doppelte.reduce((summe, [, anzahl]) => summe + anzahl - 1, 0);
    const stufen = {};
    for (const [id, stufe] of jetzt) {
      stufen[stufe] = (stufen[stufe] ?? 0) + 1;
      const alte = vorher.get(id);
      if (alte && alte !== stufe) wechsel[`${alte}→${stufe}`] = (wechsel[`${alte}→${stufe}`] ?? 0) + 1;
    }
    vorher = jetzt;
    proben.push({ sekunden: n * 2, stufen, doppelte, hud: probe.hud });
    await seite.screenshot({ path: `${ziel}/bild-${String(n).padStart(2, '0')}.png` });
    if (n === Math.ceil(sekunden / 2)) break;
    await seite.keyboard.down('Shift');
    await seite.keyboard.down('w');
    await seite.waitForTimeout(2000);
  }
} finally {
  await seite.keyboard.up('w').catch(() => {});
  await seite.keyboard.up('Shift').catch(() => {});
  await kontext.close();
  await browser.close();
}
const bericht = { ort, proben, wechsel, doppelt, fehler };
writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
console.log(JSON.stringify({ ziel, proben: proben.length, wechsel, doppelt, fehler }, null, 2));
if (fehler.length || doppelt || Object.keys(wechsel).length === 0) process.exitCode = 1;
