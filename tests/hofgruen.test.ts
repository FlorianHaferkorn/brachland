/** Lokale Baumwahl bleibt vollständig, überschneidungsfrei und an den Gebäudestand gebunden. */
import assert from 'node:assert/strict';
import type { PropInstanz } from '../src/world/props.js';
Object.defineProperty(globalThis, 'location', { value: { search: '?hofgruen=1' }, configurable: true });
const { HOF_UNIFORM } = await import('../src/world/hofplatz.js');
const { teileHofBaeume, istHofBusch, HOF_BAUM_RADIUS } = await import('../src/world/hofgruenwahl.js');
const { waehleProps } = await import('../src/scenes/propauswahl.js');

const mitte: [number, number] = [1432.666, 433.662];
const prop = (art: PropInstanz['art'], x: number, z: number, variante: number): PropInstanz => ({
  art, position: [mitte[0] + x, 35 + variante, mitte[1] + z], variante,
  drehung: variante * 0.137, skalierung: 0.75 + variante * 0.05,
});
const eingabe = [
  prop('grasbuschel', 0, 0, 0), prop('nadelbaum', 0, 0, 1), prop('laubbaum', 0, HOF_BAUM_RADIUS, 2),
  prop('busch', 5, 5, 3), prop('nadelbaum', HOF_BAUM_RADIUS + 0.001, 0, 4),
  prop('laubbaum', -HOF_BAUM_RADIUS, 0, 5), prop('findling', 1, 1, 0),
];
const vorher = JSON.stringify(eingabe);
const auswahl = teileHofBaeume(eingabe, mitte);
let anzahl = 0;
assert.equal(auswahl.lokaleBaeume.length, 3); anzahl++;
assert.equal(auswahl.rest.length, 4); anzahl++;
assert.equal(new Set([...auswahl.lokaleBaeume, ...auswahl.rest]).size, eingabe.length); anzahl++;
assert.ok(eingabe.every(p => auswahl.lokaleBaeume.includes(p) !== auswahl.rest.includes(p))); anzahl++;
assert.deepEqual(auswahl.lokaleBaeume, [eingabe[1], eingabe[2], eingabe[5]]); anzahl++;
assert.deepEqual(auswahl.rest, [eingabe[0], eingabe[3], eingabe[4], eingabe[6]]); anzahl++;
assert.ok(auswahl.lokaleBaeume.every(p => p === eingabe[eingabe.indexOf(p)])); anzahl++;
assert.equal(JSON.stringify(eingabe), vorher); anzahl++;
assert.deepEqual(teileHofBaeume(eingabe, mitte), auswahl); anzahl++;
assert.deepEqual(teileHofBaeume(eingabe, null).rest, eingabe); anzahl++;
assert.deepEqual(teileHofBaeume(eingabe, mitte, -1).rest, eingabe); anzahl++;
assert.deepEqual(teileHofBaeume(eingabe, [NaN, 0]).rest, eingabe); anzahl++;
assert.deepEqual(teileHofBaeume([], mitte), { lokaleBaeume: [], rest: [] }); anzahl++;
assert.deepEqual(teileHofBaeume(eingabe, mitte, 0).lokaleBaeume, [eingabe[1]]); anzahl++;

const alteMitte = HOF_UNIFORM.mitte.value.clone(), altBereit = HOF_UNIFORM.bereit.value;
try {
  HOF_UNIFORM.mitte.value.set(...mitte); HOF_UNIFORM.bereit.value = 1;
  assert.equal(istHofBusch(mitte), true); anzahl++;
  assert.equal(istHofBusch([mitte[0] + 100, mitte[1]]), true); anzahl++;
  assert.equal(istHofBusch([mitte[0] + 100.01, mitte[1]]), false); anzahl++;
  assert.equal(istHofBusch([mitte[0] + 140, mitte[1]], 40), true); anzahl++;
  assert.equal(istHofBusch([mitte[0] + 140.01, mitte[1]], 40), false); anzahl++;
  assert.equal(istHofBusch(mitte, -1), false); anzahl++;
  HOF_UNIFORM.bereit.value = 0;
  assert.equal(istHofBusch(mitte), false); anzahl++;
} finally { HOF_UNIFORM.mitte.value.copy(alteMitte); HOF_UNIFORM.bereit.value = altBereit; }
const alteWahl = HOF_UNIFORM.mitte.value.clone(), alteBereitschaft = HOF_UNIFORM.bereit.value;
try {
  HOF_UNIFORM.mitte.value.set(0, 0); HOF_UNIFORM.bereit.value = 1;
  const chunks = [0, 5].map(variante => ({ art: 'busch' as const, variante, mitte: [0, 0] as [number, number],
    radius: 52.5, sichtweite: 180, instanzen: [{ art: 'busch' as const, variante,
      position: [variante, 0, 0] as [number, number, number], drehung: 0, skalierung: 1 }] }));
  const innen = waehleProps(chunks, [80, 0], [80, 0], true);
  assert.equal(innen.nah.length, 2); anzahl++;
  assert.deepEqual(innen.nah.map(e => e.c.variante), [0, 5]); anzahl++;
  assert.ok(innen.nah.every(e => e.stufe === 'mittel')); anzahl++;
  HOF_UNIFORM.mitte.value.set(10000, 10000);
  const aussen = waehleProps(chunks, [80, 0], [80, 0], true);
  assert.equal(aussen.nah.length, 1); anzahl++;
  assert.equal(aussen.nah[0].c.instanzen.length, 2); anzahl++;
} finally { HOF_UNIFORM.mitte.value.copy(alteWahl); HOF_UNIFORM.bereit.value = alteBereitschaft; }
console.log(`${anzahl} Hofgrünprüfungen bestanden.`);
