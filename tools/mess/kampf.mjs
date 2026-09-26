/**
 * Kampfblick (D166, ADR-0007 Stufe 1): lädt `?kampf=1`, schaltet auf, schlägt, rollt
 * und legt eine Bildfolge nach .cache/bilder/<name>_NN.png. Kein Messwert — das Tor
 * für die Regeln ist tests/echtzeit.test.ts. Hier wird nur hingesehen (N3): Liest
 * man Vorlauf, Treffer und Rolle im Bild?
 *   kampf.mjs "x,z,grad" name ["&zeit=0.4"] ["0:l,3:k,9:j"]   (Protokoll je Bild: eigene Phase/Leben | Gegner Phase@Abstand)
 */
import { playwright } from './pw.mjs';
const { chromium } = await playwright();

const [ort = '1045,885,304', name = 'kampf', extra = '&zeit=0.4', folgeText = ''] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
// `&kampf=kapsel` im Extra ersetzt die Vorgabe (D169) — `get` nimmt den ersten Wert.
const kampf = extra.includes('kampf=') ? '' : '&kampf=1';
await p.goto(`http://127.0.0.1:4173/?absetzen=${ort}${kampf}${extra}`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
const t0 = Date.now();
while (Date.now() - t0 < 60000) { if ((await p.textContent('body')).includes('Ladezeit')) break; await p.waitForTimeout(500); }
await p.waitForTimeout(4000);
// Erst anfangen, wenn die Spielerin steht — während des Ladens kann eine Runde schon verloren sein.
for (let i = 0; i < 60; i++) {
  const ich = await p.evaluate(() => document.querySelector('[data-kampf]')?.dataset.ich ?? '');
  if (ich && !ich.startsWith('gefallen')) break;
  await p.waitForTimeout(250);
}

// Folge: aufschalten, zusehen (Gegner läuft an, holt aus), schlagen, rollen.
// Eigene Folge als viertes Argument: "0:l,3:k,9:j" (Bildnummer:Taste).
const folge = folgeText
  ? folgeText.split(',').map(e => { const [i, k] = e.split(':'); return [Number(i), k]; })
  : [[0, 'l'], [10, 'j'], [18, 'k'], [26, 'j'], [30, 'j']];
let n = 0;
for (let i = 0; i <= 40; i++) {
  const taste = folge.find(([t]) => t === i)?.[1];
  if (taste) await p.keyboard.press(taste);
  await p.screenshot({ path: `.cache/bilder/${name}_${String(n).padStart(2, '0')}.png` });
  const d = await p.evaluate(() => { const k = document.querySelector('[data-kampf]'); return k ? `${k.dataset.ich} | ${k.dataset.gegner}` : '-'; });
  console.log(String(n++).padStart(2, '0'), (taste ?? ' ').padEnd(2), d);
  await p.waitForTimeout(120);
}
console.log(`${n} Bilder`, await p.evaluate(() => document.body.innerText.match(/J leicht[^\n]*/)?.[0] ?? 'keine Kampfanzeige'));
await b.close();
