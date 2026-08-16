/** Größenverhältnisse prüfen: Spieler, Kreatur, Baum, Haus, Region. */
import { MASSSTAB, GROESSE } from '../src/world/terrain.js';

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

const gehen = 1.4, laufen = 5.0;
console.log(`\nQuerung der Region (${REAL.region} m real):`);
console.log(`  gehen  ${(REAL.region / gehen / 60).toFixed(0)} min`);
console.log(`  laufen ${(REAL.region / laufen / 60).toFixed(0)} min`);
