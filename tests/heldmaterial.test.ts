/** D343: Die Materialprobe bleibt beim Spieler opt-in und am animierten Kleidungsstück befestigt. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { begrenzeBewohner, legeWahlAn, STANDARD_HELD } from '../src/spieler/held.js';

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

// D481: Hauptbild und Schatten dürfen eine mehrknochig verformte Figur nur außerhalb ihrer Hülle verwerfen.
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 2, 1, 0, -1, 0, 1], 3));
g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0], 4));
g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([.5, .5, 0, 0, 1, 0, 0, 0, .75, .25, 0, 0], 4));
const links = new THREE.Bone(), rechts = new THREE.Bone(), rock = new THREE.SkinnedMesh(g, original);
const bewohner = new THREE.Group().add(links, rechts, rock);
bewohner.updateMatrixWorld(true);
rock.bind(new THREE.Skeleton([links, rechts]));
const altKugel = rock.boundingSphere;
const loese = begrenzeBewohner(bewohner);
for (const winkel of [0, 0.7, -2, Math.PI]) {
  bewohner.position.set(-814, 450, 597); bewohner.rotation.y = winkel;
  links.position.x = 2 * winkel; rechts.rotation.z = winkel; rechts.scale.set(1.3, 0.65, 1.7);
  bewohner.updateMatrixWorld(true);
  for (let i = 0; i < 3; i++) assert.ok(rock.boundingSphere.containsPoint(rock.getVertexPosition(i, new THREE.Vector3())));
}
loese();
assert.equal(rock.boundingSphere, altKugel);
