/**
 * Biom und Bodenfarbe entlang einer Blickrichtung (Weltmeter) ausgeben — wofür steht der helle Fleck im Bild?
 *   npx tsx tools/biomprobe.ts 1068 867 1105 842 [bis-Meter]
 * Gleicher Raum wie `bild.mjs`-Kamera (x, z der Szene). Keine Render nötig.
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// Die Schalter (`echt.ts`) lesen `location.search`; in Node gibt es keins. Mit `ECHT=1 npx tsx …` wie `?echt=1`.
if (process.env.ECHT) (globalThis as { location?: unknown }).location = { search: `?${process.env.ECHT === '1' ? 'echt=1' : process.env.ECHT}` };
const { entpackeWelt } = await import('../src/world/osm.js');
const { baueHoehenfeld } = await import('../src/world/lod.js');

const [x0, z0, x1, z1, bis = '90'] = process.argv.slice(2).map(Number) as [number, number, number, number, number?];
const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const feld = baueHoehenfeld(welt);
const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
const c = new THREE.Color();
console.log('Abst  x      z      Höhe   Biom        Boden-RGB (sRGB)   Wasser');
for (let d = 5; d <= Number(bis); d += 5) {
  // Mittellinie und je 12 m links/rechts (Querrichtung)
  for (const q of [-12, 0, 12]) {
    const x = x0 + ux * d - uz * q, z = z0 + uz * d + ux * q;
    feld.bodenfarbe(x, z, c);
    const s = c.clone().convertLinearToSRGB();
    console.log(`${String(d).padStart(3)}${q >= 0 ? '+' : ''}${q}`.padEnd(7),
      x.toFixed(0).padEnd(6), z.toFixed(0).padEnd(6), feld.hoehe(x, z).toFixed(1).padEnd(6), String(feld.biom(x, z)).padEnd(11),
      [s.r, s.g, s.b].map(v => v.toFixed(2)).join(' '), ' ', feld.wasserTiefe(x, z).toFixed(2));
  }
}
