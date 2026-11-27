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

// Die wirklichen exportierten Eckpunkte einschließlich WebP-/Meshopt-GLBs verformen. Nur das
// Dekodieren der Pixel entfällt im CPU-Test. Skinning, Namen und Bindematrizen kommen vom Loader.
const { readFileSync } = await import('node:fs');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { MeshoptDecoder } = await import('meshoptimizer');
const { baueKleiderfall } = await import('../src/spieler/kleiderfall.js');
const lader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
lader.register(parser => {
  parser.loadTextureImage = async () => new THREE.Texture();
  return { name: 'Kleiderprobe' };
});
for (const koerper of ['m', 'w']) for (const kleid of ['bauer', 'waldlaeufer']) for (const leicht of ['', '-leicht']) {
  const datei = koerper + '-' + kleid + leicht;
  const bytes = readFileSync('public/figuren/held/' + datei + '.glb');
  const { scene } = await lader.parseAsync(Uint8Array.from(bytes).buffer, '');
  const rock = scene.getObjectByName((koerper === 'm' ? 'Male' : 'Female') + (kleid === 'bauer' ? '_Peasant_Body' : '_Ranger_Body')) as THREE.SkinnedMesh;
  assert(rock?.isSkinnedMesh, datei);
  const original = rock.geometry;
  scene.updateMatrixWorld(true);
  const p = new THREE.Vector3(), ort = new THREE.Vector3();
  const pos = original.getAttribute('position');
  const nullpose = Array.from({ length: pos.count }, (_, i) => rock.getVertexPosition(i, new THREE.Vector3()));
  const stoff = baueKleiderfall(scene)!;
  assert(stoff, datei);
  const w = rock.morphTargetInfluences!;
  assert.equal(rock.geometry.index?.count, original.index?.count);
  scene.traverse(o => {
    if (o instanceof THREE.Mesh && o !== rock) assert(!o.geometry.morphAttributes.position?.length, o.name);
  });
  const ende = begrenzeBewohner(scene);
  stoff.schritt(1 / 60, ort, 0);
  for (let i = 0; i < 90; i++) { ort.z -= 3 / 60; stoff.schritt(1 / 60, ort, 0); }
  assert(w[2] > .7 && w[3] === 0, 'Blick nach -Z: Stoff folgt nach +Z');
  scene.updateMatrixWorld(true);
  let weg = 0;
  const grenzeY = rock.geometry.boundingBox!.min.y + .35 * (rock.geometry.boundingBox!.max.y - rock.geometry.boundingBox!.min.y);
  for (let i = 0; i < pos.count; i++) {
    rock.getVertexPosition(i, p);
    const d = p.distanceTo(nullpose[i]);
    assert(rock.boundingSphere!.containsPoint(p), datei + ': bewegte Ecke in Schattenhülle');
    if (pos.getY(i) >= grenzeY) assert(d < 1e-7, datei + ': obere Naht bleibt befestigt');
    weg = Math.max(weg, d);
  }
  assert(weg > .015 && weg < .09, datei + ': Auslenkung am tatsächlichen Modell in Metern ' + weg);
  for (let i = 1; i <= 12; i++) stoff.schritt(1 / 60, ort, Math.PI / 2 * i / 12);
  assert(w[4] < -.3, 'Hüfte wendet nach links, Saum dreht relativ dazu rechts');
  for (let i = 0; i < 90; i++) { ort.x -= 3 / 60; stoff.schritt(1 / 60, ort, Math.PI / 2); }
  assert(w[2] > .7 && w[3] === 0, 'Blick nach -X: Nachlauf liegt weiter hinten am Körper');
  for (let i = 0; i < 14; i++) { ort.y -= 4 / 60; stoff.schritt(1 / 60, ort, Math.PI / 2); }
  assert(w[5] > .3, 'Im Fall bleibt der Saum erst oben');
  for (let i = 0; i < 12; i++) stoff.schritt(1 / 60, ort, Math.PI / 2);
  assert(w[5] < 0, 'Bei Bodenkontakt fällt der Saum kurz nach unten');
  for (let i = 0; i < 120; i++) stoff.schritt(1 / 60, ort, Math.PI / 2);
  assert(w.every(v => v === 0), 'Im Stand fällt der Saum vollständig zurück');
  if (datei === 'w-waldlaeufer') {
    const clips = readFileSync('public/figuren/held/held-clips.glb');
    const bank = await lader.parseAsync(Uint8Array.from(clips).buffer, '');
    const mixer = new THREE.AnimationMixer(scene), gang = bank.animations.find(c => c.name === 'Koerper_Gang')!;
    const aktion = mixer.clipAction(gang).play();
    const werte: number[][] = [];
    for (const hz of [30, 60, 120]) {
      ort.set(0, 0, 0); aktion.reset().play(); mixer.update(0); stoff.schritt(1, ort, 0);
      let links = 0, rechts = 0;
      for (let j = 1; j <= hz * 2; j++) {
        ort.z = -3 * j / hz; mixer.update(1 / hz); stoff.schritt(1 / hz, ort, 0);
        links = Math.max(links, w[0]); rechts = Math.max(rechts, w[1]);
      }
      assert(links > .015 && rechts > .015, 'Der reale Gangclip bewegt den Saum zu beiden Seiten');
      werte.push([...w]);
    }
    for (let j = 0; j < w.length; j++) assert(Math.abs(werte[0][j] - werte[2][j]) < .025, '30/120 Hz: gleiche Gangpose ergibt vergleichbaren Saum');
    ort.x = 800;
    stoff.schritt(1 / 60, ort, 0); assert(w.every(v => v === 0), 'Versetzen beginnt ohne veralteten Impuls');
    mixer.stopAllAction();
  }
  ende(); stoff.loese(); assert.equal(rock.geometry, original);
  console.log('✓ ' + datei + ': Laufsaum ' + (weg * 100).toFixed(1) + ' cm, Wende, Landung, Halt und Schattenhülle geprüft');
}
