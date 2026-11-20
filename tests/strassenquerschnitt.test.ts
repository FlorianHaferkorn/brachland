/** D337: Der Fahrbahnanschluss und die Absenkung müssen auf denselben Stationen liegen wie die Freihaltung. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { Region } from '../src/data/schema.js';
import type { WohnwegQuerschnitt } from '../src/data/schema.js';
import { baueHoehenfeld } from '../src/world/lod.js';
import { entpackeWelt } from '../src/world/osm.js';
import { MASSSTAB } from '../src/world/terrain.js';
import { baueStrassenbewuchs } from '../src/world/strassenbewuchs.js';
import {
  baueQuerschnittGrasmaske, baueStrassenquerschnitt, querschnittFreihaltung, querschnittGrenzen, querschnittKanten,
} from '../src/world/strassenquerschnitt.js';

const punkte = [[0, 0], [60, 0]] as const;
const profil: WohnwegQuerschnitt = {
  stationen: [[15, -6, -2], [35, -5, -.5]],
  gehwege: [{ von: 15, bis: 35, seite: -1, breite: 1.65 }],
  zufahrten: [{ von: 25, bis: 28, seite: -1, tiefe: 5 }],
};
const kanten = querschnittKanten(profil, 5);
assert.deepEqual(querschnittGrenzen(profil), [7, 43]);
assert.deepEqual(kanten(7), [-2.5, 2.5]);
assert.deepEqual(kanten(25), [-5.5, -1.25]);
assert.deepEqual(kanten(43), [-2.5, 2.5]);

const netz = baueStrassenquerschnitt(punkte, () => 0, profil, 5);
const position = netz.getAttribute('position'), rollen = netz.getAttribute('rolle');
const normal = netz.getAttribute('normal');
const bei = (s: number, rolle: number, hoehe: number) => {
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getX(i) - s) < 1e-5 && rollen.getX(i) === rolle
        && Math.abs(position.getY(i) - hoehe) < 1e-5 && normal.getY(i) > .9) return true;
  }
  return false;
};
assert.ok(bei(15, 1, .23), 'Gehweg 11 cm über der Fahrbahn');
assert.ok(bei(25, 3, .145), 'Gehweg an der Einfahrt auf 2,5 cm abgesenkt');

const maske = baueQuerschnittGrasmaske([querschnittFreihaltung(punkte, profil, 5)])!;
const koordinaten: [number, number, boolean][] = [
  [20, -3, true], [20, -7, true], [20, -9, false], [26, -9, true], [29, -9, false], [45, 0, false],
];
const { data, width, height } = maske.textur.image;
assert.ok(data instanceof Uint8Array, 'Die Grasmaske enthält die gerasterten Daten');
for (const [s, q, frei] of koordinaten) {
  assert.equal(maske.enthaelt(s, q), frei);
  const { x, y, z, w } = maske.rahmen;
  const u = (s - x) * z, v = (q - y) * w;
  const freiImRaster: boolean = u >= 0 && u < 1 && v >= 0 && v < 1
    && data[Math.floor(v * height) * width + Math.floor(u * width)] === 255;
  assert.equal(freiImRaster, frei, 'Grasmaske stimmt mit dem Straßenkörper überein');
}
maske.textur.dispose();
console.log('✓ Querschnitt schließt an das Wegband an, Bordabsenkung und Freihaltung stimmen');

const verwitterung = { staerke: .92, saum: { von: 15, bis: 35 } };
const verwittertesNetz = baueStrassenquerschnitt(punkte, () => 0, profil, 5, verwitterung);
assert.deepEqual(verwittertesNetz.getAttribute('position').array, position.array);
assert.deepEqual(verwittertesNetz.index?.array, netz.index?.array);
const belag = verwittertesNetz.getAttribute('querprofil');
assert.equal(belag.count, position.count);
for (let i = 0; i < belag.count; i++) {
  const [links, rechts] = kanten(belag.getX(i));
  const q = position.getZ(i);
  assert.ok(Math.abs(belag.getY(i) - (q - links)) < 1e-5 && Math.abs(belag.getZ(i) - (q - rechts)) < 1e-5);
}
verwittertesNetz.dispose();
netz.dispose();

const weg = { punkte, breite: 5, saat: 198749032, verfall: 0, querschnitt: querschnittGrenzen(profil) };
const clay = baueStrassenbewuchs([weg], () => 0);
assert.equal(clay.gruppe.userData.strassenbewuchs.wildkraut, 0);
clay.entsorge();
const bepflanzt = baueStrassenbewuchs([{ ...weg, vermessenerSaum: { ...profil, verwitterung } }], () => 0);
const horste = bepflanzt.gruppe.children.find((objekt): objekt is InstancedMesh => objekt instanceof InstancedMesh);
assert.ok(horste && horste.count > 0);
const frei = querschnittFreihaltung(punkte, profil, 5).enthaelt;
const stand = new Matrix4();
for (let i = 0; i < horste.count; i++) {
  horste.getMatrixAt(i, stand);
  assert.ok(!frei(stand.elements[12], stand.elements[14]), 'Die Horste wurzeln außerhalb der befestigten Flächen');
}
bepflanzt.entsorge();
console.log(`✓ Abmessungen identisch und ${horste.count} Horste im freigegebenen Saum`);

const variante: WohnwegQuerschnitt = {
  ...profil,
  verwitterung,
  zufahrten: [...profil.zufahrten, { von: 30, bis: 34, seite: -1, tiefe: 6,
    schotterspuren: { spurabstand: 1.54, saumdichte: .86 } }],
};
const alteZufahrten = baueStrassenquerschnitt(punkte, () => 0, variante, 5, verwitterung);
const neueZufahrten = baueStrassenquerschnitt(punkte, () => 0, variante, 5, verwitterung, true);
assert.deepEqual(neueZufahrten.index?.array, alteZufahrten.index?.array);
const spur = neueZufahrten.getAttribute('schotterspur');
const spurPosition = neueZufahrten.getAttribute('position');
assert.deepEqual(spurPosition.array, alteZufahrten.getAttribute('position').array);
let spurEcken = 0;
for (let i = 0; i < spur.count; i++) {
  if (!spur.getZ(i)) continue;
  const s = spurPosition.getX(i);
  assert.ok(s >= 30 && s <= 34 && Math.abs(spur.getX(i) - (s - 32)) < 1e-5);
  assert.ok(Math.abs(spur.getZ(i) - .77) < 1e-5);
  assert.ok(spurPosition.getZ(i) <= kanten(s)[0] - 1.65 + 1e-5, 'Die Spur beginnt hinter dem Gehweg');
  spurEcken++;
}
assert.ok(spurEcken > 0);
alteZufahrten.dispose();
neueZufahrten.dispose();

const randAlt = baueStrassenbewuchs([{ ...weg, vermessenerSaum: variante }], () => 0);
const randNeu = baueStrassenbewuchs([{ ...weg, vermessenerSaum: variante, schotterspuren: true }], () => 0);
const belegt = querschnittFreihaltung(punkte, variante, 5).enthaelt;
assert.ok(randNeu.gruppe.userData.strassenbewuchs.zufahrtshorste > 0);
assert.ok(randNeu.gruppe.userData.strassenbewuchs.auflageDreiecke > randAlt.gruppe.userData.strassenbewuchs.auflageDreiecke);
for (const objekt of randNeu.gruppe.children) if (objekt instanceof InstancedMesh) {
  for (let i = 0; i < objekt.count; i++) {
    objekt.getMatrixAt(i, stand);
    assert.ok(!belegt(stand.elements[12], stand.elements[14]), 'Flankenbewuchs und Steine halten die Zufahrt frei');
  }
}
randAlt.entsorge();
randNeu.entsorge();
console.log('✓ Schotterspuren beginnen hinter dem Gehweg, Erdanschluss und Flanken liegen an der zweiten Einfahrt');

// Winklige Oberfläche auf dem 2-m-Raster. Der Belag darf Kanten und Nebendiagonalen nicht abschneiden.
const grund = (s: number, q: number) => .21 * Math.abs(s - 24) + .19 * Math.abs(q + 4);
const bodennetz = baueStrassenquerschnitt(punkte, grund, variante, 5, verwitterung, true, { ursprung: [0, 0], schritt: 2 });
const material = new MeshBasicMaterial();
const gezeichnet = new Mesh(bodennetz, material);
const strahl = new Raycaster();
const unten = new Vector3(0, -1, 0);
const ueberGrund = (s: number, q: number) => {
  strahl.set(new Vector3(s, grund(s, q) + 3, q), unten);
  const treffer = strahl.intersectObject(gezeichnet)[0];
  assert.ok(treffer, 'Der Rasterzuschnitt lässt keinen fehlenden Belag zurück');
  return treffer.point.y - grund(s, q);
};
for (const s of [15.1, 21.67, 23.97, 24.04, 26.3, 34.83]) {
  const [links, rechts] = kanten(s);
  for (let q = links + .1; q < rechts; q += .27) {
    assert.ok(Math.abs(ueberGrund(s, q) - .018) < .00001, 'Die neue Fahrbahn bleibt auf der nahen Geländeoberfläche');
  }
}
const [links] = kanten(32);
assert.ok(Math.abs(ueberGrund(32, links - 1.6) - .043) < .00001);
assert.ok(Math.abs(ueberGrund(32, links - 5.98) - .009) < .0002);
bodennetz.dispose();
material.dispose();

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const region = Region.parse(JSON.parse(readFileSync('content/regions/oental.json', 'utf8')));
const raster = region.nahhoehen!;
const a = baueHoehenfeld(welt), b = baueHoehenfeld(welt, undefined, undefined, raster);
assert.equal(b.hoehe(1000, 1000), a.hoehe(1000, 1000), 'D340 erfasst nur den Straßenraum');
const [x, z] = raster.ursprung;
assert.equal(b.hoehe(x, z + 30), a.hoehe(x, z + 30), 'Die alte Höhe liegt exakt an der Auslaufkante an');
const probe = Buffer.from(raster.zeilen[34], 'base64').readInt16LE(2 * 31) * .01;
const datum = (raster.datum - welt.hoeheMin) * MASSSTAB.ueberhoehung;
assert.ok(Math.abs(b.hoehe(x + 31, z + 34) - datum - probe) < 1e-8, 'DGM1-Relief wird im Kern 1:1 übernommen');
console.log('✓ DGM1-Auslauf und geländegleicher Fahrbahnkontakt geprüft');
