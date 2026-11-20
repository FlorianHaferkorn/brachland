/** Lokaler DGM1-Ausschnitt im Weltmeter-Raster. Gibt das Regionsfeld nahhoehen als JSON aus. */
import { readFileSync } from 'node:fs';
import { fromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';
import { entpackeWelt } from '../src/world/osm.js';
import { baueHoehenfeld } from '../src/world/lod.js';
import { QUELLE } from './dgm1.js';

const [region, ...werte] = process.argv.slice(2);
const [x0, z0, x1, z1, datum, auslauf] = werte.map(Number);
if (!region || !/^[a-z0-9-]+$/.test(region) || werte.length !== 6
  || ![x0, z0, x1, z1].every(Number.isInteger) || x0 >= x1 || z0 >= z1
  || !Number.isFinite(datum) || !(auslauf > 0)) {
  throw new Error('Aufruf: tsx tools/dgm-nahhoehen.ts <region> <x0> <z0> <x1> <z1> <datum> <auslauf>');
}
const welt = entpackeWelt(JSON.parse(readFileSync(`public/world/${region}.json`, 'utf8')).welt);
const [sued, west, nord, ost] = welt.bbox;
const { breiteMeter, tiefeMeter } = baueHoehenfeld(welt);
const nachUtm = proj4('EPSG:4326', '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
const utm = (x: number, z: number) => nachUtm.forward([
  west + (x / breiteMeter + .5) * (ost - west), nord - (z / tiefeMeter + .5) * (nord - sued),
]);
const [e, n] = utm((x0 + x1) / 2, (z0 + z1) / 2);
const kachel = `${Math.floor(e / 1000)}_${Math.floor(n / 1000)}`;
const bytes = readFileSync(`.cache/dgm1/${kachel}.tif`);
const bild = await (await fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)).getImage();
const [ursprungX, ursprungY] = bild.getOrigin();
const [dx, dy] = bild.getResolution();
if (dx !== 1 || dy !== -1 || bild.getGeoKeys()?.ProjectedCSTypeGeoKey !== 25832) throw new Error('DGM1 in ETRS89/UTM 32N erwartet.');
const [hoehen] = await bild.readRasters() as unknown as Float32Array[];
const kachelbreite = bild.getWidth(), kacheltiefe = bild.getHeight();
const breite = x1 - x0 + 1, tiefe = z1 - z0 + 1;
const zeilen: string[] = [];
for (let z = z0; z <= z1; z++) {
  const zeile = Buffer.alloc(breite * 2);
  for (let x = x0; x <= x1; x++) {
    const [ostwert, nordwert] = utm(x, z);
    const u = (ostwert - ursprungX) / dx - .5, v = (nordwert - ursprungY) / dy - .5;
    const ix = Math.floor(u), iz = Math.floor(v);
    if (ix < 0 || iz < 0 || ix >= kachelbreite - 1 || iz >= kacheltiefe - 1) {
      throw new Error(`Die Näherung überschreitet Kachel ${kachel} bei ${x}, ${z}.`);
    }
    const a = iz * kachelbreite + ix;
    const [h00, h10, h01, h11] = [hoehen[a], hoehen[a + 1], hoehen[a + kachelbreite], hoehen[a + kachelbreite + 1]];
    if ([h00, h10, h01, h11].some(h => !Number.isFinite(h) || h === -9999)) throw new Error('DGM-Nodata im Ausschnitt.');
    const fx = u - ix, fz = v - iz;
    const h = (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
    zeile.writeInt16LE(Math.round((h - datum) * 100), (x - x0) * 2);
  }
  zeilen.push(zeile.toString('base64'));
}
console.log(JSON.stringify({ ursprung: [x0, z0], breite, tiefe, schritt: 1, auslauf, datum, zeilen,
  quelle: `${QUELLE}, Kachel ${kachel}, ETRS89/UTM 32N` }, null, 2));
