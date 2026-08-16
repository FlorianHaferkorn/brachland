/** Build-Schritt: Weltdaten für eine Region erzeugen und als JSON ablegen. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { holeOsm, holeHoehen, baueWelt, baueSpawns, packeWelt, type BBox } from '../src/world/osm.js';
import { holeHoehenDgm1, QUELLE as DGM1_QUELLE } from './dgm1.js';

const regionId = process.argv[2] ?? 'oental';
const aufl = Number(process.argv[3] ?? 32);
/**
 * Höhenquelle. `dgm1` ist der Standard: 1-Meter-Gelände der Bayerischen
 * Vermessungsverwaltung. `eudem` ist der alte Weg über eine Web-API (25 m) und
 * bleibt als Rückfall für Regionen außerhalb Bayerns.
 */
const quelle = (process.argv[4] ?? 'dgm1') as 'dgm1' | 'eudem';
const r = JSON.parse(readFileSync(`content/regions/${regionId}.json`, 'utf8'));
const bbox = r.bbox as BBox;

console.log(`Region ${r.name} — ${r.realeGrundlage}`);
console.log(`BBox ${bbox.join(', ')}  ·  Raster ${aufl}x${aufl}\n`);

const cache = `.cache/osm-${regionId}.json`;
let ways;
if (existsSync(cache)) {
  ways = JSON.parse(readFileSync(cache, 'utf8'));
  console.log('OSM aus Zwischenspeicher');
} else {
  console.time('OSM');
  ways = await holeOsm(bbox);
  console.timeEnd('OSM');
  if (!existsSync('.cache')) mkdirSync('.cache', { recursive: true });
  writeFileSync(cache, JSON.stringify(ways));
}
console.log(`  ${ways.length} Ways geladen`);

const cacheH = `.cache/dem-${quelle}-${regionId}-${aufl}.json`;
let hoehen;
if (existsSync(cacheH)) {
  hoehen = JSON.parse(readFileSync(cacheH, 'utf8'));
  console.log(`Höhen aus Zwischenspeicher (${quelle})`);
} else {
  console.time('Höhen');
  if (quelle === 'dgm1') {
    console.log(`Höhen aus DGM1 — ${DGM1_QUELLE}`);
    const e = await holeHoehenDgm1(bbox, aufl);
    hoehen = e.raster;
    console.log(`  ${(100 * e.luecken).toFixed(2)} % Lücken`);
    if (e.luecken > 0.02) throw new Error(
      `Zu viele Lücken (${(100 * e.luecken).toFixed(1)} %) — fehlen Kacheln? Lieber abbrechen als ein löchriges Gelände ausliefern.`);
  } else {
    hoehen = await holeHoehen(bbox, aufl);
  }
  console.timeEnd('Höhen');
  writeFileSync(cacheH, JSON.stringify(hoehen));
}

const welt = baueWelt(bbox, ways, hoehen);
console.log(`  Höhe ${welt.hoeheMin.toFixed(0)}–${welt.hoeheMax.toFixed(0)} m  (Delta ${(welt.hoeheMax - welt.hoeheMin).toFixed(0)} m)`);
console.log(`  ${welt.flaechen.length} Flächen · ${welt.linien.length} Gewässer · ${welt.gebaeude.length} Gebäude · ${welt.marker.length} Marker`);

const verteilung: Record<string, number> = {};
welt.biome.flat().forEach(b => verteilung[b] = (verteilung[b] ?? 0) + 1);
console.log('\n  Biom-Verteilung im Raster:');
Object.entries(verteilung).sort((a, b) => b[1] - a[1])
  .forEach(([b, c]) => console.log(`    ${b.padEnd(11)} ${String(c).padStart(5)}  ${(100 * c / (aufl * aufl)).toFixed(1)} %`));

const kreaturen = readdirSync('content/creatures')
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join('content/creatures', f), 'utf8')));
const spawns = baueSpawns(welt, kreaturen);
console.log('\n  Spawn-Zonen:');
for (const z of spawns) console.log(`    ${z.kreatur.padEnd(14)} ${String(z.zellen.length).padStart(4)} Zellen (${z.haeufigkeit})`);

if (!existsSync('public/world')) mkdirSync('public/world', { recursive: true });
const out = `public/world/${regionId}.json`;
// Spawn-Zonen kommen NICHT mit in die Datei: Das Spiel rechnet sie beim Start aus
// denselben Daten neu (`verteileKreaturen`). Mitzuliefern hieße, 847 KB Zellenlisten
// auszuliefern, die im Browser sofort verworfen werden.
writeFileSync(out, JSON.stringify({ welt: packeWelt(welt) }));
const kb = readFileSync(out).length / 1024;
console.log(`\n  ${out} — ${kb.toFixed(0)} KB`);
console.log(`  ${welt.attribution}`);
