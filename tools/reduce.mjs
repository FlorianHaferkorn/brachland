#!/usr/bin/env node
/**
 * BRACHLAND — Kreatur-Reduktionspipeline
 * KI-generiertes GLB (Tripo/Hunyuan3D) -> spieltaugliches Low-Poly-GLB fuer die Offline-PWA
 *
 * Aufruf: node reduce.mjs <input.glb> <output.glb> [zielTris]
 */
import { NodeIO } from '@gltf-transform/core';
// ALL_EXTENSIONS statt KHRONOS_EXTENSIONS: `EXT_texture_webp` steht nicht in der
// Khronos-Liste. Mit der kleineren Liste hat der Writer die Wandlung unten still
// verworfen ("Some extensions were not registered for I/O") — die Textur blieb
// PNG, und der Lauf sah trotzdem grün aus.
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, prune, weld, simplify, resample, textureCompress,
  flatten, join, quantize
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [,, INPUT, OUTPUT, TARGET = '4000'] = process.argv;
if (!INPUT || !OUTPUT) { console.error('Aufruf: node reduce.mjs <in.glb> <out.glb> [zielTris]'); process.exit(1); }
const targetTris = parseInt(TARGET, 10);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(INPUT);

const stats = (d) => {
  let tris = 0, verts = 0;
  d.getRoot().listMeshes().forEach(m => m.listPrimitives().forEach(p => {
    const idx = p.getIndices();
    tris += idx ? idx.getCount() / 3 : p.getAttribute('POSITION').getCount() / 3;
    verts += p.getAttribute('POSITION').getCount();
  }));
  return { tris: Math.round(tris), verts,
           tex: d.getRoot().listTextures().length,
           anims: d.getRoot().listAnimations().length };
};

const before = stats(doc);
await MeshoptSimplifier.ready;

// Geriggte Modelle: flatten/join zerstoeren Skins -> nur bei statischen Meshes anwenden
const isRigged = doc.getRoot().listSkins().length > 0 || before.anims > 0;
if (isRigged) console.log('  [Info] Rig/Animation erkannt -> schonender Modus (kein flatten/join)');

// Zielverhaeltnis aus Ist-Stand ableiten
const ratio = Math.min(1, targetTris / Math.max(1, before.tris));

await doc.transform(
  dedup(),                                    // doppelte Accessors/Meshes zusammenfassen
  ...(isRigged ? [] : [flatten(), join()]),   // nur bei statischen Meshes sicher
  weld({ tolerance: 0.0001 }),                // Vertices verschweissen (Pflicht vor simplify)
  simplify({ simplifier: MeshoptSimplifier,   // Quadric Edge Collapse
             ratio, error: 0.005, lockBorder: false }),
  // Greift hier nur, wenn das Rohmodell schon Animationen mitbringt. Die des
  // Spiels entstehen erst in autorig.py — die duennt `nachbereiten.mjs` aus.
  resample(),
  prune({ keepAttributes: isRigged,           // JOINTS/WEIGHTS nicht wegwerfen
          keepLeaves: isRigged }),            // Knochen-Nodes ohne Mesh erhalten
  // Verlustfrei und in voller Aufloesung — beides gemessen, beides gegen die
  // Intuition. `quality: 85` machte die Grathorn-Textur 43 % GROESSER als das
  // PNG, Verkleinern auf 512 ebenfalls. Begruendung steht in nachbereiten.mjs.
  // `effort: 100`, weil der Wert intern auf sharps 0…6 skaliert wird.
  textureCompress({ encoder: sharp, targetFormat: 'webp',
                    lossless: true, effort: 100 }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12,
             quantizeWeight: 8, quantizeGeneric: 12 })
);

await io.write(OUTPUT, doc);
const after = stats(doc);
const skinsAfter = doc.getRoot().listSkins().length;

const { statSync } = await import('node:fs');
const mb = f => (statSync(f).size / 1024 / 1024);
console.log(`
  Flaechen    ${before.tris.toLocaleString('de')}  ->  ${after.tris.toLocaleString('de')}   (${(100*after.tris/before.tris).toFixed(1)} %)
  Vertices    ${before.verts.toLocaleString('de')}  ->  ${after.verts.toLocaleString('de')}
  Texturen    ${before.tex}  ->  ${after.tex}
  Animationen ${before.anims}  ->  ${after.anims}
  Skins/Rigs  ${doc.getRoot().listSkins().length >= 0 ? '' : ''}${skinsAfter}  (erhalten: ${!isRigged || skinsAfter > 0 ? 'ja' : 'NEIN'})
  Dateigroesse ${mb(INPUT).toFixed(2)} MB  ->  ${mb(OUTPUT).toFixed(2)} MB   (Faktor ${(mb(INPUT)/mb(OUTPUT)).toFixed(1)}x)
`);
