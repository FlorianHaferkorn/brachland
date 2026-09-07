/**
 * BRACHLAND — Bildtor: ist das Dunkle dunkel, oder ist es leer?
 *
 * ## Wofuer es das gibt
 *
 * Am 27.08.2026 stand in der Nacht an einem Hang **42,7 % des Bildes auf exakt
 * 0** — nicht dunkel, sondern aus. Das lag seit dem 16.08. so da (G-7 hat die
 * Belichtung gegen eine **ebene** Testflaeche gesetzt und den Fall nie gesehen),
 * und kein Tor konnte es finden: `make check` prueft Typen, Tests, Daten und
 * Inhalte — Dinge, die im Speicher stehen. Ein schwarzes Bild steht nirgends im
 * Speicher.
 *
 * Das Mass ist bewusst **nicht** „wie dunkel ist es". Nacht soll dunkel sein.
 * Gemessen wird der Anteil der Pixel, deren hoechster Kanal **exakt 0** ist:
 * Ein Spitzenwert bei genau 0 statt bei 1 oder 2 heisst, dass das Ergebnis unter
 * die 8-Bit-Schwelle faellt — dort ist keine Zeichnung mehr, auch keine dunkle.
 *
 * ## Warum getrennt von `make check`
 *
 * Es braucht einen Bau, einen Browser und rund zwei Minuten. Playwright haengt
 * bewusst nicht im Manifest (siehe `tools/zaehlen.mjs`). Ein Pre-Commit-Hook,
 * der zwei Minuten kostet, wird umgangen — dieses Tor laeuft von Hand, und die
 * Regel steht in `docs/_INDEX.md`: **nach jeder Aenderung an Licht, Nebel,
 * Belichtung oder Materialien.**
 *
 * ## Gebrauch
 *
 * ```
 * npm run build
 * npx vite preview --host 127.0.0.1 --port 4173     # zweites Fenster
 * npm run bildtor
 * npm run bildtor -- --neu                           # Grundwerte neu schreiben
 * ```
 *
 * Grundwerte stehen in `tools/bildtor.json`. Ein bekannter, offener Befund
 * bekommt dort `offen: true` samt Ledger-Nummer — dann meldet das Tor ihn als
 * Warnung statt als Blocker, und ein **neuer** Ausfall faellt trotzdem auf.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const GRUND = 'tools/bildtor.json';
const NEU = process.argv.includes('--neu');
const BASIS = 'http://127.0.0.1:4173/';
/** So lange stehenbleiben, bis Kacheln, Props und Kulisse gebaut sind. */
const WARTEN = 15_000;
/** Zuschlag auf den Grundwert, ab dem es ein Ausfall ist. */
const SPIELRAUM = 4.0;

const grund = JSON.parse(readFileSync(GRUND, 'utf8'));

/**
 * Anteil der Pixel mit hoechstem Kanal exakt 0, und der Anteil unter
 * Leuchtdichte 0,02.
 *
 * ## Gemessen wird ein **Bildschirmfoto**, nicht die Zeichenflaeche
 *
 * Der erste Anlauf holte sich das WebGL-Canvas mit `drawImage` in ein
 * 2D-Canvas. Ergebnis: **100,0 % leer an allen zehn Faellen** — und das sah aus
 * wie ein katastrophaler Befund, war aber der Messfehler. Ein WebGL-Kontext
 * laeuft ohne `preserveDrawingBuffer`; nach dem Zusammensetzen des Bildes ist
 * der Puffer leer, und wer ihn danach liest, liest Schwarz. Aufgefallen ist es
 * nur, weil Grundwerte dagegenstanden: Ohne sie waere „alles schwarz" eine
 * plausible Meldung gewesen.
 *
 * `page.screenshot()` geht den Weg des Browsers und bekommt das fertige Bild.
 *
 * Als **Funktion**, nicht als Zeichenkette: Playwright wertet in Node eine
 * Zeichenkette als Ausdruck aus und liefert die Funktion statt ihres
 * Ergebnisses — daran hat `zaehlen.mjs` beim ersten Lauf lauter Nullen
 * gemeldet, und die sahen aus wie ein Messergebnis.
 */
const messen = async (d) => {
  const bild = new Image();
  bild.src = 'data:image/png;base64,' + d;
  await bild.decode();
  const c = document.createElement('canvas');
  c.width = bild.width; c.height = bild.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(bild, 0, 0);
  // Der obere und untere Rand tragen HUD und Bedienzeilen — Text in
  // Signalfarben wuerde jede Messung verfaelschen.
  const y0 = Math.round(c.height * 0.14), y1 = Math.round(c.height * 0.78);
  const p = ctx.getImageData(0, y0, c.width, y1 - y0).data;
  // **Linear, nicht sRGB.** Bis G-126 stand hier `(…)/255 < 0.02` auf den
  // kodierten Werten — das ist unter 5 von 255, linear 0,0015, und meldete an
  // der Felsflanke 17,9 %, wo linear 58,6 % sind. Die Stilreferenz ist linear
  // gemessen; nur so ist die Zahl vergleichbar, und nur so taugt sie als
  // Zielwert (D110: Median >= 0,15, unter 0,02 <= 10 %).
  const lin = new Float32Array(256);
  for (let v = 0; v < 256; v++) {
    const c = v / 255;
    lin[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  let leer = 0, dunkel = 0, n = 0;
  const ys = new Float32Array(p.length / 4);
  for (let i = 0; i < p.length; i += 4) {
    const m = Math.max(p[i], p[i + 1], p[i + 2]);
    if (m === 0) leer++;
    const y = 0.2126 * lin[p[i]] + 0.7152 * lin[p[i + 1]] + 0.0722 * lin[p[i + 2]];
    if (y < 0.02) dunkel++;
    ys[n++] = y;
  }
  ys.sort();
  return { leer: leer / n * 100, dunkel: dunkel / n * 100, median: ys[Math.floor(n / 2)] };
};

const browser = await chromium.launch();
const zeilen = [];
let blocker = 0, warnungen = 0;

for (const f of grund.faelle) {
  const seite = await browser.newContext({ viewport: { width: 900, height: 560 } })
    .then(c => c.newPage());
  await seite.goto(`${BASIS}?absetzen=${f.ort}&zeit=${f.zeit}`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240_000 });
  await seite.waitForTimeout(WARTEN);
  const foto = await seite.screenshot();
  const w = await seite.evaluate(messen, foto.toString('base64'));
  await seite.context().close();

  const grenze = f.leer + SPIELRAUM;
  const aus = w.leer > grenze;
  if (aus) { if (f.offen) warnungen++; else blocker++; }
  zeilen.push({ f, w, aus });
  if (NEU) {
    f.leer = Number(w.leer.toFixed(1)); f.dunkel = Number(w.dunkel.toFixed(1));
    f.median = Number(w.median.toFixed(3));
  }
}
await browser.close();

console.log('\nBildtor — Anteil Pixel mit hoechstem Kanal exakt 0\n');
console.log('  Ort                Stimmung      leer      Grundwert   dunkel   Median');
for (const { f, w, aus } of zeilen) {
  const zeichen = aus ? (f.offen ? '!' : '✗') : '✓';
  console.log(`  ${zeichen} ${f.name.padEnd(16)} ${f.stimmung.padEnd(12)}`
    + `${w.leer.toFixed(1).padStart(6)} %  ${f.leer.toFixed(1).padStart(6)} %`
    + `${w.dunkel.toFixed(1).padStart(9)} %  ${w.median.toFixed(3).padStart(6)}`
    + (f.offen ? `   offen: ${f.offen}` : ''));
}

if (NEU) {
  writeFileSync(GRUND, JSON.stringify(grund, null, 2) + '\n');
  console.log(`\nGrundwerte neu geschrieben nach ${GRUND}`);
  process.exit(0);
}

console.log(`\n${blocker} Blocker, ${warnungen} Warnungen (Spielraum ${SPIELRAUM} Punkte)`);
if (blocker) {
  console.log('\nEin Bereich, der vorher Zeichnung hatte, ist jetzt leer. Das ist kein');
  console.log('Geschmacksurteil: Bei hoechstem Kanal 0 steht dort nichts mehr, auch');
  console.log('nichts Dunkles. Siehe G-116 und G-117.');
  process.exit(1);
}
