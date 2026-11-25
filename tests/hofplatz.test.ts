/** Hofmaske bleibt gedreht, lokal und stetig; keine Bodenschicht im Haus. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { baueWindMaterial } from '../src/world/windmaterial.js';
import { hofDeckung, bestimmeHof, hofRandProps, type Hof } from '../src/world/hofplatz.js';
import type { Weltdaten } from '../src/world/osm.js';
let anzahl = 0;
for (const winkel of [0, 0.71, 2.2]) {
  const c = Math.cos(winkel), s = Math.sin(winkel);
  const hof: Hof = { mitte: [1441, 462], achse: [c, s], halb: [10, 5], gebaeudeIndex: 0 };
  const wert = (u: number, v: number) => hofDeckung(1441 + u * c - v * s, 462 + u * s + v * c, hof);
  assert.equal(wert(0, 0), 0); anzahl++;
  assert.equal(wert(0, 8), 1); anzahl++;
  assert.equal(wert(0, -9), 0); anzahl++;
  assert.equal(wert(20, 0), 0); anzahl++;
  let vorher = wert(0, 9);
  for (let v = 9.01; v < 12; v += 0.01) {
    const aktuell = wert(0, v);
    assert.ok(aktuell >= 0 && aktuell <= 1);
    assert.ok(Math.abs(aktuell - vorher) < 0.04);
    vorher = aktuell;
  }
  anzahl++;
}
assert.equal(hofDeckung(0, 0, null), 0); anzahl++;
const welt = { bbox: [0, 0, 1, 1], gebaeude: [] } as unknown as Weltdaten;
assert.equal(bestimmeHof(welt, { breiteMeter: 4000, tiefeMeter: 4000 }), null); anzahl++;
const masse = { breiteMeter: 4000, tiefeMeter: 4000 };
const ring = (x: number, z: number): [number, number][] => ([[-8,-4],[8,-4],[8,4],[-8,4],[-8,-4]] as [number, number][])
  .map(([u,v]) => [0.5 - (z + v) / 4000, 0.5 + (x + u) / 4000]);
welt.gebaeude = [
  { art: 'garage', ebenen: 1, punkte: ring(1441, 462) },
  { art: 'house', ebenen: 2, punkte: ring(1446, 461), lod2: { t: 6, f: 8, d: 1000, w: 37 } },
  { art: 'house', ebenen: 2, punkte: ring(1500, 500) },
];
const auswahl = bestimmeHof(welt, masse)!;
assert.equal(auswahl.gebaeudeIndex, 1); anzahl++;
assert.ok(Math.hypot(auswahl.mitte[0] - 1446, auswahl.mitte[1] - 461) < 1e-8); anzahl++;
assert.ok(Math.abs(auswahl.achse[0] ** 2 + auswahl.achse[1] ** 2 - 1) < 1e-10); anzahl++;
// Der Messblick liegt auf der positiven Querachse, auch bei umgekehrter Grundrissrichtung.
assert.ok(-(1441-auswahl.mitte[0])*auswahl.achse[1] + (418-auswahl.mitte[1])*auswahl.achse[0] > 0); anzahl++;
assert.deepEqual(bestimmeHof(welt, masse), auswahl); anzahl++;
const rand = hofRandProps(auswahl, () => 7, () => false);
assert.equal(rand.length, 9); anzahl++;
assert.equal(rand.filter(p => p.art === 'findling').length, 3); anzahl++;
assert.ok(rand.every(p => hofDeckung(p.position[0], p.position[2], auswahl) > 0)); anzahl++;
assert.deepEqual(hofRandProps(auswahl, () => 7, () => false), rand); anzahl++;
assert.equal(hofRandProps(auswahl, () => 7, () => true).length, 0); anzahl++;
assert.equal(hofRandProps(null, () => 7, () => false).length, 0); anzahl++;
// Regression: three.Material.clone() verliert Hooks; die Scanfarbe muss den Windbau überleben.
const basis = new THREE.MeshStandardMaterial();
basis.userData.hofProbe = true;
let aufrufe = 0;
basis.onBeforeCompile = shader => { aufrufe++; shader.uniforms.uHofTest = { value: 17 }; };
basis.customProgramCacheKey = () => 'hof-regression';
const wind = baueWindMaterial({ amplitude: 0.2, randFarbe: new THREE.Color(), randStaerke: 0 }, basis);
const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <project_vertex>',
  fragmentShader: '#include <common>\n#include <color_fragment>\n#include <clipping_planes_fragment>\n#include <lights_fragment_end>'
} as Parameters<THREE.Material['onBeforeCompile']>[0];
wind.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
assert.equal(aufrufe, 1); anzahl++;
assert.equal(shader.uniforms.uHofTest.value, 17); anzahl++;
assert.ok('uZeit' in shader.uniforms); anzahl++;
assert.ok(wind.material.customProgramCacheKey().includes('hof-regression')); anzahl++;
assert.notEqual(wind.material, basis); anzahl++;
wind.material.dispose(); basis.dispose();
console.log(`${anzahl} Hofplatzprüfungen bestanden.`);
