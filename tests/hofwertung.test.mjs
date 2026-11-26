import assert from 'node:assert/strict';
import { hofBefund } from '../tools/mess/hofwertung.mjs';

const schnell = { fps: 51.8, p95: 33.3, max: 49.9, spitzen: [] };
const langsam = { fps: 51.1, p95: 33.4, max: 98.5, spitzen: [81, 98.5] };
assert.deepEqual(hofBefund([langsam, schnell]), []);
for (const fehler of [{ p95: 36 }, { fps: 40 }, { max: 100 }, { spitzen: [51, 52, 53] }, { fps: NaN }]) {
  assert.equal(hofBefund([{ ...langsam, ...fehler }, schnell]).length, 1);
}
assert.ok(hofBefund([schnell]).length);
console.log('Hofwertung: Referenz und sechs Fehlerfälle geprüft.');
