/** D361: Bodenstreu — deterministisch, Dichte nach Biom, Wasser frei, Karten liegen auf dem Gelände. */
import assert from 'node:assert/strict';
import { streuMatrizen } from '../src/world/streukarten.js';
import type { Biom } from '../src/world/osm.js';
import { Vector3, Quaternion } from 'three';

const hoehe = (x: number, z: number) => 0.2 * x + 0.05 * z;
const zaehle = (biom: Biom) => streuMatrizen(0, 0, 30, hoehe, () => biom).reduce((n, l) => n + l.length, 0);
const wald = zaehle('wald'), wiese = zaehle('wiese'), wasser = zaehle('wasser');
assert.ok(wald > 700, `Wald zu dünn (${wald})`);
assert.ok(wiese < wald / 5, `Wiese zu dicht (${wiese} gegen ${wald})`);
assert.equal(wasser, 0, 'Streu im Wasser');
const a = streuMatrizen(5, 7, 20, hoehe, () => 'wald'), b = streuMatrizen(5, 7, 20, hoehe, () => 'wald');
assert.deepEqual(a.map(l => l.map(m => m.elements.join())), b.map(l => l.map(m => m.elements.join())), 'nicht deterministisch');
// Lage: auf dem Gelände (1,5 cm darüber) und nach der Neigung gekippt.
const p = new Vector3(), q = new Quaternion(), s = new Vector3();
for (const m of a.flat()) {
  m.decompose(p, q, s);
  assert.ok(Math.abs(p.y - hoehe(p.x, p.z) - 0.015) < 1e-6, 'nicht auf dem Gelände');
  const n = new Vector3(0, 0, 1).applyQuaternion(q);
  const soll = new Vector3(-0.2, 1, -0.05).normalize();
  assert.ok(n.dot(soll) > 0.999, 'nicht nach der Neigung gekippt');
  assert.ok(s.x >= 0.72 - 1e-6 && s.x <= 1.37 + 1e-6 && s.y >= 0.67 - 1e-6 && s.y <= 1.16 + 1e-6, 'Kartengrösse ausserhalb der Streckung');
}
// Häufung: in 5-m-Feldern streut die Dichte deutlich (Inseln und Lücken), statt gleichmässig zu tupfen.
const felder = new Map<string, number>();
for (const m of streuMatrizen(0, 0, 60, hoehe, () => 'wald').flat()) {
  m.decompose(p, q, s); const k = `${Math.floor(p.x / 5)}:${Math.floor(p.z / 5)}`; felder.set(k, (felder.get(k) ?? 0) + 1);
}
const werte = [...felder.values()], mittel = werte.reduce((a, b) => a + b, 0) / werte.length;
const vk = Math.sqrt(werte.reduce((a, b) => a + (b - mittel) ** 2, 0) / werte.length) / mittel;
assert.ok(vk > 0.45, `zu gleichmässig verteilt (Variationskoeffizient ${vk.toFixed(2)})`);
console.log(`streukarten: Häufung VK ${vk.toFixed(2)}, Wald ${wald}, Wiese ${wiese}, Wasser ${wasser} Karten im 30-m-Kreis`);
