/** Sträucher bleiben deterministisch, bodenständig und in der vorgesehenen Metergrösse. */
import assert from 'node:assert/strict';
import { baueHofStrauch, landschaftsStrauchGeometrie } from '../src/world/hofstrauch.js';
let anzahl = 0;
for (const [variante, hoehe] of [0.9, 1.2, 1.5, 1.8, 2.1, 2.4].entries()) {
  const g = baueHofStrauch(variante, hoehe), p = g.getAttribute('position');
  assert.ok(Math.abs(g.boundingBox!.min.y) < 1e-6); anzahl++;
  assert.ok(Math.abs(g.boundingBox!.max.y - hoehe) < 1e-5); anzahl++;
  assert.ok(g.boundingBox!.max.x - g.boundingBox!.min.x > hoehe * 0.7); anzahl++;
  assert.ok(p.count / 3 <= 1500); anzahl++;
  for (const a of ['normal', 'color', 'uv', 'blatt', 'aWind']) {
    const attribut = g.getAttribute(a);
    assert.equal(attribut.count, p.count); assert.ok([...attribut.array].every(Number.isFinite));
  }
  anzahl++;
  assert.ok([...g.getAttribute('uv').array].every(v => v >= 0 && v <= 1)); anzahl++;
  const blatt = g.getAttribute('blatt');
  assert.ok([...blatt.array].some(v => v === 0) && [...blatt.array].some(v => v === 1)); anzahl++;
  const wind = g.getAttribute('aWind');
  assert.ok([...wind.array].some(v => v > 0.35));
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 1e-6) assert.ok(wind.getX(i) < 1e-5);
  anzahl++;
  const gleich = baueHofStrauch(variante, hoehe);
  assert.deepEqual([...gleich.getAttribute('position').array], [...p.array]); anzahl++;
  assert.deepEqual([...gleich.getAttribute('uv').array], [...g.getAttribute('uv').array]); anzahl++;
  gleich.dispose(); g.dispose();
}
const landschaft = landschaftsStrauchGeometrie();
assert.equal(landschaft, landschaftsStrauchGeometrie()); anzahl++;
const position = landschaft.getAttribute('position'), blatt = landschaft.getAttribute('blatt');
assert.ok(position.count / 3 <= 90); anzahl++;
assert.ok(Math.abs(landschaft.boundingBox!.min.y) < 1e-6 && Math.abs(landschaft.boundingBox!.max.y - 1) < 1e-6); anzahl++;
assert.ok([...blatt.array].includes(0) && [...blatt.array].includes(1)); anzahl++;
const uv = landschaft.getAttribute('uv'), wind = landschaft.getAttribute('aWind');
for (let i = 0; i < position.count; i++) {
  if (position.getY(i) < 1e-5) assert.ok(wind.getX(i) < 1e-5);
  if (blatt.getX(i) > 0) assert.ok(uv.getX(i) > 0 && uv.getX(i) < 1 && uv.getY(i) > 0 && uv.getY(i) < 1);
}
anzahl++;
assert.throws(() => baueHofStrauch(0, 0)); anzahl++;
assert.throws(() => baueHofStrauch(0, NaN)); anzahl++;
console.log(`${anzahl} Hofstrauchprüfungen bestanden.`);
