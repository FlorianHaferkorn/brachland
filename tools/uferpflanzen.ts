/**
 * Überträgt die Gras- und Farnpolster des Tümpel-Zielbilds (stilframes.py, tuempel)
 * auf das gebackene Becken der Felsmulde. Dessen Wasserkante ist in Runde 4 noch
 * rechteckig. Die Wurzeln sitzen deshalb in den Erdlücken am tatsächlichen Steinrand.
 * Zusätzliche Lagen teilen die vorhandenen Instanzbündel des Pflanzenexports.
 *
 * npx tsx tools/uferpflanzen.ts public/bauten-ziel/felsmulde <neue-pflanzendatei.glb>
 */
import { existsSync } from 'node:fs';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, type InstancedMesh } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import { zufall } from '../src/world/pinsel.js';

const [basis, ausgabe] = process.argv.slice(2);
if (!basis || !ausgabe || existsSync(ausgabe)) throw new Error('Bauwerkpräfix und neuen Ausgabepfad angeben.');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
});
const [boden, bauten, wasser, pflanzen] = await Promise.all(
  ['boden', 'bauten', 'wasser', 'pflanzen'].map(art => io.read(basis + '-' + art + '.glb')),
);
const szene = pflanzen.getRoot().getDefaultScene() ?? pflanzen.getRoot().listScenes()[0];
if (szene.getExtras().uferpolster) throw new Error('Uferpolster sind bereits gebacken.');

/** Nur Oberfläche und Indizes für den senkrechten Wurzeltest übernehmen. */
function oberflaechen(dokument: Document, muster: RegExp) {
  const ergebnis: THREE.Mesh[] = [];
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  for (const knoten of dokument.getRoot().listNodes()) {
    if (!muster.test(knoten.getName())) continue;
    for (const teil of knoten.getMesh()?.listPrimitives() ?? []) {
      const pos = teil.getAttribute('POSITION')!;
      const geo = new THREE.BufferGeometry();
      const werte = pos.getArray();
      if (!(werte instanceof Float32Array || werte instanceof Int16Array || werte instanceof Uint16Array
        || werte instanceof Int8Array || werte instanceof Uint8Array)) {
        throw new Error('Ungültiges Positionsformat: ' + knoten.getName());
      }
      geo.setAttribute('position', new THREE.BufferAttribute(werte, 3, pos.getNormalized()));
      const idx = teil.getIndices()?.getArray();
      if (idx) {
        if (!(idx instanceof Uint8Array || idx instanceof Uint16Array || idx instanceof Uint32Array)) {
          throw new Error('Ungültiges Indexformat: ' + knoten.getName());
        }
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      const netz = new THREE.Mesh(geo, material);
      netz.matrixAutoUpdate = false;
      netz.matrix.fromArray(knoten.getWorldMatrix());
      netz.updateMatrixWorld(true);
      ergebnis.push(netz);
    }
  }
  if (!ergebnis.length) throw new Error('Oberfläche fehlt: ' + muster);
  return ergebnis;
}

const gruende = oberflaechen(boden, /^Zielboden$/);
const steine = oberflaechen(bauten, /^(Becken|Hof|Stein|Kiesel|Fels.*|Versturz|Wurzeln)$/);
const wasserflaeche = new THREE.Box3();
for (const netz of oberflaechen(wasser, /^Becken_Wasser$/)) wasserflaeche.expandByObject(netz);
const mitte = wasserflaeche.getCenter(new THREE.Vector3());
const halb = wasserflaeche.getSize(new THREE.Vector3()).multiplyScalar(0.5);
const strahl = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
function oberkante(netze: THREE.Mesh[], x: number, z: number) {
  strahl.ray.origin.set(x, mitte.y + 12, z);
  return strahl.intersectObjects(netze, false)[0]?.point.y ?? -Infinity;
}

type Art = 'grass_medium_02' | 'fern_02';
interface Vorlage {
  lagen: InstancedMesh;
  breite: number;
  unten: number;
  hoehe: number;
  neu: { TRANSLATION: number[]; ROTATION: number[]; SCALE: number[] };
}
const vorlagen: Record<Art, Vorlage[]> = { grass_medium_02: [], fern_02: [] };
for (const knoten of pflanzen.getRoot().listNodes()) {
  const teil = knoten.getMesh()?.listPrimitives()[0];
  const art = teil?.getMaterial()?.getName();
  if (!teil || (art !== 'grass_medium_02' && art !== 'fern_02')) continue;
  const lagen = knoten.getExtension<InstancedMesh>('EXT_mesh_gpu_instancing');
  if (!lagen) throw new Error('Scan-Vorlage ohne Instanzgruppe: ' + art);
  const pos = teil.getAttribute('POSITION')!;
  const unten = pos.getMinNormalized([]), oben = pos.getMaxNormalized([]);
  vorlagen[art].push({ lagen, unten: unten[1], hoehe: oben[1] - unten[1],
    breite: Math.max(oben[0] - unten[0], oben[2] - unten[2]), neu: { TRANSLATION: [], ROTATION: [], SCALE: [] } });
}

const ziehe = zufall(4 * 17 + 5); // Saat des Beckens und Ableitung wie im Blender-Zielbild.
const gesetzt: THREE.Vector2[] = [];
function bepflanze(art: Art, anzahl: number) {
  const auswahl = vorlagen[art];
  if (!auswahl.length) throw new Error('Pflanzenscan fehlt: ' + art);
  const farn = art === 'fern_02';
  let menge = 0;
  for (let versuch = 0; versuch < anzahl * 80 && menge < anzahl; versuch++) {
    const winkel = ziehe() * Math.PI * 2;
    if (Math.sin(2 * winkel + 0.6) < -0.35) continue; // Zwei offene Uferabschnitte aus Runde 5.
    const dx = Math.cos(winkel), dz = -Math.sin(winkel);
    const kante = Math.min(halb.x / Math.abs(dx), halb.z / Math.abs(dz));
    const abstand = kante + (farn ? 0.45 + 0.75 * ziehe() : 0.08 + 0.65 * ziehe());
    const x = mitte.x + dx * abstand, z = mitte.z + dz * abstand;
    const wurzel = new THREE.Vector2(x, z);
    if (gesetzt.some(p => p.distanceToSquared(wurzel) < 0.13 ** 2)) continue;
    // 2 cm Anhebung des gebackenen Bodens im Spiel (BauwerkBoden). Nur in Erde wurzeln.
    const erde = oberkante(gruende, x, z) + 0.02;
    if (!Number.isFinite(erde) || oberkante(steine, x, z) > erde + 0.025) continue;
    const v = auswahl[Math.floor(ziehe() * auswahl.length)];
    const skala = (farn ? 0.6 + 0.4 * ziehe() : 0.45 + 0.4 * ziehe()) / v.breite;
    const drehung = ziehe() * Math.PI;
    v.neu.TRANSLATION.push(x, erde - (v.unten + 0.03 * v.hoehe) * skala, z);
    v.neu.ROTATION.push(0, Math.sin(drehung), 0, Math.cos(drehung));
    v.neu.SCALE.push(skala, skala, skala);
    gesetzt.push(wurzel);
    menge++;
  }
  if (menge !== anzahl) throw new Error(`Zu wenige freie Wurzelpunkte für ${art}: ${menge}/${anzahl}`);
}
bepflanze('grass_medium_02', 28);
bepflanze('fern_02', 9);
for (const v of Object.values(vorlagen).flat()) {
  for (const [name, neu] of Object.entries(v.neu)) {
    const attr = v.lagen.getAttribute(name)!;
    const alt = attr.getArray();
    if (!(alt instanceof Float32Array)) throw new Error('Unerwartetes Instanzformat: ' + name);
    const alle = new Float32Array(alt.length + neu.length);
    alle.set(alt);
    alle.set(neu, alt.length);
    attr.setArray(alle);
  }
}
szene.setExtras({ ...szene.getExtras(), uferpolster: gesetzt.length });
pflanzen.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(ausgabe, pflanzen);
console.log(`Uferpolster: ${gesetzt.length} bewurzelte Lagen in bestehenden Bündeln.`);
