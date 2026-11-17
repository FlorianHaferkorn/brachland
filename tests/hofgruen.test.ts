/** Lokale Baumwahl bleibt vollständig, überschneidungsfrei und an den Gebäudestand gebunden. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import type { PropChunk, PropInstanz } from '../src/world/props.js';
Object.defineProperty(globalThis, 'location', { value: { search: '?hofgruen=1' }, configurable: true });
const { HOF_UNIFORM } = await import('../src/world/hofplatz.js');
const { teileHofBaeume, istHofBusch, HOF_BAUM_RADIUS } = await import('../src/world/hofgruenwahl.js');
const { waehleProps, buendleFernProps } = await import('../src/scenes/propauswahl.js');

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

// Fernbündel dürfen lokale Varianten und ihren Schattenempfang nicht zur Außenattrappe machen.
const fernMitte = HOF_UNIFORM.mitte.value.clone(), fernBereit = HOF_UNIFORM.bereit.value;
try {
  HOF_UNIFORM.mitte.value.set(0, 0); HOF_UNIFORM.bereit.value = 1;
  const chunk = (variante: number, x: number): PropChunk => ({
    art: 'busch', variante, mitte: [x, 0], radius: 52.5, sichtweite: 180,
    instanzen: [{ art: 'busch', variante, position: [x + 1, 2, 3], drehung: variante * 0.1, skalierung: 0.8 }],
  });
  const sechs = Array.from({ length: 6 }, (_, v) => chunk(v, 10));
  const rand = chunk(0, 60), grob = chunk(0, 140), aussen = chunk(5, 400);
  const quelle = [...sechs, rand, grob, aussen], stand = JSON.stringify(quelle);
  const gruppen = buendleFernProps(new Map([['busch', quelle]]));
  const lokale = gruppen.filter(g => g.hofStrauch);
  assert.equal(gruppen.length, 8, 'Lokale Varianten/Schattenklasse und Außenattrappe getrennt'); anzahl++;
  assert.deepEqual(lokale.filter(g => g.hofSchatten).map(g => g.variante), [0, 1, 2, 3, 4, 5]); anzahl++;
  for (const [i, c] of sechs.entries()) {
    const g = lokale.find(g => g.variante === i && g.hofSchatten);
    assert.equal(g!.instanzen[0], c.instanzen[0], 'Instanzreferenz mit Transformation bleibt erhalten'); anzahl++;
  }
  const ohneSchatten = lokale.find(g => g.variante === 0 && !g.hofSchatten)!;
  assert.deepEqual(ohneSchatten.instanzen, [rand.instanzen[0], grob.instanzen[0]]); anzahl++;
  assert.equal(ohneSchatten.instanzen[1], grob.instanzen[0], 'Hofauswahl bleibt chunkweise wie Nahstufe'); anzahl++;
  const generisch = gruppen.filter(g => !g.hofStrauch);
  assert.equal(generisch.length, 1); anzahl++;
  assert.equal(generisch[0].variante, 0); anzahl++;
  assert.equal(generisch[0].hofSchatten, undefined); anzahl++;
  assert.equal(generisch[0].instanzen[0], aussen.instanzen[0]); anzahl++;
  assert.equal(JSON.stringify(quelle), stand, 'Bündelung verändert weder Quellen noch Transformationswerte'); anzahl++;
  const alle = gruppen.flatMap(g => g.instanzen);
  assert.equal(alle.length, quelle.length); anzahl++;
  assert.equal(new Set(alle).size, quelle.length, 'Jede Quelle bleibt genau einmal enthalten'); anzahl++;
  HOF_UNIFORM.bereit.value = 0;
  assert.ok(buendleFernProps(new Map([['busch', quelle]])).every(g => !g.hofStrauch && g.variante === 0)); anzahl++;
} finally { HOF_UNIFORM.mitte.value.copy(fernMitte); HOF_UNIFORM.bereit.value = fernBereit; }

// Ein frischer Modulgraph liest den echten Rückfallschalter, statt den Flagwert im Test zu ersetzen.
const rueckfall = `
  import assert from 'node:assert/strict';
  Object.defineProperty(globalThis, 'location', { value: { search: '?hofgruen=1&strauchweit=0' } });
  const { HOF_UNIFORM } = await import(${JSON.stringify(new URL('../src/world/hofplatz.ts', import.meta.url).href)});
  const { buendleFernProps } = await import(${JSON.stringify(new URL('../src/scenes/propauswahl.ts', import.meta.url).href)});
  HOF_UNIFORM.mitte.value.set(0, 0); HOF_UNIFORM.bereit.value = 1;
  const ps = [0, 5].map(variante => ({ art: 'busch', variante, position: [variante, 1, 0], drehung: 0, skalierung: 1 }));
  const chunks = ps.map(p => ({ art: 'busch', variante: p.variante, mitte: [0, 0], radius: 52.5, sichtweite: 180, instanzen: [p] }));
  const g = buendleFernProps(new Map([['busch', chunks]]));
  assert.equal(g.length, 1); assert.equal(g[0].variante, 0);
  assert.equal(g[0].hofStrauch, undefined); assert.equal(g[0].hofSchatten, undefined);
  assert.equal(g[0].instanzen[0], ps[0]); assert.equal(g[0].instanzen[1], ps[1]);
`;
execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', rueckfall]); anzahl++;
console.log(`${anzahl} Hofgrünprüfungen bestanden.`);
