/**
 * Wie viele Klippen findet das Verfahren, und wo?
 *
 * `npm run klippen`
 */
import { readFileSync } from 'node:fs';
import { entpackeWelt } from '../src/world/osm.js';
import { baueHoehenfeld, hoeheAufFlaeche } from '../src/world/lod.js';
import { findeKlippen, baueKlippenGeometrie, KLIPPE_AB_GRAD } from '../src/world/klippen.js';

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const feld = baueHoehenfeld(welt);
const t0 = process.hrtime.bigint();
const klippen = findeKlippen(feld, (x, z) => hoeheAufFlaeche(feld, x, z));
const ms = Number(process.hrtime.bigint() - t0) / 1e6;

const flaecheKm2 = (feld.breiteMeter * feld.tiefeMeter) / 1e6;
console.log(`Klippen ab ${KLIPPE_AB_GRAD}° Neigung\n`);
console.log(`  gefunden          ${String(klippen.length).padStart(6)}  (${(klippen.length / flaecheKm2).toFixed(0)} je km²)`);
console.log(`  Suchdauer         ${ms.toFixed(0).padStart(6)} ms  (einmalig beim Start)`);

const hoehen = klippen.map(k => k.hoehe).sort((a, b) => a - b);
if (hoehen.length) {
  console.log(`  Wandhoehe         ${hoehen[0].toFixed(1)}–${hoehen[hoehen.length - 1].toFixed(1)} m,` +
              ` Median ${hoehen[hoehen.length >> 1].toFixed(1)} m`);
}

const tri = (g: any) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
let summe = 0;
for (let v = 0; v < 3; v++) {
  const n = klippen.filter(k => k.variante === v).length;
  const d = tri(baueKlippenGeometrie(v));
  summe += d * n;
  console.log(`  Variante ${v}        ${String(n).padStart(6)} Stueck a ${d} Dreiecke`);
}
console.log(`\n  Gesamt ohne Culling ${Math.round(summe).toLocaleString('de')} Dreiecke`);

// Was steht wirklich im Bild? Sichtweite 320 m.
for (const [x, z] of [[0, 0], [300, -300], [-350, 350], [450, 100]] as [number, number][]) {
  const n = klippen.filter(k => Math.hypot(k.position[0] - x, k.position[2] - z) <= 320).length;
  console.log(`  Standort (${String(x).padStart(4)},${String(z).padStart(5)})  ${String(n).padStart(4)} Waende in Reichweite`);
}
