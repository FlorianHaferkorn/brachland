// BRACHLAND — eigene Waffenmodelle (D414, `tools/waffenmodelle.py`) in `public/figuren/kampf/waffen.glb` legen.
//
//   node tools/waffenmodelle_pack.mjs .cache/d414/waffen-neu.glb public/figuren/kampf/waffen.glb
//
// Die Paketwaffen (Klinge, Axt, Stufe 3; `tools/waffenbau.py`, Medieval Weapons Pack) bleiben unverändert drin —
// ihre Quelle liegt nicht auf jeder Maschine. Gleichnamige Modelle werden ersetzt, Materialien gleichen Namens
// zusammengelegt (die Szene tönt `Steel` nach Schmiedestufe). Gepackt wie bisher: Quantisierung, Meshopt.
// Keine Texturen: Die Waffen tragen Materialfarben wie die Paketmodelle (kein WebP nötig).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, mergeDocuments, meshopt, prune, quantize, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

const [neuPfad, zielPfad] = process.argv.slice(2);
if (!neuPfad || !zielPfad) { console.error('Aufruf: node tools/waffenmodelle_pack.mjs <neu.glb> <waffen.glb>'); process.exit(1); }
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
});
const vorher = statSync(zielPfad).size / 1024;
const ziel = await io.read(zielPfad);
const neu = await io.read(neuPfad);
await ziel.transform(dequantize());
const namen = new Set(neu.getRoot().listNodes().map(n => n.getName()));
for (const n of ziel.getRoot().listNodes()) if (namen.has(n.getName())) { n.getMesh()?.dispose(); n.dispose(); }
const szene = ziel.getRoot().getDefaultScene() ?? ziel.getRoot().listScenes()[0];
const karte = mergeDocuments(ziel, neu);
for (const s of neu.getRoot().listScenes()) {
  for (const k of karte.get(s).listChildren()) szene.addChild(k);
  karte.get(s).dispose();
}
// Materialien gleichen Namens: das erste behalten (die Paketmaterialien stehen vorn).
const erstes = new Map();
for (const m of ziel.getRoot().listMaterials()) {
  const n = m.getName();
  if (!erstes.has(n)) { erstes.set(n, m); continue; }
  for (const mesh of ziel.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) if (p.getMaterial() === m) p.setMaterial(erstes.get(n));
  m.dispose();
}
await ziel.transform(unpartition(), weld(), dedup(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(zielPfad, ziel);
const liste = ziel.getRoot().listNodes().map(n => {
  const m = n.getMesh();
  const tri = m ? m.listPrimitives().reduce((s, p) => s + (p.getIndices()?.getCount() ?? 0) / 3, 0) : 0;
  return `${n.getName()} ${tri}`;
});
console.log(`${zielPfad}: ${vorher.toFixed(0)} → ${(statSync(zielPfad).size / 1024).toFixed(0)} KB · ${liste.join(', ')}`);
