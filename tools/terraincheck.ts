/** Terrain aus den Weltdaten bauen und Kennzahlen prüfen (headless, ohne Renderer). */
import { entpackeWelt } from '../src/world/osm.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { baueTerrain, baueGebaeude, MASSSTAB } from '../src/world/terrain.js';
import { baueHoehenfeld, baueKachelraster, aufsatzboden } from '../src/world/lod.js';
import { zerlegeBaender, baueBaenderStufe } from '../src/world/baender.js';

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const t = baueTerrain(welt);
// Aufsatzgeometrie liest dieselbe Quelle wie im Spiel — sonst zaehlt dieses
// Werkzeug Dreiecke einer Szene, die so nie gezeichnet wird (G-73).
const feld = baueHoehenfeld(welt);
const boden = aufsatzboden(feld);
const satz = zerlegeBaender(welt, feld);
const kacheln = baueKachelraster(feld);
const pos = t.geometrie.getAttribute('position');
const bb = t.geometrie.boundingBox!;

console.log(`Terrain Œntal`);
console.log(`  Raster        ${welt.aufloesung} x ${welt.aufloesung}`);
console.log(`  Ausdehnung    ${t.breiteMeter.toFixed(0)} x ${t.tiefeMeter.toFixed(0)} m  (Stauchung 1:${MASSSTAB.stauchung})`);
console.log(`  Höhe im Spiel ${bb.min.y.toFixed(1)} – ${bb.max.y.toFixed(1)} m  (real ${welt.hoeheMin.toFixed(0)}–${welt.hoeheMax.toFixed(0)} m)`);
console.log(`  Dreiecke      ${(pos.count / 3).toLocaleString('de')}`);
console.log(`  Vertices      ${pos.count.toLocaleString('de')}`);

// Baender liegen je Kachel auf ihrer eigenen LOD-Stufe; LOD0 ist die Obergrenze.
const wasserTeile = baueBaenderStufe(feld, satz, kacheln, 0);
const wTris = [...wasserTeile.wasser, ...wasserTeile.faelle]
  .reduce((a, g) => a + g.getAttribute('position').count / 3, 0);
const g = baueGebaeude(welt, boden);
console.log(`  Gewässer      ${wTris.toLocaleString('de')} Dreiecke (LOD0, ganze Region)`);
console.log(`  Gebäude       ${g ? (g.getAttribute('position').count / 3).toLocaleString('de') : 0} Dreiecke`);

const gesamt = pos.count / 3 + wTris + (g ? g.getAttribute('position').count / 3 : 0);
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
