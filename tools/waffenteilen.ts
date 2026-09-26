/**
 * BRACHLAND — Waffenclips abtrennen (D171): Die Wanderin kommt aus `menschbau.py` mit allen Clips,
 * auch den Waffenclips aus `waffenclips.py`. Zusammen wären das weit über 250 KB — die Figur, die
 * jede Szene lädt, trüge die Kampfbewegungen mit, auch wo nie gekämpft wird.
 *
 * Also zwei Dateien:
 *   public/figuren/wanderin.glb                ohne `Klinge_*`/`Axt_*`
 *   public/figuren/kampf/wanderin-waffen.glb   nur die Knochen und die `Klinge_*`/`Axt_*`-Clips
 *
 * Die Szene bindet die Clips der zweiten Datei über die Knotennamen an die Figur der ersten
 * (`useWaffenClips` in `RegionsSzene.tsx`). Gleiche Namen sind hier garantiert: Es ist dieselbe
 * Datei, einmal ohne Waffenclips, einmal ohne Netz.
 *
 *   npx tsx tools/waffenteilen.ts            (danach menschpack.ts auf wanderin.glb)
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, resample, meshopt, dedup } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

const WAFFENCLIP = /^(Klinge|Axt|Kampf)_/;
const QUELLE = 'public/figuren/wanderin.glb';
const ZIEL = 'public/figuren/kampf/wanderin-waffen.glb';

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
const figur = await io.read(QUELLE);
const clips = await io.read(QUELLE);
const namen = figur.getRoot().listAnimations().map(a => a.getName());
const waffen = namen.filter(n => WAFFENCLIP.test(n));
if (!waffen.length) {
  console.log(`${QUELLE}: keine Waffenclips drin — nichts zu trennen (${namen.join(', ')})`);
  process.exit(0);
}

// 1. Die Figur ohne Waffenclips.
for (const a of figur.getRoot().listAnimations()) if (WAFFENCLIP.test(a.getName())) a.dispose();
await figur.transform(prune());
await io.write(QUELLE, figur);

// 2. Nur Knochen und Waffenclips. Ohne Netz und Skin sind die Knochen leere Blätter — `prune`
//    darf sie nicht wegräumen, sonst zeigen die Kanäle ins Leere.
const r = clips.getRoot();
// D173 abgelöste Clips werden seit D174 gar nicht mehr gebaut; die Liste bleibt als Riegel.
const ABGELOEST = new Set<string>();
for (const a of r.listAnimations()) if (!WAFFENCLIP.test(a.getName()) || ABGELOEST.has(a.getName())) a.dispose();
for (const n of r.listNodes()) { n.setMesh(null); n.setSkin(null); }
for (const m of r.listMeshes()) m.dispose();
for (const s of r.listSkins()) s.dispose();
for (const m of r.listMaterials()) m.dispose();
// Skalierung ist in keinem Clip etwas anderes als 1 — ein Drittel der Kanäle, und bei 72 Kanälen je
// Clip ist das JSON grösser als die Daten.
let ohneSkala = 0;
for (const a of r.listAnimations()) for (const c of a.listChannels()) {
  if (c.getTargetPath() !== 'scale') continue;
  const out = c.getSampler()?.getOutput()?.getArray();
  if (out && [...out].every(v => Math.abs(v - 1) < 1e-4)) { c.getSampler()?.dispose(); c.dispose(); ohneSkala++; }
}
// Meshopt quantisiert und packt auch die Animationskanäle — die Szene lädt mit dem Decoder.
await clips.transform(resample({ tolerance: 5e-4 }), dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
mkdirSync(dirname(ZIEL), { recursive: true });
await io.write(ZIEL, clips);

const kb = (p: string) => (statSync(p).size / 1024).toFixed(0);
console.log(`${QUELLE}: ${namen.length - waffen.length} Clips, ${kb(QUELLE)} KB`);
const drin = waffen.filter(n => !ABGELOEST.has(n));
console.log(`${ZIEL}: ${drin.length} Clips (${drin.join(', ')}), ${ohneSkala} Skalenkanäle weg, ${kb(ZIEL)} KB`);
