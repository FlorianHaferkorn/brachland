/**
 * Hat Schwimmen im Œntal überhaupt einen Ort?
 *
 * Die Traversal-Vorlage listet Schwimmen als eine von fünf Fortbewegungsarten. Bevor
 * es gebaut wird, muss eine Zahl her: Ein Alpental hat Bäche, keine Seen, und
 * Schwimmen in einem drei Meter breiten Bach ist eine Fähigkeit ohne Anwendung —
 * gebaute Funktion, die nie auslöst, ist teurer als keine Funktion.
 *
 * **Der erste Anlauf dieses Werkzeugs war falsch** und steht hier als Warnung:
 * Er hat die Breite aus dem Biom-Raster gemessen und kam auf „Median 15,6 m, 100 %
 * schwimmbar". Die Rasterzelle IST 15,6 m. Ein 4-m-Bach belegt eine volle Zelle und
 * misst sich damit als 15,6 m breit — gemessen wurde die Auflösung, nicht das
 * Gewässer. Die Breite steht an einer anderen Stelle: `welt.linien[].breite`, aus
 * dem OSM-Tag `waterway`, und das ist die Zahl, aus der auch die Geometrie entsteht.
 *
 * Merksatz: Eine Messung, deren Ergebnis genau die Rasterweite ist, misst das Raster.
 *
 * `npm run wasser`
 */
import { readFileSync } from 'node:fs';
import { entpackeWelt } from '../src/world/osm.js';
import { MASSSTAB } from '../src/world/terrain.js';
import { baueWasserfeld } from '../src/world/wasserfeld.js';

const roh = JSON.parse(readFileSync('public/world/oental.json', 'utf8'));
const welt = entpackeWelt(roh.welt);

const METER_JE_GRAD = 111_320;
const [sued, , nord] = welt.bbox;
const mittelLat = (sued + nord) / 2;
/** Länge eines Linienstücks in Metern. */
const laenge = (a: [number, number], b: [number, number]) => Math.hypot(
  (b[1] - a[1]) * METER_JE_GRAD * Math.cos(mittelLat * Math.PI / 180),
  (b[0] - a[0]) * METER_JE_GRAD,
);

console.log('Wasser im Œntal — aus den OSM-Linien, nicht aus dem Biom-Raster\n');

interface Lauf { art: string; breite: number; meter: number }
const laeufe: Lauf[] = welt.linien.map(l => {
  let m = 0;
  for (let k = 0; k < l.punkte.length - 1; k++) m += laenge(l.punkte[k], l.punkte[k + 1]);
  return { art: l.art, breite: l.breite / MASSSTAB.stauchung, meter: m };
});

const nachArt = new Map<string, { anzahl: number; meter: number; breite: number }>();
for (const l of laeufe) {
  const e = nachArt.get(l.art) ?? { anzahl: 0, meter: 0, breite: l.breite };
  e.anzahl++; e.meter += l.meter; e.breite = l.breite;
  nachArt.set(l.art, e);
}

console.log('  Art            Läufe      Länge      Breite');
for (const [art, e] of [...nachArt].sort((a, b) => b[1].meter - a[1].meter))
  console.log(`  ${art.padEnd(14)} ${String(e.anzahl).padStart(5)} ${(e.meter / 1000).toFixed(1).padStart(9)} km ${e.breite.toFixed(1).padStart(8)} m`);

const gesamtM = laeufe.reduce((a, l) => a + l.meter, 0);
const maxBreite = Math.max(...laeufe.map(l => l.breite));
const flaeche = laeufe.reduce((a, l) => a + l.meter * l.breite, 0);
console.log('');
console.log(`  Fließgewässer gesamt      ${(gesamtM / 1000).toFixed(1)} km`);
console.log(`  Wasserfläche              ${(flaeche / 1e4).toFixed(2)} ha`);
console.log(`  Breitestes Gewässer       ${maxBreite.toFixed(1)} m`);
console.log('');

// ---- Urteil ---------------------------------------------------------------
//
// Der Vergleichsmaßstab ist die Figur: 1,8 m hoch, rund 0,6 m breit, Sprungweite
// bei 4,2 m/s und 1,1 s Flugzeit rund 4,6 m. Schwimmen setzt Wasser voraus, das
// man weder durchqueren noch überspringen kann.
const SPRUNGWEITE = 4.6;
const SCHWIMMBAR = 8;
console.log('  Urteil');
console.log(`    Sprungweite der Figur: ${SPRUNGWEITE} m. Schwimmenswert wäre Wasser ab ~${SCHWIMMBAR} m.`);
if (maxBreite < SPRUNGWEITE) {
  console.log(`    ✗ Das breiteste Gewässer der Region (${maxBreite.toFixed(1)} m) ist schmaler als ein Sprung.`);
  console.log('      Schwimmen hätte hier NIRGENDS einen Ort — es gäbe keine einzige Stelle,');
  console.log('      an der es auslöst. Das Œntal führt Bäche, keine Seen.');
  console.log('    → Ehrliche Umsetzung: Waten. Langsamer, Ausdauer zehrt, kein Sprung');
  console.log('      im Wasser. Schwimmen wartet auf eine Region mit einem See — und die');
  console.log('      Kiemenbiber-Freischaltung aus der Traversal-Vorlage wartet mit.');
} else if (maxBreite < SCHWIMMBAR) {
  console.log(`    ⚠ ${maxBreite.toFixed(1)} m: überspringbar, aber knapp. Waten ist die bessere Antwort.`);
} else {
  console.log(`    ✓ ${maxBreite.toFixed(1)} m — breit genug, Schwimmen lohnt.`);
}

// ---- Löst das Wasserfeld auch aus? ----------------------------------------
//
// Der Test in `tests/reiten.test.ts` prüft `baueWasserfeld` gegen einen künstlich
// geraden Bach. Hier läuft dasselbe Modul gegen die echten 190 OSM-Läufe — der
// Unterschied ist die Frage, ob die Umrechnung von lat/lon in Meter auch dann
// stimmt, wenn die Zahlen nicht rund sind.
console.log('');
const breiteM = 4000, tiefeM = 4000; // grob; nur für die Umrechnung der Testpunkte
const feld = baueWasserfeld(welt, breiteM, tiefeM);
const WATEN_AB = 0.30;

let getroffen = 0, tiefste = 0;
const proben: number[] = [];
for (const l of welt.linien) {
  // Mittelpunkt jedes Laufs — dort MUSS Wasser sein, sonst greift Waten nie.
  const p = l.punkte[Math.floor(l.punkte.length / 2)];
  const x = ((p[1] - welt.bbox[1]) / (welt.bbox[3] - welt.bbox[1]) - 0.5) * breiteM;
  const z = ((welt.bbox[2] - p[0]) / (welt.bbox[2] - welt.bbox[0]) - 0.5) * tiefeM;
  const t = feld.tiefeAn(x, z);
  proben.push(t);
  if (t >= WATEN_AB) getroffen++;
  tiefste = Math.max(tiefste, t);
}
console.log('  Wasserfeld gegen die echten Läufe');
console.log(`    Segmente im Feld          ${feld.segmente.toLocaleString('de')}`);
console.log(`    Läufe, deren Mitte watbar ${getroffen} von ${welt.linien.length} `
          + `(${(100 * getroffen / welt.linien.length).toFixed(0)} %)`);
console.log(`    Tiefste Stelle            ${tiefste.toFixed(2)} m`);
console.log(getroffen === welt.linien.length
  ? '    ✓ Jeder Lauf löst Waten aus — das Feld trifft die Geometrie.'
  : `    ⚠ ${welt.linien.length - getroffen} Läufe lösen NICHT aus — Umrechnung prüfen.`);
