/** D343: Die Materialprobe bleibt beim Spieler opt-in und am animierten Kleidungsstück befestigt. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { legeWahlAn, STANDARD_HELD } from '../src/spieler/held.js';

const albedo = new THREE.Texture(), normale = new THREE.Texture(), metall = new THREE.Texture();
const original = new THREE.MeshStandardMaterial({ map: albedo, normalMap: normale, metalnessMap: metall });
original.name = 'MI_Ranger';
const geometrie = new THREE.BufferGeometry(), skelett = new THREE.Skeleton([new THREE.Bone()]);
const stiefel = new THREE.SkinnedMesh(geometrie, original);
stiefel.name = 'Female_Ranger_Feet';
stiefel.bind(skelett, new THREE.Matrix4());
const tunika = new THREE.Mesh(geometrie, original);
tunika.name = 'Female_Ranger_Body';
const hautMaterial = new THREE.MeshStandardMaterial();
hautMaterial.name = 'MI_Regular_Female';
const arm = new THREE.Mesh(geometrie, [original, hautMaterial]);
arm.name = 'Female_Ranger_Arms';
const figur = new THREE.Group().add(stiefel, tunika, arm);
const shader = (material: THREE.MeshStandardMaterial) => {
  const programm = {
    vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as Parameters<THREE.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(programm, {} as THREE.WebGLRenderer);
  return programm;
};

legeWahlAn(figur, STANDARD_HELD);
const stiefelMaterial = stiefel.material;
assert.notEqual(stiefelMaterial, original);
const vorher = shader(stiefelMaterial);
assert.doesNotMatch(vorher.fragmentShader, /uKleiderwerte/);

legeWahlAn(figur, STANDARD_HELD, true);
const detail = shader(stiefelMaterial);
assert.equal(stiefel.material, stiefelMaterial);
assert.equal(stiefelMaterial.map, albedo);
assert.equal(stiefelMaterial.normalMap, normale);
assert.equal(stiefelMaterial.metalnessMap, metall);
assert.equal(stiefel.geometry, geometrie);
assert.equal(stiefel.skeleton, skelett);
assert.ok(detail.vertexShader.indexOf('vKleiderPos = position;') < detail.vertexShader.indexOf('#include <skinning_vertex>'));
assert.match(detail.vertexShader, /vKleiderPos = position;/);
assert.match(detail.fragmentShader, /smoothstep\(\.06, \.42, metalnessFactor\)/);
assert.equal(detail.uniforms.uKleiderwerte.value.y, 1);
assert.equal(shader(tunika.material).uniforms.uKleiderwerte.value.y, 0);
assert.doesNotMatch(shader(arm.material[1]).fragmentShader, /uKleiderwerte/);

legeWahlAn(figur, STANDARD_HELD, false);
assert.deepEqual(shader(stiefelMaterial), vorher, 'Die Kleiderprobe kann nach der Aktivierung vollständig abgeschaltet werden');
console.log('✓ Stiefelabrieb sitzt vor dem Skinning, Originalkarten und Materialrückfall bleiben erhalten');
