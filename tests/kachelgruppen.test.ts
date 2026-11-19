import assert from 'node:assert/strict';
import { BoxGeometry, BufferAttribute } from 'three';
import { aktualisiereKachelpuffer, bereiteKachelpuffer, sammleKachel } from '../src/world/kachelgruppen.js';
import type { Kachelpuffer, Kachelsammlung } from '../src/world/kachelgruppen.js';

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

function pruefeTeilkopien(sammlung: Kachelsammlung, breiterIndex: boolean): void {
  const referenz = aktualisiereKachelpuffer(new Map(), sammlung);
  const bau = bereiteKachelpuffer(new Map(), sammlung, undefined, true);
  let schritte = 0;
  let schritt = bau.next();
  while (!schritt.done) {
    schritte++;
    schritt = bau.next();
  }
  const ergebnis: Kachelpuffer = schritt.value;
  assert.ok(schritte > referenz.size, 'Die Kopien müssen sich unterbrechen lassen.');
  for (const [id, { geometrie: erwartet }] of referenz) {
    const erhalten = ergebnis.get(id)?.geometrie;
    assert.ok(erhalten);
    assert.deepEqual(erhalten.index?.array, erwartet.index?.array);
    assert.equal(erhalten.index?.array instanceof Uint32Array, breiterIndex);
    for (const name of Object.keys(erwartet.attributes)) {
      assert.deepEqual(erhalten.getAttribute(name).array, erwartet.getAttribute(name).array);
    }
    erwartet.computeBoundingSphere();
    assert.deepEqual(erhalten.boundingSphere, erwartet.boundingSphere);
  }
}

pruefeTeilkopien(vor, false);
const breit = new Map();
const vieleEcken = new BoxGeometry();
vieleEcken.setAttribute('position', new BufferAttribute(new Float32Array(65535 * 3), 3));
vieleEcken.setAttribute('normal', new BufferAttribute(new Float32Array(65535 * 3), 3));
vieleEcken.setAttribute('uv', new BufferAttribute(new Float32Array(65535 * 2), 2));
sammleKachel(breit, kachel(0), vieleEcken, 'boden');
sammleKachel(breit, kachel(1), b, 'boden');
pruefeTeilkopien(breit, true);
console.log('Kachelgruppen: Teilkopien erhalten Indizes, Attribute und Hüllkugel bitgleich.');
