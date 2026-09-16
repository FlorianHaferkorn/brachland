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
// Playwright ueber `mess/pw.mjs` (D160): bewusst keine Abhaengigkeit im Manifest, und der frueher
// noetige Symlink nach `.cache/mess/node_modules` war irgendwann weg — das Tor lief dann gar nicht.
import { playwright } from './mess/pw.mjs';
const { chromium } = await playwright();
import { readFileSync, writeFileSync } from 'node:fs';

const GRUND = 'tools/bildtor.json';
const NEU = process.argv.includes('--neu');
/**
 * `--stimmung daemmerung` faehrt nur die Faelle einer Stimmung — die Messschleife
 * fuer das Licht (D110) braucht fuenf Bilder, nicht zwoelf. Grundwerte werden
 * dabei nie geschrieben; `--neu` gilt nur fuer den vollen Lauf.
 */
const NUR = process.argv.includes('--stimmung')
  ? process.argv[process.argv.indexOf('--stimmung') + 1] : null;
const BASIS = 'http://127.0.0.1:4173/';
/**
 * Mindestens so lange stehenbleiben, bis Kacheln, Props und Kulisse gebaut sind —
 * und seit D146 **bis das HUD die Ladezeit zeigt** (Gelaende und Baender
 * vollstaendig), hoechstens `WARTEN_MAX`. Unter SwiftShader steht der Dorf-Fall
 * erst nach 23 s; bei festen 15 s massen alle Grundwerte einen 90-%-Bau.
 */
const WARTEN = 15_000;
const WARTEN_MAX = 60_000;
/** Zuschlag auf den Grundwert, ab dem es ein Ausfall ist. */
const SPIELRAUM = 4.0;
/**
 * Abweichung der Dreiecke vom Grundwert, ab der es ein Ausfall ist (G-134): Ein
 * halb geladener Bau hat weniger Dreiecke, ein Bau ohne Haeuser auch — und beides
 * kam bis D145 als „gruen“ durch, weil `leer` nur Schwarz misst. 30 % lassen
 * Bewuchs-Streuung und LOD-Wahl durch, nicht aber 128 fehlende Haeuser (−47 %).
 */
const DREIECKE_SPIELRAUM = 0.30;

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
  let leer = 0, dunkel = 0, hell = 0, n = 0;
  const ys = new Float32Array(p.length / 4);
  for (let i = 0; i < p.length; i += 4) {
    const m = Math.max(p[i], p[i + 1], p[i + 2]);
    if (m === 0) leer++;
    const y = 0.2126 * lin[p[i]] + 0.7152 * lin[p[i + 1]] + 0.0722 * lin[p[i + 2]];
    if (y < 0.02) dunkel++;
    if (y > 0.30) hell++;
    ys[n++] = y;
  }
  ys.sort();
  return { leer: leer / n * 100, dunkel: dunkel / n * 100, hell: hell / n * 100,
           median: ys[Math.floor(n / 2)] };
};

/**
 * **Echte GPU statt SwiftShader** (D160). Der Software-Rasterizer war die deterministischere Wahl, aber
 * seit die Blender-Bauwerke in der Szene stehen, sind es an der Felsmulde 6 M Dreiecke — dort stirbt der
 * Kontext mitten im Lauf („Target page, context or browser has been closed"), und das Tor lief seit D155
 * überhaupt nicht mehr. Ein Tor, das nicht läuft, prüft nichts. Die Grundwerte sind damit an dieses Gerät
 * gebunden (M1, Metal) — `dreiecke` und `ladezeit` waren es ohnehin schon (G-134).
 */
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
const zeilen = [];
let blocker = 0, warnungen = 0;

for (const f of grund.faelle) {
  if (NUR && f.stimmung !== NUR) continue;
  const seite = await browser.newContext({ viewport: { width: 900, height: 560 } })
    .then(c => c.newPage());
  await seite.goto(`${BASIS}?absetzen=${f.ort}&zeit=${f.zeit}`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240_000 });
  await seite.waitForTimeout(WARTEN);
  try {
    await seite.waitForFunction(() => /Ladezeit [\d.]+ s/.test(document.body.innerText), null, { timeout: WARTEN_MAX - WARTEN });
    // Noch ein Moment, damit die letzten Kacheln auch gezeichnet sind.
    await seite.waitForTimeout(1500);
  } catch { /* laedt nach WARTEN_MAX noch — die Spalte zeigt es */ }
  const foto = await seite.screenshot();
  const w = await seite.evaluate(messen, foto.toString('base64'));
  // Dreiecke und Aufrufe aus dem HUD: sagt, ob die Szene fertig gebaut war (G-134).
  const hud = await seite.evaluate(() => document.body.innerText);
  w.dreiecke = Number((hud.match(/([\d.]+) Dreiecke/)?.[1] ?? '0').replace(/\./g, ''));
  w.aufrufe = Number(hud.match(/(\d+) Aufrufe/)?.[1] ?? '0');
  // Ladezeit (D146): steht sie nicht im HUD, lud die Szene beim Foto noch.
  w.ladezeit = hud.match(/Ladezeit ([\d.]+) s/)?.[1] ?? null;
  await seite.context().close();

  const grenze = f.leer + SPIELRAUM;
  const abw = f.dreiecke ? Math.abs(w.dreiecke - f.dreiecke) / f.dreiecke : 0;
  const aus = w.leer > grenze || abw > DREIECKE_SPIELRAUM;
  if (aus) { if (f.offen) warnungen++; else blocker++; }
  zeilen.push({ f, w, aus, abw, vorher: { leer: f.leer, median: f.median, dreiecke: f.dreiecke } });
  if (NEU) {
    f.leer = Number(w.leer.toFixed(1)); f.dunkel = Number(w.dunkel.toFixed(1));
    f.median = Number(w.median.toFixed(3)); f.dreiecke = w.dreiecke; f.aufrufe = w.aufrufe;
  }
}
await browser.close();

console.log('\nBildtor — Anteil Pixel mit hoechstem Kanal exakt 0\n');
console.log('  Ort                Stimmung      leer      Grundwert   dunkel   Median    hell   Dreiecke  Aufrufe  Ladezeit');
console.log('  Referenz (Stilvorlage, G-126)                              0.2 %   0.270   47.0 %');
for (const { f, w, aus, abw, vorher } of zeilen) {
  const zeichen = aus ? (f.offen ? '!' : '✗') : '✓';
  const tri = `${(w.dreiecke / 1000).toFixed(0).padStart(6)}k` + (vorher.dreiecke ? ` (${abw > DREIECKE_SPIELRAUM ? '!' : ''}${(w.dreiecke / vorher.dreiecke * 100 - 100).toFixed(0).padStart(4)} %)` : '');
  console.log(`  ${zeichen} ${f.name.padEnd(16)} ${f.stimmung.padEnd(12)}`
    + `${w.leer.toFixed(1).padStart(6)} %  ${vorher.leer.toFixed(1).padStart(6)} %`
    + `${w.dunkel.toFixed(1).padStart(9)} %  ${w.median.toFixed(3).padStart(6)}  ${w.hell.toFixed(1).padStart(5)} %  ${tri}  ${String(w.aufrufe).padStart(4)}  ${w.ladezeit ? (w.ladezeit + ' s').padStart(7) : ' lädt!'}`
    + (f.offen ? `   offen: ${f.offen}` : ''));
  // Beim Neuschreiben den Sprung zeigen — ein Grundwert, der sich um die Haelfte
  // bewegt, ist ein Befund und kein neuer Grundwert (G-134).
  if (NEU && vorher.median && Math.abs(w.median - vorher.median) / vorher.median > 0.25)
    console.log(`      ⚠️ Median ${vorher.median.toFixed(3)} → ${w.median.toFixed(3)}: erst erklaeren, dann als Grundwert nehmen`);
}

if (NEU && !NUR) {
  writeFileSync(GRUND, JSON.stringify(grund, null, 2) + '\n');
  console.log(`\nGrundwerte neu geschrieben nach ${GRUND}`);
  process.exit(0);
}

console.log(`\n${blocker} Blocker, ${warnungen} Warnungen (Spielraum ${SPIELRAUM} Punkte)`);
if (blocker) {
  console.log('\nEin Bereich, der vorher Zeichnung hatte, ist jetzt leer (hoechster Kanal 0,');
  console.log('G-116/G-117) — oder die Dreiecke weichen mehr als 30 % vom Grundwert ab:');
  console.log('halb geladener Bau oder verschwundene Geometrie (G-134). Kein Geschmacksurteil.');
  process.exit(1);
}
