/** D363: Hof-Baukasten-Modell sitzt am Grundriss — Ursprung am Giebel minU, Drehung entlang der langen Seite. */
import assert from 'node:assert/strict';
import { hofbauLagen, ersetzteGebaeude } from '../src/world/hofbau.js';
import daten from '../content/hofbauten.json';
import type { Weltdaten } from '../src/world/osm.js';

const h = daten.hofbauten[0];
// Region 1000 × 1000 m; Grundriss 36 × 14 m, um 30° gedreht, Mitte (100, -50).
const bbox: [number, number, number, number] = [47, 12, 47.009, 12.0132];
const breite = 1000, tiefe = 1000;
const a = Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
const ecken = [[-18, -7], [18, -7], [18, 7], [-18, 7], [-18, -7]].map(([u, v]) => [100 + u * c - v * s, -50 + u * s + v * c]);
const zuLatLon = ([x, z]: number[]): [number, number] =>
  [bbox[2] - (z / tiefe + 0.5) * (bbox[2] - bbox[0]), bbox[1] + (x / breite + 0.5) * (bbox[3] - bbox[1])];
const gebaeude = Array.from({ length: h.gebaeude + 1 }, () => ({ punkte: [] as [number, number][], ebenen: 2, art: 'house' }));
gebaeude[h.gebaeude] = { punkte: ecken.map(zuLatLon), ebenen: 2, art: 'farm' };
const welt = { bbox, gebaeude } as unknown as Weltdaten;
const boden = { breiteMeter: breite, tiefeMeter: tiefe, hoeheAn: (x: number, z: number) => 0.01 * x + 0.02 * z } as never;

const [l] = hofbauLagen(h.region, welt, boden);
assert.ok(l, 'keine Lage');
assert.ok(Math.abs(l.laenge - 36) < 0.05 && Math.abs(l.breite - 14) < 0.05, `Masse ${l.laenge}/${l.breite}`);
// Modellachse +x zeigt nach Drehung entlang der langen Seite, vom Ursprung zum anderen Giebel.
const ax = Math.cos(l.drehung), az = -Math.sin(l.drehung);
const ende = [l.ort[0] + ax * 36, l.ort[2] + az * 36];
const mitte = [(l.ort[0] + ende[0]) / 2, (l.ort[2] + ende[1]) / 2];
assert.ok(Math.hypot(mitte[0] - 100, mitte[1] + 50) < 0.1, `Mitte daneben: ${mitte}`);
// Höhe = tiefste Ecke, damit der Sockel nicht schwebt.
const tiefste = Math.min(...ecken.slice(0, 4).map(([x, z]) => 0.01 * x + 0.02 * z));
assert.ok(Math.abs(l.ort[1] - tiefste) < 0.05, `Höhe ${l.ort[1]} statt ${tiefste}`);
assert.ok(ersetzteGebaeude(h.region).has(h.gebaeude));
console.log(`hofbau: ${h.modell} mittig am Grundriss, Höhe an tiefster Ecke`);
