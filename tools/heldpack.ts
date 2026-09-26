/**
 * BRACHLAND — Menschen aus `heldbau.py` packen (D175). Blender schreibt die Texturen der Pakete als
 * PNG in voller Grösse (4096², 50 MB je Gestalt). Hier: WebP, Farbe und Normalen auf 1024 (Gesicht
 * und Kleidung trägt man nah an der Kamera), Rauheit/ORM auf 512; Gewichte auf 8 Bit, Meshopt.
 *
 *   npx tsx tools/heldpack.ts public/figuren/held/*.glb
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, resample, weld, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
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
    const pfadT = c.getTargetPath();
    const out = c.getSampler()?.getOutput()?.getArray();
    if (pfadT === 'scale' && out && [...out].every(v => Math.abs(v - 1) < 1e-4)) { c.getSampler()?.dispose(); c.dispose(); weg++; continue; }
    // Blender tastet auch die Verschiebung jedes Knochens ab; ausser dem Becken steht sie still.
    const n = c.getTargetNode();
    if (pfadT === 'translation' && out && n) {
      const r = n.getTranslation();
      if ([...out].every((v, i) => Math.abs(v - r[i % 3]) < 1e-4)) { c.getSampler()?.dispose(); c.dispose(); weg++; }
    }
  }
  const klein = new Set<string>();
  for (const m of doc.getRoot().listMaterials()) {
    const t = m.getMetallicRoughnessTexture();
    if (t) klein.add(t.getURI() || t.getName());
  }
  await doc.transform(
    weld(), resample({ tolerance: 5e-4 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [1024, 1024] }),
    quantize({ pattern: /^(WEIGHTS_|JOINTS_|TEXCOORD_|NORMAL|POSITION)/, quantizeWeight: 8 }),
    dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(pfad, doc);
  const tex = doc.getRoot().listTextures().map(t => `${t.getName() || t.getURI()} ${t.getSize()?.join('×')}`).join(', ');
  console.log(`${pfad}: ${vorher.toFixed(0)} → ${(statSync(pfad).size / 1024).toFixed(0)} KB · ${weg} Skalenkanäle weg · ${doc.getRoot().listAnimations().length} Clips · ${tex}`);
}
