#!/usr/bin/env node
/**
 * BRACHLAND — Kreatur-Reduktionspipeline
 * KI-generiertes GLB (Tripo/Hunyuan3D) -> spieltaugliches Low-Poly-GLB fuer die Offline-PWA
 *
 * Aufruf: node reduce.mjs <input.glb> <output.glb> [zielTris]
 */
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, prune, weld, simplify, resample, textureCompress,
  flatten, join, quantize
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [,, INPUT, OUTPUT, TARGET = '4000'] = process.argv;
if (!INPUT || !OUTPUT) { console.error('Aufruf: node reduce.mjs <in.glb> <out.glb> [zielTris]'); process.exit(1); }
const targetTris = parseInt(TARGET, 10);

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
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
  resample(),                                 // Animationskeys ausduennen
  prune({ keepAttributes: isRigged,           // JOINTS/WEIGHTS nicht wegwerfen
          keepLeaves: isRigged }),            // Knochen-Nodes ohne Mesh erhalten
  textureCompress({ encoder: sharp,           // Texturen auf Spielgroesse
                    targetFormat: 'webp',
                    resize: [1024, 1024], quality: 85 }),
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
