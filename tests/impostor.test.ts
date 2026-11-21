/**
 * D367: Die Impostor-Ansicht passt zur Bake-Richtung in `tools/baumbau.py`, und das Register trägt je Baum einen
 * Impostor-Rahmen statt einer Fern-GLB.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { impostorAnsicht } from '../src/world/impostor.js';

const N = 8;
// Bake: Ansicht i aus Blender-Richtung (cos a, sin a, 0) → three (cos a, 0, −sin a).
for (let i = 0; i < N; i++) {
  const a = 2 * Math.PI * i / N;
  const v = impostorAnsicht(Math.cos(a), -Math.sin(a), 0, N);
  assert.ok(v.misch < 1e-9 || v.misch > 1 - 1e-9, `Ansicht ${i} liegt genau auf einer gebackenen Richtung`);
  assert.equal(v.misch > 0.5 ? v.b : v.a, i, `Ansicht ${i} ohne Drehung`);
}
// Drehung der Instanz: Kamera fest, Baum um θ gedreht = Kamera um −θ im Modell.
const th = 2 * Math.PI * 3 / N;
const v = impostorAnsicht(1, 0, th, N);
assert.equal(v.misch > 0.5 ? v.b : v.a, N - 3, 'Baum um drei Ansichten gedreht = Kamera um drei zurück');
// Zwischen zwei Ansichten: halbe Mischung, Nachbarn modulo n
const h = impostorAnsicht(Math.cos(-Math.PI / N), -Math.sin(-Math.PI / N), 0, N);
assert.equal(h.a, N - 1); assert.equal(h.b, 0); assert.ok(Math.abs(h.misch - 0.5) < 1e-9);

const register = JSON.parse(readFileSync('public/props/baeume.json', 'utf8')) as {
  baeume: { art: string; variante: number; stufe: string; datei: string; impostor?: { breite: number; hoehe: number; ansichten: number } }[] };
for (const art of ['buche', 'fichte']) {
  const fern = register.baeume.filter(b => b.art === art && b.stufe === 'fern');
  assert.equal(fern.length, 4, `${art}: vier Fernbäume`);
  for (const b of fern) {
    assert.ok(b.impostor && b.impostor.ansichten === N, `${b.datei}: Impostor mit ${N} Ansichten`);
    assert.ok(b.impostor.hoehe > 15 && b.impostor.breite > 5, `${b.datei}: Rahmen in Metern`);
    for (const k of ['farbe', 'normal']) readFileSync(`public/material/${b.datei}-${k}.webp`);
  }
}
console.log('✓ impostor: Ansichten passen zum Bake, Register trägt Rahmen und Atlanten');
