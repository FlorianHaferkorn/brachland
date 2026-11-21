/** D366: Bodenpflanzen — deterministisch, nur Waldböden, Licht steuert die Art, Moos auf Buckeln, echte Grösse. */
import assert from 'node:assert/strict';
import { Vector3, Quaternion } from 'three';
import { bodenMatrizen, BUSCH, FLACH, KACHELN } from '../src/world/bodenpflanzen.js';
import { baumRaster } from '../src/world/streukarten.js';
import type { Biom } from '../src/world/osm.js';
import massstab from '../content/massstab.json';

const eben = () => 0;
// Buchen in einer Reihe (Kronen 4,5 m) bei z = 0, rechts davon offene Lücke.
const buchen = baumRaster(Array.from({ length: 8 }, (_, i) => ({ x: -40 + i * 7, z: 0, nadel: false, krone: 4.5 })));
const zahl = (m: { flach: unknown[][]; busch: unknown[][] }) => [...m.flach, ...m.busch].reduce((n, l) => n + l.length, 0);

const wald = bodenMatrizen(0, 0, 40, eben, () => 'wald', buchen);
for (const biom of ['wiese', 'wasser', 'siedlung', 'acker'] as Biom[])
  assert.equal(zahl(bodenMatrizen(0, 0, 40, eben, () => biom, buchen)), 0, `Bodenpflanzen auf ${biom}`);
assert.ok(zahl(wald) > 600, `Wald zu kahl (${zahl(wald)})`);
const b = bodenMatrizen(0, 0, 40, eben, () => 'wald', buchen);
assert.deepEqual([...wald.flach, ...wald.busch].map(l => l.map(m => m.elements.join())),
  [...b.flach, ...b.busch].map(l => l.map(m => m.elements.join())), 'nicht deterministisch');

// Licht: Sauerklee und Waldmeister im Schatten unter der Krone, Brombeere im Licht der Lücke (z > 15).
const p = new Vector3(), q = new Quaternion(), s = new Vector3();
const zaehleIn = (liste: { elements: number[] }[], bereich: (x: number, z: number) => boolean) =>
  liste.filter(m => bereich(m.elements[12], m.elements[14])).length;
const schatten = (x: number, z: number) => Math.abs(z) < 3 && x > -40 && x < 9;
const licht = (x: number, z: number) => z > 18;
const schattenFlaeche = 6 * 49, lichtFlaeche = 2 * 18 * 40;   // grob, nur für das Verhältnis
const klee = [zaehleIn(wald.flach[FLACH.sauerklee], schatten) / schattenFlaeche, zaehleIn(wald.flach[FLACH.sauerklee], licht) / lichtFlaeche];
const brom = [zaehleIn(wald.busch[BUSCH.brombeere], schatten) / schattenFlaeche, zaehleIn(wald.busch[BUSCH.brombeere], licht) / lichtFlaeche];
assert.ok(klee[0] > 2 * klee[1], `Sauerklee nicht im Schatten (${klee.map(v => v.toFixed(3))})`);
assert.ok(brom[1] > 2 * brom[0], `Brombeere nicht im Licht (${brom.map(v => v.toFixed(3))})`);

// Moos auf Erhebungen: auf Kuppen weit häufiger als in Mulden.
const buckel = (x: number, z: number) => 0.25 * Math.sin(x * 1.3) * Math.sin(z * 1.3);
const mitBuckel = bodenMatrizen(0, 0, 40, buckel, () => 'wald', buchen);
const aufKuppe = mitBuckel.flach[FLACH.moos].filter(m => buckel(m.elements[12], m.elements[14]) > 0.05).length;
const inMulde = mitBuckel.flach[FLACH.moos].filter(m => buckel(m.elements[12], m.elements[14]) < -0.05).length;
assert.ok(aufKuppe > 3 * inMulde, `Moos nicht auf den Buckeln (${aufKuppe} gegen ${inMulde} in Mulden)`);

// Lage und Grösse: liegende Felder 1,5 cm über der Streu, stehende Büschel senkrecht mit echter Höhe.
for (const m of wald.flach.flat()) {
  m.decompose(p, q, s);
  assert.ok(Math.abs(p.y - 0.03) < 1e-6, 'Feld nicht über der Streu');
  assert.ok(s.x >= 0.85 - 1e-6 && s.x <= 1.15 + 1e-6, 'Feldgrösse ausserhalb 0,85–1,15 m');
}
const ref = Object.fromEntries(massstab.referenzen.map(r => [r.id, r]));
wald.busch.forEach((liste, kachel) => {
  const info = KACHELN.bodenbusch[kachel], r = ref[info.name];
  for (const m of liste) {
    m.decompose(p, q, s);
    assert.ok(new Vector3(0, 1, 0).applyQuaternion(q).y > 0.999, 'Büschel nicht senkrecht');
    const hoehe = info.hoehe * s.y / info.kante;
    // Gebackene Höhe × Instanzskalierung: höchstens 25 % über der Spanne (wie das Maßstab-Tor).
    assert.ok(hoehe <= r.max * 1.25, `${info.name} ${hoehe.toFixed(2)} m zu gross`);
  }
});
// Polster statt Streuung (Stilreferenz Flo): in 4-m-Feldern unter Kronen schwankt die Dichte stark, mit dichten Kernen.
const felder = new Map<string, number>();
for (const m of [...wald.flach, ...wald.busch].flat()) {
  const k = `${Math.floor(m.elements[12] / 4)}:${Math.floor(m.elements[14] / 4)}`;
  if (Math.abs(m.elements[14]) < 4) felder.set(k, (felder.get(k) ?? 0) + 1);
}
const werte = [...felder.values()], mittel = werte.reduce((a, c) => a + c, 0) / werte.length;
const vk = Math.sqrt(werte.reduce((a, c) => a + (c - mittel) ** 2, 0) / werte.length) / mittel;
assert.ok(vk > 0.4, `Unterwuchs zu gleichmässig verstreut (VK ${vk.toFixed(2)})`);
assert.ok(Math.max(...werte) >= 30, `kein dichtes Polster (höchstens ${Math.max(...werte)} Karten auf 16 m²)`);
console.log(`bodenpflanzen: Polster VK ${vk.toFixed(2)}, dichtestes ${Math.max(...werte)} Karten/16 m²; Wald ${zahl(wald)} Karten im 40-m-Kreis; Sauerklee Schatten/Licht ${klee.map(v => v.toFixed(3)).join('/')} je m², `
  + `Brombeere ${brom.map(v => v.toFixed(3)).join('/')} je m², Moos Kuppe/Mulde ${aufKuppe}/${inMulde}`);
