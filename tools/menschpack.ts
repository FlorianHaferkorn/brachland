/**
 * BRACHLAND — Menschen packen (D143): Farbe und Gewichte auf 8 Bit, Animationen
 * ausgeduennt, Unbenutztes weg. Blender schreibt COLOR_0 und WEIGHTS_0 als
 * float32 — 12 bzw. 16 Byte je Ecke, bei 4.400 Ecken 120 KB, die als Byte 33 KB
 * sind. Positionen bleiben float: Ein quantisiertes Skin-Netz braucht angepasste
 * Bindmatrizen, und das ist ein Fehler, den man erst am verzerrten Arm sieht.
 *
 *   npx tsx tools/menschpack.ts public/figuren/*.glb
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample, weld } from '@gltf-transform/functions';
import { statSync } from 'node:fs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const pfad of process.argv.slice(2)) {
  const vorher = statSync(pfad).size / 1024;
  const doc = await io.read(pfad);
  await doc.transform(
    weld(),
    resample(),
    quantize({ pattern: /^(COLOR_|WEIGHTS_|JOINTS_)/, quantizeColor: 8, quantizeWeight: 8, quantizeGeneric: 8 }),
    dedup(),
    prune(),
  );
  await io.write(pfad, doc);
  const nachher = statSync(pfad).size / 1024;
  const netz = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const attrs = netz ? netz.listSemantics().map(s => `${s}:${netz.getAttribute(s)!.getComponentSize()}B`).join(' ') : '?';
  console.log(`${pfad}: ${vorher.toFixed(0)} → ${nachher.toFixed(0)} KB · ${attrs} · ${doc.getRoot().listAnimations().length} Animationen`);
}
