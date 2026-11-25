/**
 * BRACHLAND — Fernland holen: das Gelände **jenseits** der Region.
 *
 * ## Warum
 *
 * Die Region endet an einer freischwebenden 0,9-m-Geländekante, und dahinter
 * steht `scene.background = null` — eine leere Dunstfläche (G-101). Das ist an
 * drei von vier Kanten nicht nur hässlich, sondern **falsch**: Die Randhöhen im
 * Westen liegen bei 848–1134 m, das ist eine Bergflanke auf halber Höhe. Real
 * steigt dort das Massiv zum Wendelstein (1838 m) weiter, im Süden zum
 * Traithen und Sudelfeld. Nur nach Osten öffnet sich echte Inntalsohle.
 *
 * ## Was
 *
 * Ein **grobes, echtes** Höhenraster über einen Kasten um die Region herum.
 * Nicht extrapoliert und nicht erfunden: dieselbe Quelle wie `eudem` im
 * Weltbau, nur weit und grob statt eng und fein. Bei Faktor 3 und 96 Punkten
 * sind das 12 km Kantenlänge bei 125 m Zellweite — für eine Silhouette am
 * Horizont mehr als genug, und die Datei bleibt bei rund 40 KB.
 *
 * Die Region selbst wird daraus **ausgespart** (`src/world/fernland.ts`), sonst
 * läge das grobe Raster über dem feinen.
 *
 * ## Aufruf
 *
 *     npm run fernland oental [faktor] [aufloesung]
 *     npm run fernland -- oental --dgm1-sued
 *     npm run fernland -- oental --dgm1-ring [rand]
 *
 * Dauert rund drei Minuten: OpenTopoData nimmt 100 Punkte je Anfrage und will
 * eine Sekunde Pause dazwischen. 96² Punkte sind 93 Anfragen — deutlich unter
 * dem Tageslimit von 1.000, aber nichts, was man nebenbei mehrfach laufen lässt.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { holeHoehen, type BBox } from '../src/world/osm.js';
import { holeHoehenDgm1, QUELLE as DGM1_QUELLE } from './dgm1.js';

const region = process.argv[2] ?? 'oental';
/**
 * D349: DGM1-Ring um die ganze Region statt nur des Südhangs (D345).
 *
 * Der Ring liegt auf Gitterlinien des groben Fernrasters und reicht `rand` Zellen (Vorgabe 18,
 * rund 2,25 km) über die Regionskante hinaus. Die Auflösung ist das Vierfache der Zellenzahl
 * plus eins — dieselbe Teilung, die `fernAchse` in `src/world/fernland.ts` einzieht, damit jede
 * Feinlinie auf einem DGM1-Stützpunkt liegt (rund 31 m). Kacheln ausserhalb Bayerns gibt es
 * nicht; deren Punkte bleiben `null` und fallen im Spiel auf das grobe Raster zurück.
 */
if (process.argv[3] === '--dgm1-ring') {
  const rand = Number(process.argv[4] ?? 18);
  const grund = JSON.parse(readFileSync(`public/world/${region}-fern.json`, 'utf8')) as { bbox: BBox; aufloesung: number };
  const reg = JSON.parse(readFileSync(`content/regions/${region}.json`, 'utf8')).bbox as BBox;
  const [s, w, n, o] = grund.bbox;
  const ende = grund.aufloesung - 1;
  const dLat = (n-s) / ende, dLon = (o-w) / ende;
  const lat = (i: number) => n - dLat * i;
  const lon = (j: number) => w + dLon * j;
  const klemme = (k: number) => Math.max(0, Math.min(ende, k));
  const iN = klemme(Math.floor((n - reg[2]) / dLat) - rand), iS = klemme(Math.ceil((n - reg[0]) / dLat) + rand);
  const jW = klemme(Math.floor((reg[1] - w) / dLon) - rand), jO = klemme(Math.ceil((reg[3] - w) / dLon) + rand);
  if (iS - iN !== jO - jW) console.log(`  Hinweis: Ring nicht quadratisch (${iS - iN} × ${jO - jW} Zellen), Raster folgt der Breite`);
  const zellen = Math.max(iS - iN, jO - jW);
  const bbox: BBox = [lat(iN + zellen), lon(jW), lat(iN), lon(jW + zellen)];
  const aufloesung = zellen * 4 + 1;
  console.log(`  Ring ${zellen} Zellen, ${aufloesung}² Punkte`);
  const { raster, luecken } = await holeHoehenDgm1(bbox, aufloesung);
  if (luecken > 0.25) throw new Error(`DGM1-Ring zu lückenhaft (${(luecken * 100).toFixed(1)} %)`);
  const hoehen = raster.map(zeile => zeile.map(h => (Number.isFinite(h) ? Math.round(h) : null)));
  const datei = `public/world/${region}-fern-ring.json`;
  writeFileSync(datei, JSON.stringify({ bbox, aufloesung, hoehen, quelle: DGM1_QUELLE }) + '\n');
  console.log(`  ${datei} — ${(readFileSync(datei).length / 1024).toFixed(0)} KB, Lücken ${(luecken * 100).toFixed(1)} %`);
  process.exit(0);
}
if (process.argv[3] === '--dgm1-sued') {
  if (region !== 'oental') throw new Error('Der D345-Ausschnitt ist für das Œntal eingemessen.');
  const grund = JSON.parse(readFileSync('public/world/oental-fern.json', 'utf8')) as { bbox: BBox; aufloesung: number };
  const [s, w, n, o] = grund.bbox;
  const lat = (i: number) => n - (n-s) * i / (grund.aufloesung-1);
  const lon = (j: number) => w + (o-w) * j / (grund.aufloesung-1);
  // Die Kanten liegen auf Gitterlinien des vorhandenen Fernraster-Ausschnitts.
  const bbox: BBox = [lat(75), lon(47), lat(50), lon(72)];
  const aufloesung = 101;
  const { raster, luecken } = await holeHoehenDgm1(bbox, aufloesung);
  if (luecken) throw new Error(`DGM1-Fernausschnitt unvollständig (${luecken * 100} % Lücken)`);
  const hoehen = raster.map(zeile => zeile.map(h => Math.round(h)));
  writeFileSync('public/world/oental-fern-sued.json', JSON.stringify({ bbox, aufloesung, hoehen, quelle: DGM1_QUELLE }) + '\n');
  process.exit(0);
}

const FAKTOR = Number(process.argv[3] ?? 3);
const AUFLOESUNG = Number(process.argv[4] ?? 96);

const r = JSON.parse(readFileSync(`content/regions/${region}.json`, 'utf8'));
const [s, w, n, e] = r.bbox as BBox;

// Um die Mitte aufziehen, nicht um eine Ecke — sonst liegt die Region schief im
// Fernland und eine Seite bekommt gar nichts.
const mLat = (s + n) / 2, mLon = (w + e) / 2;
const hLat = (n - s) / 2 * FAKTOR, hLon = (e - w) / 2 * FAKTOR;
const weit: BBox = [mLat - hLat, mLon - hLon, mLat + hLat, mLon + hLon];

const kmLat = (weit[2] - weit[0]) * 111.32;
const kmLon = (weit[3] - weit[1]) * 111.32 * Math.cos(mLat * Math.PI / 180);
console.log(`  Fernland fuer ${region}`);
console.log(`  Kasten   ${kmLon.toFixed(1)} x ${kmLat.toFixed(1)} km bei ${AUFLOESUNG}²`);
console.log(`  Zelle    ${(kmLon * 1000 / (AUFLOESUNG - 1)).toFixed(0)} m`);
console.log(`  Anfragen ${Math.ceil(AUFLOESUNG * AUFLOESUNG / 100)} à 1,1 s — bitte warten\n`);

const hoehen = await holeHoehen(weit, AUFLOESUNG);

const flach = hoehen.flat().filter(x => Number.isFinite(x));
if (flach.length < AUFLOESUNG * AUFLOESUNG * 0.9)
  throw new Error(`Zu viele Luecken: ${flach.length} von ${AUFLOESUNG ** 2} Punkten`);
let min = Infinity, max = -Infinity;
for (const x of flach) { if (x < min) min = x; if (x > max) max = x; }

// Auf ganze Meter runden: Die Zellweite ist 125 m, da ist ein Zentimeter
// Höhenauflösung eine Nachkommastelle, die nur die Datei aufbläht.
const datei = `public/world/${region}-fern.json`;
writeFileSync(datei, JSON.stringify({
  bbox: weit,
  aufloesung: AUFLOESUNG,
  hoehen: hoehen.map(z => z.map(x => (Number.isFinite(x) ? Math.round(x) : null))),
  quelle: 'EU-DEM 25 m via OpenTopoData',
}));

const kb = readFileSync(datei).length / 1024;
console.log(`  Hoehen   ${min.toFixed(0)}–${max.toFixed(0)} m ue. NN`);
console.log(`  Luecken  ${AUFLOESUNG ** 2 - flach.length}`);
console.log(`  ${datei} — ${kb.toFixed(0)} KB`);
