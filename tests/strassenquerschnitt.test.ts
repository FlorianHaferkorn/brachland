/** D337: Der Fahrbahnanschluss und die Absenkung müssen auf denselben Stationen liegen wie die Freihaltung. */
import assert from 'node:assert/strict';
import type { WohnwegQuerschnitt } from '../src/data/schema.js';
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
netz.dispose();

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
