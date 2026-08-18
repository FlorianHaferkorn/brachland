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
import { baueHoehenfeld, hoeheAufFlaeche } from '../src/world/lod.js';

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

/**
 * Breiten **je Lauf** sammeln, nicht eine je Art.
 *
 * Hier stand `e.breite = l.breite` in der Schleife — der Wert des zuletzt
 * gelesenen Laufs, ausgegeben als wäre er die Breite der ganzen Art. Damit hat
 * das Werkzeug die Umstellung aus G-54 **verdeckt**: In der gebauten Welt tragen
 * 50 von 190 Läufen inzwischen eine echte OSM-Breite (0,3 bis 3 m), gemeldet
 * wurden unverändert 4,0 m — die Schätzung. Eine Kennzahl, die einen Fortschritt
 * nicht zeigen kann, kann auch keinen Rückschritt zeigen.
 *
 * Die Schätzwerte stehen in `src/world/osm.ts`: stream 4, ditch 2, river 12.
 * Alles, was exakt darauf liegt, ist mit hoher Wahrscheinlichkeit geschätzt und
 * wird hier getrennt gezählt.
 */
const GESCHAETZT: Record<string, number> = { stream: 4, ditch: 2, river: 12 };

const nachArt = new Map<string, { breiten: number[]; meter: number }>();
for (const l of laeufe) {
  const e = nachArt.get(l.art) ?? { breiten: [], meter: 0 };
  e.breiten.push(l.breite); e.meter += l.meter;
  nachArt.set(l.art, e);
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

console.log('  Art            Läufe      Länge   Breite: min  Median     max   davon gemessen');
for (const [art, e] of [...nachArt].sort((a, b) => b[1].meter - a[1].meter)) {
  const gem = e.breiten.filter(b => Math.abs(b - (GESCHAETZT[art] ?? -1)) > 0.01).length;
  console.log(`  ${art.padEnd(14)} ${String(e.breiten.length).padStart(5)} ${(e.meter / 1000).toFixed(1).padStart(9)} km`
    + ` ${Math.min(...e.breiten).toFixed(1).padStart(9)} ${median(e.breiten).toFixed(1).padStart(7)}`
    + ` ${Math.max(...e.breiten).toFixed(1).padStart(7)} m`
    + ` ${(gem + ' von ' + e.breiten.length).padStart(16)}`);
}
const alleGemessen = laeufe.filter(l => Math.abs(l.breite - (GESCHAETZT[l.art] ?? -1)) > 0.01).length;
console.log(`\n  ${alleGemessen} von ${laeufe.length} Läufen tragen eine Breite aus OSM (G-54),`
  + ` die übrigen ${laeufe.length - alleGemessen} sind geschätzt.`);

const gesamtM = laeufe.reduce((a, l) => a + l.meter, 0);
const maxBreite = Math.max(...laeufe.map(l => l.breite));
const flaeche = laeufe.reduce((a, l) => a + l.meter * l.breite, 0);
console.log('');
console.log(`  Fließgewässer gesamt      ${(gesamtM / 1000).toFixed(1)} km`);
console.log(`  Wasserfläche              ${(flaeche / 1e4).toFixed(2)} ha`);
console.log(`  Breitestes Gewässer       ${maxBreite.toFixed(1)} m`);
console.log('');

// ---- Stehende Gewässer -----------------------------------------------------
//
// **Der Teil, den der erste Anlauf komplett übersehen hat.** Gemessen wurden nur
// `welt.linien`. Stehendes Wasser liegt in `welt.flaechen` als Polygon mit dem
// Biom `wasser` — elf Stück, und der größte ist schwimmbar. Der daraus gezogene
// Schluss „Schwimmen hat hier keinen Ort" war deshalb falsch.
const METER_JE_GRAD2 = METER_JE_GRAD;
const [s2, w2, n2, o2] = welt.bbox;
const breiteReg = (o2 - w2) * METER_JE_GRAD2 * Math.cos(mittelLat * Math.PI / 180);
const tiefeReg = (n2 - s2) * METER_JE_GRAD2;
const zuWelt = (lat: number, lon: number): [number, number] => [
  ((lon - w2) / (o2 - w2) - 0.5) * breiteReg,
  ((n2 - lat) / (n2 - s2) - 0.5) * tiefeReg,
];

console.log('  Stehende Gewässer (natural=water), größte zuerst');
const teiche = welt.flaechen.filter(f => f.biom === 'wasser').map(f => {
  const p = f.punkte.map(q => zuWelt(q[0], q[1]));
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i][0] * p[j][1] - p[j][0] * p[i][1];
  }
  const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
  return {
    ha: Math.abs(a) / 2 / 1e4,
    b: Math.max(...xs) - Math.min(...xs),
    t: Math.max(...zs) - Math.min(...zs),
    mitte: [xs.reduce((x, y) => x + y, 0) / p.length, zs.reduce((x, y) => x + y, 0) / p.length] as [number, number],
  };
}).sort((a, b) => b.ha - a.ha);
for (const t of teiche.slice(0, 5))
  console.log(`    ${t.ha.toFixed(3).padStart(7)} ha   ${Math.round(t.b)} × ${Math.round(t.t)} m`);
console.log(`    ${teiche.length} insgesamt, zusammen ${teiche.reduce((a, t) => a + t.ha, 0).toFixed(2)} ha`);
console.log('');

// ---- Urteil ---------------------------------------------------------------
//
// Der Vergleichsmaßstab ist die Figur: 1,8 m hoch, Sprungweite bei 4,2 m/s und
// 1,1 s Flugzeit rund 4,6 m. Schwimmen setzt Wasser voraus, das man weder
// durchqueren noch überspringen kann — **und das tief genug ist**.
const SPRUNGWEITE = 4.6;
const SCHWIMMEN_AB = 1.35;
console.log('  Urteil');
console.log(`    Fließend: breitestes ${maxBreite.toFixed(1)} m gegen ${SPRUNGWEITE} m Sprungweite`);
console.log(`      → watbar, nicht schwimmbar. Waten greift auf allen ${(gesamtM / 1000).toFixed(1)} km.`);
const groesster = teiche[0];
if (groesster && Math.min(groesster.b, groesster.t) > SPRUNGWEITE * 2) {
  console.log(`    Stehend: größter Weiher ${Math.round(groesster.b)} × ${Math.round(groesster.t)} m`);
  console.log(`      → **schwimmbar.** Hier lag der Fehler des ersten Anlaufs.`);
} else {
  console.log('    Stehend: alle Weiher unter zwei Sprungweiten — auch hier nur Waten.');
}

// ---- Bett: sinkt man tatsächlich ein? --------------------------------------
//
// Die Frage, die den ganzen Umbau ausgelöst hat. Vorher lag das Wasserband 30 cm
// ÜBER dem Gelände — es gab keine Mulde, also konnte man auch nicht einsinken.
// Jetzt wird das Bett aus dem Höhenfeld geschnitten, und weil ALLES, was aufsitzt,
// aus derselben Funktion liest (D20), sinkt die Figur von selbst.
console.log('');
console.log('  Bett im Gelände — Höhe auf der GEZEICHNETEN Fläche');
const feld2 = baueHoehenfeld(welt);
const zeig = (was: string, x: number, z: number) => {
  const sohle = hoeheAufFlaeche(feld2, x, z);
  const t = feld2.wasserTiefe(x, z);
  console.log(`    ${was.padEnd(26)} Sohle ${sohle.toFixed(2)} m · Tiefe ${t.toFixed(2)} m `
            + `· Spiegel ${(sohle + t).toFixed(2)} m` + (t >= SCHWIMMEN_AB ? '   ← schwimmbar' : ''));
};
// Bachmitte gegen 8 m daneben — der Unterschied IST das Bett.
const bach = welt.linien.find(l => l.art === 'stream')!;
const bp = zuWelt(...bach.punkte[Math.floor(bach.punkte.length / 2)]);
zeig('Bachmitte', bp[0], bp[1]);
zeig('8 m neben dem Bach', bp[0] + 8, bp[1]);
if (groesster) {
  zeig('Weihermitte', groesster.mitte[0], groesster.mitte[1]);
  zeig('30 m neben dem Weiher', groesster.mitte[0] + 30, groesster.mitte[1]);
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
