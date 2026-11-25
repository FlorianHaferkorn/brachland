// BRACHLAND — D383: löst Meshopt und Quantisierung einer gepackten Gestalt auf, damit Blender sie lesen kann.
// Nur für das Vorher-Bild von `tools/menschenframe.py`:  node tools/menschenframe_entpacken.mjs <ein.glb> <aus.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [ein, aus] = process.argv.slice(2);
const doc = await io.read(ein);
await doc.transform(dequantize());
for (const e of doc.getRoot().listExtensionsUsed()) {
  if (e instanceof EXTMeshoptCompression || e instanceof KHRMeshQuantization) e.dispose();
}
await io.write(aus, doc);
console.log('entpackt', aus);
