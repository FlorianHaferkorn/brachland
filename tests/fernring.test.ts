/**
 * D349: Der DGM1-Ring liegt auf dem groben Fernraster und trägt die Kulisse rund um die Region.
 *
 * Geprüft wird die Geometrie, nicht der Look: Rasterlage, Treffgenauigkeit an den Stützpunkten,
 * Auslauf auf das grobe Raster am Ringrand und nach oben zeigende Dreiecke.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { baueFernland, type Fernland } from '../src/world/fernland.js';
import { entpackeWelt } from '../src/world/osm.js';
import { MASSSTAB } from '../src/world/terrain.js';

const lies = <T>(pfad: string) => JSON.parse(readFileSync(pfad, 'utf8')) as T;

/** D350: `feinBis` ist die Ringtiefe mit vollem Raster; jenseits trägt nur jede zweite Feinlinie. */
function pruefe(region: string, feinBis: number): number {
const welt = entpackeWelt(lies<{ welt: Parameters<typeof entpackeWelt>[0] }>(`public/world/${region}.json`).welt);
const grund = lies<Fernland>(`public/world/${region}-fern.json`);
const ring = lies<Fernland>(`public/world/${region}-fern-ring.json`);

// 1. Rasterlage: Ringkanten auf groben Gitterlinien, vier Feinlinien je Zelle.
const [s, w, n, o] = grund.bbox;
const ende = grund.aufloesung - 1;
const zelleLat = (n - s) / ende, zelleLon = (o - w) / ende;
const aufLinie = (wert: number, start: number, zelle: number) =>
  Math.abs((wert - start) / zelle - Math.round((wert - start) / zelle)) < 1e-6;
const [rs, rw, rn, ro] = ring.bbox;
for (const [wert, start, zelle] of [[rs, s, zelleLat], [rn, s, zelleLat], [rw, w, zelleLon], [ro, w, zelleLon]])
  assert.ok(aufLinie(wert, start, zelle), `Ringkante ${wert} liegt nicht auf dem groben Raster`);
const zellen = Math.round((ro - rw) / zelleLon);
assert.equal(ring.aufloesung, zellen * 4 + 1, 'Ring braucht vier Feinlinien je grober Zelle');
assert.equal(Math.round((rn - rs) / zelleLat), zellen, 'Ring ist nicht quadratisch im Zellmaß');

// Der Ring umschliesst die Region mit Rand.
const [gs, gw, gn, go] = welt.bbox;
assert.ok(rs < gs && rn > gn && rw < gw && ro > go, 'Ring umschliesst die Region nicht');
const nullen = ring.hoehen.flat().filter(h => h === null).length;
assert.equal(nullen, 0, `Ring hat ${nullen} Lücken`);

// 2. Geometrie bauen und Vertices nach Lage aufschlüsseln.
const licht = {
  dunst: '#999f9b', sonne: '#ffffff', sonneStaerke: 1, umgebung: '#888888', umgebungStaerke: 1,
  sonnenstand: [1, 1, 1] as const,
};
const geo = baueFernland({ ...grund, detail: ring }, welt, licht, feinBis);
assert.ok(geo, 'Fernland ohne Geometrie');
const pos = geo.getAttribute('position');
const index = geo.getIndex();
assert.ok(index, 'Ringpfad muss indiziert sein');
for (let i = 0; i < pos.count * 3; i++) assert.ok(Number.isFinite(pos.array[i]), 'Vertex nicht endlich');

const mLat = (gs + gn) / 2;
const regBreite = (go - gw) * 111_320 * Math.cos(mLat * Math.PI / 180);
const regTiefe = (gn - gs) * 111_320;
const zuWelt = (lat: number, lon: number): [number, number] => [
  ((lon - gw) / (go - gw) - 0.5) * regBreite,
  ((gn - lat) / (gn - gs) - 0.5) * regTiefe,
];
const zuHoehe = (h: number) => (h - welt.hoeheMin) * MASSSTAB.ueberhoehung / MASSSTAB.stauchung;
const schluessel = (x: number, z: number) => `${Math.round(x * 10)}:${Math.round(z * 10)}`;
const hoeheBei = new Map<string, number>();
for (let i = 0; i < pos.count; i++) hoeheBei.set(schluessel(pos.getX(i), pos.getZ(i)), pos.getY(i));

const ra = ring.aufloesung - 1;
const ringLat = (i: number) => rn - (rn - rs) * i / ra;
const ringLon = (j: number) => rw + (ro - rw) * j / ra;
const meterLon = regBreite / (go - gw);

// 3. Im Inneren des Rings (über 220 m vom Rand, ausserhalb der Region) trifft jeder Vertex den Stützpunkt.
let geprueft = 0, groessteAbweichung = 0;
for (let i = 0; i <= ra; i += 2) {
  for (let j = 0; j <= ra; j += 2) {
    const lat = ringLat(i), lon = ringLon(j);
    const rand = Math.min((lat - rs) * 111_320, (rn - lat) * 111_320, (lon - rw) * meterLon, (ro - lon) * meterLon);
    const inRegion = lat > gs && lat < gn && lon > gw && lon < go;
    if (rand < 230 || inRegion) continue;
    const [x, z] = zuWelt(lat, lon);
    const y = hoeheBei.get(schluessel(x, z));
    if (y === undefined) continue; // Punkt im Nahtstreifen der Region
    groessteAbweichung = Math.max(groessteAbweichung, Math.abs(y - zuHoehe(ring.hoehen[i][j]!)));
    geprueft++;
  }
}
assert.ok(geprueft > 4000, `${region}: zu wenige Ringpunkte geprüft (${geprueft})`);
assert.ok(groessteAbweichung < 0.01, `Ring weicht ${groessteAbweichung} vom DGM1 ab`);

// 4. Am Ringrand läuft die Kulisse exakt auf das grobe Raster aus (keine Stufe zur Ferne).
let randPunkte = 0, randAbweichung = 0;
for (let k = 0; k <= ra; k += 4) { // grobe Knoten: immer Vertex
  for (const [i, j] of [[0, k], [ra, k], [k, 0], [k, ra]]) {
    const gi = Math.round((n - ringLat(i)) / zelleLat), gj = Math.round((ringLon(j) - w) / zelleLon);
    const [x, z] = zuWelt(ringLat(i), ringLon(j));
    const y = hoeheBei.get(schluessel(x, z));
    if (y === undefined) continue;
    randAbweichung = Math.max(randAbweichung, Math.abs(y - zuHoehe(grund.hoehen[gi][gj]!)));
    randPunkte++;
  }
}
assert.ok(randPunkte > 200, `zu wenige Randpunkte (${randPunkte})`);
assert.ok(randAbweichung < 0.01, `Ringrand springt um ${randAbweichung} gegen das grobe Raster`);

// 5. Alle Dreiecke zeigen nach oben (FrontSide, siehe `dreieckOben`).
const idx = index.array;
for (let t = 0; t < idx.length; t += 3) {
  const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
  const ux = pos.getX(b) - pos.getX(a), uz = pos.getZ(b) - pos.getZ(a);
  const vx = pos.getX(c) - pos.getX(a), vz = pos.getZ(c) - pos.getZ(a);
  assert.ok(uz * vx - ux * vz >= -1e-6, `Dreieck ${t / 3} zeigt nach unten`);
}

console.log(`fernring ${region} fein bis ${feinBis} m: ${idx.length / 3} Dreiecke, ${geprueft} Stützpunkte < ${groessteAbweichung.toFixed(4)}, Rand ${randPunkte} Punkte < ${randAbweichung.toFixed(4)}`);
return idx.length / 3;
}

const voll = pruefe('oental', Infinity);
const halb = pruefe('oental', 1000);
assert.ok(halb < voll * 0.85, `Halbierung spart zu wenig (${halb} gegen ${voll})`);
pruefe('fahlmoos', 1000);
