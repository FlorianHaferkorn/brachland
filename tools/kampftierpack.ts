/**
 * BRACHLAND — Kampftiere packen (D172): Gewichte und Farbe auf 8 Bit, Clips ausgedünnt, Skalenkanäle
 * weg, Meshopt. Blender schreibt Gewichte als float32 und tastet jeden Clip Bild für Bild ab —
 * der Wolf kam mit 717 KB aus `kampftierbau.py`.
 *
 *   npx tsx tools/kampftierpack.ts public/creatures/kampf/*.glb
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, resample, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
for (const pfad of process.argv.slice(2)) {
  const vorher = statSync(pfad).size / 1024;
  const doc = await io.read(pfad);
  let weg = 0;
  for (const a of doc.getRoot().listAnimations()) for (const c of a.listChannels()) {
    if (c.getTargetPath() !== 'scale') continue;
    const out = c.getSampler()?.getOutput()?.getArray();
    if (out && [...out].every(v => Math.abs(v - 1) < 1e-4)) { c.getSampler()?.dispose(); c.dispose(); weg++; }
  }
  await doc.transform(
    weld(), resample({ tolerance: 1e-3 }),
    quantize({ pattern: /^(COLOR_|WEIGHTS_|JOINTS_)/, quantizeColor: 8, quantizeWeight: 8 }),
    dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  for (const m of doc.getRoot().listMaterials()) m.setAlphaMode('OPAQUE');
  await io.write(pfad, doc);
  const a = doc.getRoot().listAnimations().map(x => x.getName()).join(', ');
  console.log(`${pfad}: ${vorher.toFixed(0)} → ${(statSync(pfad).size / 1024).toFixed(0)} KB · ${weg} Skalenkanäle weg · ${a}`);
}
