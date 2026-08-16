/** Terrain aus den Weltdaten bauen und Kennzahlen prüfen (headless, ohne Renderer). */
import { readFileSync, writeFileSync } from 'node:fs';
import { baueTerrain, baueGewaesser, baueGebaeude, MASSSTAB } from '../src/world/terrain.js';

const { welt } = JSON.parse(readFileSync('public/world/oental.json', 'utf8'));
const t = baueTerrain(welt);
const pos = t.geometrie.getAttribute('position');
const bb = t.geometrie.boundingBox!;

console.log(`Terrain Œntal`);
console.log(`  Raster        ${welt.aufloesung} x ${welt.aufloesung}`);
console.log(`  Ausdehnung    ${t.breiteMeter.toFixed(0)} x ${t.tiefeMeter.toFixed(0)} m  (Stauchung 1:${MASSSTAB.stauchung})`);
console.log(`  Höhe im Spiel ${bb.min.y.toFixed(1)} – ${bb.max.y.toFixed(1)} m  (real ${welt.hoeheMin.toFixed(0)}–${welt.hoeheMax.toFixed(0)} m)`);
console.log(`  Dreiecke      ${(pos.count / 3).toLocaleString('de')}`);
console.log(`  Vertices      ${pos.count.toLocaleString('de')}`);

const w = baueGewaesser(welt, t);
const g = baueGebaeude(welt, t);
console.log(`  Gewässer      ${w ? (w.getAttribute('position').count / 3).toLocaleString('de') : 0} Dreiecke`);
console.log(`  Gebäude       ${g ? (g.getAttribute('position').count / 3).toLocaleString('de') : 0} Dreiecke`);

const gesamt = pos.count / 3 + (w ? w.getAttribute('position').count / 3 : 0) + (g ? g.getAttribute('position').count / 3 : 0);
console.log(`  GESAMT        ${gesamt.toLocaleString('de')} Dreiecke`);
console.log(gesamt < 150_000 ? '  ✓ im Budget für Handy (<150k)' : '  ✗ zu viel für Handy');

// Laufzeit-Abfragen, die das Spiel braucht
console.log('\nStichproben (Weltposition → Höhe / Biom):');
for (const [x, z] of [[0,0],[400,-400],[-600,600],[900,200]] as [number,number][]) {
  console.log(`  (${String(x).padStart(5)}, ${String(z).padStart(5)})  →  ${t.hoeheAn(x,z).toFixed(1).padStart(6)} m   ${t.biomAn(x,z)}`);
}

// Rohdaten für die Vorschau ablegen
const dump: number[] = [];
for (let i = 0; i < pos.count; i++) dump.push(pos.getX(i), pos.getY(i), pos.getZ(i));
const col = t.geometrie.getAttribute('color');
const cols: number[] = [];
for (let i = 0; i < col.count; i++) cols.push(col.getX(i), col.getY(i), col.getZ(i));
writeFileSync('.cache/preview.json', JSON.stringify({ pos: dump, col: cols }));
console.log('\n  .cache/preview.json geschrieben');
