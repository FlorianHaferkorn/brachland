/**
 * Größenverhältnisse prüfen: Spieler, Kreatur, Baum, Haus, Region.
 *
 * Die Querungszeiten unten standen einmal auf eigenen Zahlen (1,4 und 5,0 m/s) und
 * meldeten deshalb „gehen 48 min" für ein Spiel, in dem man 16 min braucht — eine
 * Messung, die einen Fußgänger beschrieb, den es nicht gibt. Sie kommen jetzt aus
 * `src/spieler/tempo.ts`, derselben Datei, aus der die Bildschleife liest.
 */
import { MASSSTAB, GROESSE } from '../src/world/terrain.js';
import { GEHEN, RENNEN, SPRUNGHOEHE } from '../src/spieler/tempo.js';
import { GLEIT_VERHAELTNIS, reichweite, flugdauer, fallgeschwindigkeit } from '../src/spieler/gleiten.js';

const REAL = {
  spieler: 1.8, grathorn: 1.1, flussvater: 6.0,
  fichte: 22, haus: 6, kirchturm: 30,
  region: 4000, sichtweiteNebel: 420 * MASSSTAB.stauchung,
};
console.log(`Stauchung 1:${MASSSTAB.stauchung}\n`);
console.log(`${'Objekt'.padEnd(14)} ${'real (m)'.padStart(9)} ${'Spieleinheiten'.padStart(15)}`);
console.log('-'.repeat(42));
for (const [k, v] of Object.entries(REAL))
  console.log(`${k.padEnd(14)} ${v.toFixed(1).padStart(9)} ${(v / MASSSTAB.stauchung).toFixed(2).padStart(15)}`);

const kam = { hoehe: GROESSE.kameraHoehe, abstand: GROESSE.kameraAbstand };
console.log(`\nKamera laut RegionsSzene: ${kam.hoehe} über, ${kam.abstand} hinter dem Spieler`);
console.log(`  = real ${kam.hoehe * MASSSTAB.stauchung} m über, ${kam.abstand * MASSSTAB.stauchung} m hinter`);
console.log(`  Spieler wäre ${(REAL.spieler / MASSSTAB.stauchung).toFixed(2)} Einheiten hoch`);
console.log(`  → Bildhöhe des Spielers bei FOV 55: ${(100 * (REAL.spieler / MASSSTAB.stauchung) / (2 * kam.abstand * Math.tan(55 * Math.PI / 360))).toFixed(1)} % des Bildes`);

console.log(`\nQuerung der Region (${REAL.region} m real):`);
console.log(`  gehen   ${GEHEN.toFixed(1)} m/s → ${(REAL.region / GEHEN / 60).toFixed(0)} min`);
console.log(`  rennen  ${RENNEN.toFixed(1)} m/s → ${(REAL.region / RENNEN / 60).toFixed(0)} min`);
console.log(`  (echter Mensch: 1,4 und 5,0 m/s → 48 und 13 min. Ledger D18, G-27)`);
console.log(`  Sprunghöhe ${SPRUNGHOEHE.toFixed(2)} m`);

console.log(`\nGleiten (${GLEIT_VERHAELTNIS}:1):`);
console.log(`  ${'aus Höhe'.padStart(9)} ${'Weite'.padStart(8)} ${'Flugzeit'.padStart(9)}`
  + ` ${'zu Fuß'.padStart(8)} ${'ohne Gleiter aufschlagen mit'.padStart(29)}`);
for (const h of [10, 50, 100, 200, 400]) {
  const w = reichweite(h);
  console.log(`  ${(h + ' m').padStart(9)} ${(w.toFixed(0) + ' m').padStart(8)}`
    + ` ${(flugdauer(h).toFixed(0) + ' s').padStart(9)}`
    + ` ${((w * 1.4 / RENNEN).toFixed(0) + ' s').padStart(8)}`
    + ` ${(fallgeschwindigkeit(h).toFixed(0) + ' m/s').padStart(29)}`);
}
