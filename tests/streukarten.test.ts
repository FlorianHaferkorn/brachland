/** D361/D366: Bodenstreu — deterministisch, Dichte nach Biom, Wasser frei, auf dem Gelände; unter der Krone geschlossen. */
import assert from 'node:assert/strict';
import { baumRaster, KRONE_UEBERGANG, kronenDeckung, naechsteKrone, streuMatrizen } from '../src/world/streukarten.js';
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
// D362/D366: Bäume — unter der Krone eine geschlossene Decke ihrer Art, scharfer Rand, auf der Wiese draussen nichts.
const KRONE = 4.5;
const raster = baumRaster([{ x: 0, z: 0, nadel: true, krone: KRONE }, { x: 30, z: 0, nadel: false, krone: KRONE }]);
const deckungUnterKrone = (biom: Biom) => {
  const karten = streuMatrizen(0, 0, 45, hoehe, () => biom, raster).map(l => l.map(m => {
    m.decompose(p, q, s); return [p.x, p.z, 0.36 * Math.min(s.x, s.y)] as const;
  }));
  // Gedeckt heisst: ein Punkt liegt im dichten Kern (36 % der Kantenlänge) einer Karte.
  let gedeckt = 0, proben = 0;
  for (let i = 0; i < 400; i++) {
    const w = i * 2.399, r = KRONE * 0.85 * Math.sqrt((i + 0.5) / 400);
    const x = 30 + r * Math.cos(w), z = r * Math.sin(w);
    proben++;
    if (karten.flat().some(([kx, kz, kr]) => (kx - x) ** 2 + (kz - z) ** 2 < kr * kr)) gedeckt++;
  }
  return { karten, anteil: gedeckt / proben };
};
const wald45 = deckungUnterKrone('wald'), wiese45 = deckungUnterKrone('wiese');
assert.ok(wald45.anteil > 0.9, `Laubdecke unter der Krone nicht geschlossen (${(wald45.anteil * 100).toFixed(0)} %)`);
assert.ok(wiese45.anteil > 0.9, `auf der Wiese unter der Krone nicht geschlossen (${(wiese45.anteil * 100).toFixed(0)} %)`);
// Art folgt dem Baum: unter der Buche Laub, unter der Fichte Nadeln (Zweige höchstens ein Zehntel).
let laub = 0, nadel = 0, anderes = 0, nadelFichte = 0, fichte = 0;
wald45.karten.forEach((liste, art) => liste.forEach(([x, z]) => {
  if (Math.hypot(x - 30, z) < KRONE - 1) { if (art === 0) laub++; else if (art === 1) nadel++; else anderes++; }
  if (Math.hypot(x, z) < KRONE - 1) { fichte++; if (art === 1) nadelFichte++; }
}));
assert.ok(laub > 0.85 * (laub + nadel + anderes), `unter der Buche nicht Laub (${laub}/${laub + nadel + anderes})`);
assert.ok(nadelFichte > 0.85 * fichte, `unter der Fichte nicht Nadeln (${nadelFichte}/${fichte})`);
// Scharfer Rand: auf der Wiese liegt jenseits von Krone + 1 m keine Karte mehr (Übergang 1,5 m).
const draussen = wiese45.karten.flat().filter(([x, z]) => Math.min(Math.hypot(x, z), Math.hypot(x - 30, z)) > KRONE + 1);
assert.equal(draussen.length, 0, `${draussen.length} Karten auf der Wiese ausserhalb der Kronen`);
// Im Wald bleibt zwischen den Kronen Streu in Inseln, aber deutlich dünner als die Decke.
const dichte = (r0: number, r1: number) => wald45.karten.flat().filter(([x, z]) => {
  const d = Math.min(Math.hypot(x, z), Math.hypot(x - 30, z)); return d >= r0 && d < r1;
}).length;
const unter = dichte(0, KRONE - 1) / (2 * Math.PI * (KRONE - 1) ** 2);
const zwischen = dichte(KRONE + 2, 45) / (Math.PI * 45 * 45 - 2 * Math.PI * (KRONE + 2) ** 2);
assert.ok(unter > 3 * zwischen, `Decke nicht dichter als die Inseln (${unter.toFixed(2)} gegen ${zwischen.toFixed(2)} je m²)`);
assert.ok(kronenDeckung(-1) === 1 && kronenDeckung(1) === 0 && kronenDeckung(0) > 0.3 && kronenDeckung(0) < 0.7, 'Übergang am Kronenrand');
console.log(`streukarten: Deckung unter der Krone Wald ${(wald45.anteil * 100).toFixed(0)} %, Wiese ${(wiese45.anteil * 100).toFixed(0)} %; `
  + `Decke ${unter.toFixed(2)}/m² gegen Inseln ${zwischen.toFixed(2)}/m²; Häufung VK ${vk.toFixed(2)}; Wald ${wald}, Wiese ${wiese}, Wasser ${wasser} (ohne Bäume, 30-m-Kreis)`);

// Das wandernde Suchfenster muss auch am Kreisrand und nach einem Sprung
// dieselben Karten in derselben Reihenfolge ergeben wie die volle Aussaat.
const cache = {};
for (const [x, z] of [[0, 0], [15.2, -.7], [-.3, 1], [440, -200], [0, 0]]) {
  const normal = streuMatrizen(x, z, 18, hoehe, () => 'wald', raster);
  assert.deepEqual(streuMatrizen(x, z, 18, hoehe, () => 'wald', raster, cache), normal);
}

// Randzellen und unmittelbar benachbarte, gleich weit entfernte Bäume:
// Die Reihenfolge der alten 3 × 3-Suche entscheidet über Laub oder Nadeln.
const baumliste = [
  { x: 1, z: 0, nadel: false, krone: 3 }, { x: -1, z: 0, nadel: true, krone: 3 },
  { x: 4, z: -8, nadel: true, krone: 6 }, { x: -17, z: 1, nadel: false, krone: 10 },
];
const nachbarn = baumRaster(baumliste);
for (const x of [-24, -16.01, -8, -0.01, 0, 1.25, 8, 24]) for (const z of [-16, -8, -0.01, 0, 1.25, 8, 24]) {
  const ix = Math.floor(x / 8), iz = Math.floor(z / 8);
  let soll: { rand: number; nadel: boolean } | null = null;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const b of baumliste) {
    if (Math.floor(b.x / 8) !== ix + dx || Math.floor(b.z / 8) !== iz + dz) continue;
    const rand = Math.hypot(b.x - x, b.z - z) - b.krone;
    if (!soll || rand < soll.rand) soll = { rand, nadel: b.nadel };
  }
  assert.deepEqual(naechsteKrone(nachbarn, x, z), soll);
  assert.deepEqual(naechsteKrone(nachbarn, x, z, true), soll && soll.rand < KRONE_UEBERGANG / 2 ? soll : null);
}
