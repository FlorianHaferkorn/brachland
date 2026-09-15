/**
 * Der Transportcodec darf das gezeichnete Bauwerk nicht veraendern.
 * Gegenprobe mit dem GLTFLoader/Decoder der Engine, nicht nur mit dem Encoderpaket:
 * Attribute, Weltmatrix und Material bleiben exakt, Dreiecke behalten Reihenfolge und Winding.
 * Meshopt darf lediglich die drei Eckindizes eines Dreiecks zyklisch drehen.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import { Mesh, MeshStandardMaterial } from 'three';
import { packeBauwerk } from '../tools/bautenpack.js';

const ziel = mkdtempSync(join(tmpdir(), 'brachland-bautenpack-'));
const decoder = typeof MeshoptDecoder === 'function' ? MeshoptDecoder() : MeshoptDecoder;
const loader = new GLTFLoader().setMeshoptDecoder(decoder);

async function lade(pfad: string) {
  const daten = readFileSync(pfad);
  const gltf = await loader.parseAsync(daten.buffer.slice(daten.byteOffset, daten.byteOffset + daten.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const netze: Mesh[] = [];
  gltf.scene.traverse(o => { if (o instanceof Mesh) netze.push(o); });
  return netze;
}

function materialwerte(material: Mesh['material']) {
  assert(!Array.isArray(material));
  assert(material instanceof MeshStandardMaterial);
  return {
    name: material.name, farbe: material.color.toArray(), emissiv: material.emissive.toArray(),
    rauheit: material.roughness, metall: material.metalness, deckkraft: material.opacity,
    alphaTest: material.alphaTest, transparent: material.transparent, seite: material.side,
    vertexfarbe: material.vertexColors, flat: material.flatShading,
  };
}

try {
  for (const name of ['stauwehr-gruen', 'felsmulde-gruen']) {
    const quelle = `public/bauten/${name}.glb`;
    const ausgabe = join(ziel, name + '.glb');
    const original = readFileSync(quelle);
    const mass = await packeBauwerk(quelle, ausgabe, true);
    assert.deepEqual(readFileSync(quelle), original, 'Die separate Ausgabe veraendert ihre Quelle nicht.');
    assert(mass.nachher <= mass.vorher, `${name}: Wiederholtes Packen darf die Datei nicht vergroessern.`);
    const glb = readFileSync(ausgabe);
    const kopf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
    assert(kopf.extensionsRequired?.includes('EXT_meshopt_compression'), `${name}: Transportcodec ist erforderlich.`);
    assert(kopf.bufferViews.some((v: { extensions?: Record<string, unknown> }) => v.extensions?.EXT_meshopt_compression), `${name}: Geometrie wird tatsaechlich komprimiert.`);
    const vorher = await lade(quelle), nachher = await lade(ausgabe);
    assert.equal(nachher.length, vorher.length, `${name}: Netzanzahl`);
    for (let i = 0; i < vorher.length; i++) {
      const a = vorher[i], b = nachher[i];
      assert.equal(b.name, a.name, 'Namen steuern Blattloecher im Bauwerk.');
      assert.deepEqual(b.matrixWorld.elements, a.matrixWorld.elements, `${a.name}: Weltmatrix`);
      assert.deepEqual(materialwerte(b.material), materialwerte(a.material), `${a.name}: Material`);
      assert.deepEqual(b.geometry.groups, a.geometry.groups, `${a.name}: Materialgruppen`);
      const semantiken = Object.keys(a.geometry.attributes).sort();
      assert.deepEqual(Object.keys(b.geometry.attributes).sort(), semantiken, `${a.name}: Attributsatz`);
      for (const semantik of semantiken) {
        const alt = a.geometry.getAttribute(semantik), neu = b.geometry.getAttribute(semantik);
        assert.equal(neu.itemSize, alt.itemSize, `${a.name}/${semantik}: Komponenten`);
        assert.equal(neu.normalized, alt.normalized, `${a.name}/${semantik}: Normalisierung`);
        assert.equal(neu.count, alt.count, `${a.name}/${semantik}: Anzahl`);
        // GLTFLoader kann Attribute interleaved liefern: getComponent liest die wirklichen Werte.
        for (let v = 0; v < alt.count; v++) {
          for (let k = 0; k < alt.itemSize; k++) {
            assert.equal(neu.getComponent(v, k), alt.getComponent(v, k), `${a.name}/${semantik}: Ecke ${v}/${k}`);
          }
        }
      }
      const alt = a.geometry.index!, neu = b.geometry.index!;
      assert.equal(neu.count, alt.count, `${a.name}: Indexanzahl`);
      for (let t = 0; t < alt.count; t += 3) {
        const zyklisch = [0, 1, 2].some(k =>
          alt.getX(t) === neu.getX(t + k) &&
          alt.getX(t + 1) === neu.getX(t + (k + 1) % 3) &&
          alt.getX(t + 2) === neu.getX(t + (k + 2) % 3));
        assert(zyklisch, `${a.name}: Dreieck ${t / 3} hat andere Ecken oder Winding.`);
      }
    }
    console.log(`${name}: ${vorher.length} Netze, Attribute/Material/Weltmatrix/Winding erhalten; ${mass.vorher} → ${mass.nachher} Byte.`);
  }
} finally {
  rmSync(ziel, { recursive: true, force: true });
}
