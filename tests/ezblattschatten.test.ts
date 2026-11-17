/** D300: Die Schattenvorbereitung darf die Nadel-Deckung nicht auf 0,5 abschneiden. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bewahreEzBlattschatten } from '../src/world/ezlaubmaterial.js';

const szene = new THREE.Scene(), kamera = new THREE.PerspectiveCamera();
const zeichner = {} as THREE.WebGLRenderer;
let pruefungen = 0;
for (const schwelle of [0.3, 0.5]) {
  const material = new THREE.MeshPhongMaterial({ alphaTest: schwelle, alphaToCoverage: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
  const originalTiefe = new THREE.MeshDepthMaterial({ alphaTest: schwelle });
  mesh.customDepthMaterial = originalTiefe;
  bewahreEzBlattschatten(mesh);
  // WebGLShadowMap kann eine eigene Tiefenmaterial-Variante verwenden.
  const gezeichneteTiefe = originalTiefe.clone();
  // three.js setzt bei Alpha-to-Coverage unmittelbar vor onBeforeShadow stets 0,5.
  gezeichneteTiefe.alphaTest = 0.5;
  mesh.onBeforeShadow(zeichner, szene, kamera, kamera, mesh.geometry, gezeichneteTiefe, new THREE.Group());
  assert.equal(gezeichneteTiefe.alphaTest, schwelle, 'Gezeichnete Schattendeckung folgt der Quellschwelle'); pruefungen++;
  assert.equal(gezeichneteTiefe.alphaToCoverage, false, 'Schattenziel hat keine Multisamples'); pruefungen++;
  assert.equal(material.alphaTest, schwelle, 'Farbmaterial behält seine Schwelle'); pruefungen++;
  assert.equal(originalTiefe.alphaTest, schwelle, 'Ungezeichnete Tiefenquelle bleibt erhalten'); pruefungen++;
  mesh.geometry.dispose(); material.dispose(); originalTiefe.dispose(); gezeichneteTiefe.dispose();
}
console.log(`${pruefungen} EZ-Blattschattenprüfungen bestanden.`);
