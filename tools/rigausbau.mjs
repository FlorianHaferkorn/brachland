#!/usr/bin/env node
/**
 * BRACHLAND — Archetyp-Rig aus einem bestehenden Modell schneiden
 *
 * ## Warum es das gibt
 *
 * `assets/rigs/` war leer, und `autorig.py` braucht dort je Bauform ein geriggtes
 * Modell mit Lauf-Animationen, von dem es Skelett und Bewegung erbt (Ledger B-10).
 *
 * Gleichzeitig lagen sechs Dateien als „Grathorn" im Repo, die beim Rendern einen
 * **Fuchs** zeigten: Mesh `fox1`, Material `fox_material`, Animationen
 * `Survey`/`Walk`/`Run`, Knochen `b_Root_00`/`b_Hip_01`/… — Zeile für Zeile das
 * three.js-Beispielmodell `Fox.glb`. Eigen war daran nur ein grauer Zacken am
 * Kopfknochen. Als Grathorn (Steinbock, Chitinplatten-Gehörn) war das falsch; als
 * Archetyp-Rig für Vierbeiner ist es genau richtig.
 *
 * Dieses Werkzeug macht aus dem einen das andere: Es entfernt die aufgesetzten
 * Auswüchse und behält Skelett, Haut und Animationen.
 *
 * ## Herkunft und Lizenz — gehört mitgeschleppt
 *
 * Modell „Fox" von **PixelMannen**, CC0. Animationen von **@tomkranis**,
 * CC-BY 4.0. Die CC-BY-Pflicht wandert mit: Jede Kreatur, die über `autorig.py`
 * dieses Skelett und diese Bewegungen erbt, trägt sie weiter. Steht deshalb auch
 * in `assets/_INDEX.md` und nicht nur hier.
 *
 * Aufruf: node rigausbau.mjs <in.glb> <out.glb> [name-des-koerpermeshes]
 *
 * Behalten wird **ein** benanntes Mesh, alles andere fliegt. Andersherum — die
 * Auswüchse an einem Präfix zu erkennen — war der erste Versuch und ging schief:
 * In v1 hießen sie `anbau_*`, in v2 `chitinhorn_*`, `plattenkamm_*`, `sporn_*`.
 * Eine Ausschlussliste altert mit jeder neuen Benennung, eine Einschlussliste nicht.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, quantize } from '@gltf-transform/functions';
import { statSync, openSync, readSync, closeSync } from 'node:fs';

const [, , INPUT, OUTPUT, KOERPER = 'fox1'] = process.argv;
if (!INPUT || !OUTPUT) {
  console.error('Aufruf: node rigausbau.mjs <in.glb> <out.glb> [koerpermesh]');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(INPUT);
const wurzel = doc.getRoot();

const vorher = wurzel.listMeshes().map(m => m.getName());
let entfernt = 0;
for (const knoten of wurzel.listNodes()) {
  const mesh = knoten.getMesh();
  if (!mesh) continue;
  if (mesh.getName() === KOERPER) continue;
  knoten.setMesh(null);
  entfernt++;
}
// Verwaiste Meshes einsammeln. `keepLeaves`, weil ein Knochen ohne eigenes Mesh
// für den Pruner wie ein leeres Blatt aussieht — und genau die brauchen wir.
await doc.transform(
  dedup(),
  resample(),
  prune({ keepAttributes: true, keepLeaves: true }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12,
             quantizeWeight: 8, quantizeGeneric: 12 }),
);

await io.write(OUTPUT, doc);

const fd = openSync(OUTPUT, 'r');
const magic = Buffer.alloc(4);
readSync(fd, magic, 0, 4, 0);
closeSync(fd);
if (magic.toString('latin1') !== 'glTF') {
  console.error(`  ✗ ${OUTPUT} ist kein GLB — abgebrochen`);
  process.exit(1);
}

const nach = doc.getRoot();
const kb = f => (statSync(f).size / 1024).toFixed(0);
console.log(`  ${INPUT.split('/').pop()} → ${OUTPUT.split('/').pop()}`);
console.log(`  Meshes    ${vorher.join(', ')}  →  ${nach.listMeshes().map(m => m.getName()).join(', ')}`);
console.log(`  entfernt  ${entfernt} Anbauten`);
console.log(`  Knochen   ${nach.listSkins()[0]?.listJoints().length ?? 0}`);
console.log(`  Animation ${nach.listAnimations().map(a => a.getName()).join(', ')}`);
console.log(`  Groesse   ${kb(INPUT)} → ${kb(OUTPUT)} KB`);
