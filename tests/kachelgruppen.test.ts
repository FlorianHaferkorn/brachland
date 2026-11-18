import assert from 'node:assert/strict';
import { BoxGeometry } from 'three';
import { aktualisiereKachelpuffer, sammleKachel } from '../src/world/kachelgruppen.js';
import type { Kachelsammlung } from '../src/world/kachelgruppen.js';

const a = new BoxGeometry();
const b = new BoxGeometry();
const c = new BoxGeometry();
const kachel = (ix: number) => ({ ix, iz: 0, mitte: [0, 0] as [number, number], radius: 1 });

const vor: Kachelsammlung = new Map();
sammleKachel(vor, kachel(0), a, 'haus');
sammleKachel(vor, kachel(1), b, 'haus');
sammleKachel(vor, kachel(4), c, 'haus');
const puffer = aktualisiereKachelpuffer(new Map(), vor);
const umgedreht: Kachelsammlung = new Map();
sammleKachel(umgedreht, kachel(4), c, 'haus');
sammleKachel(umgedreht, kachel(1), b, 'haus');
sammleKachel(umgedreht, kachel(0), a, 'haus');
const wieder = aktualisiereKachelpuffer(puffer, umgedreht);
assert.equal(wieder.get('haus:0:0')?.geometrie, puffer.get('haus:0:0')?.geometrie);
assert.equal(wieder.get('haus:1:0')?.geometrie, puffer.get('haus:1:0')?.geometrie);

const nach: Kachelsammlung = new Map();
sammleKachel(nach, kachel(1), b, 'haus');
sammleKachel(nach, kachel(4), c, 'haus');
const neu = aktualisiereKachelpuffer(wieder, nach);
assert.notEqual(neu.get('haus:0:0')?.geometrie, puffer.get('haus:0:0')?.geometrie);
assert.equal(neu.get('haus:0:0')?.geometrie.index?.count, b.index?.count);
assert.equal(neu.get('haus:1:0')?.geometrie, puffer.get('haus:1:0')?.geometrie);
assert.equal(aktualisiereKachelpuffer(neu, new Map()).size, 0);
console.log('Kachelgruppen: unveränderte Puffer bleiben, geänderte und entfallene Gruppen werden erkannt.');
