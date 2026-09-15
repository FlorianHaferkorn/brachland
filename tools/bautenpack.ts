/**
 * BRACHLAND — Bauwerke packen (ADR-0006, Stufe 2): Texturen nach WebP, Ecken schweissen,
 * Unbenutztes weg. Der Blender-Exporter schreibt PNG — 34 MB fuer ein Bauwerk (gemessen),
 * und der Precache der PWA nimmt 8 MB je Datei. WebP bei 82 % ist an gebackenem Stein nicht
 * zu unterscheiden; Normalen bleiben WebP verlustbehaftet, was an 1024er Karten nicht auffaellt.
 *
 *   npx tsx tools/bautenpack.ts public/bauten/*.glb
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const pfad of process.argv.slice(2)) {
  const vorher = statSync(pfad).size / 1024 / 1024;
  const doc = await io.read(pfad);
  await doc.transform(
    weld(),
    // Positionen 14 Bit (bei 300 m Ausdehnung 2 cm — unter der Steinfuge), Normalen und Farben 8 Bit
    quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeColor: 8, quantizeTexcoord: 12 }),
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [1024, 1024] }),
  );
  await io.write(pfad, doc);
  const nachher = statSync(pfad).size / 1024 / 1024;
  const tris = doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
  console.log(`${pfad}: ${vorher.toFixed(1)} → ${nachher.toFixed(1)} MB · ${doc.getRoot().listTextures().length} Texturen · ${Math.round(tris)} Dreiecke · ${doc.getRoot().listMeshes().length} Netze`);
}
