// D363: Hof-Baukasten-GLB (tools/hofbaukasten.py) fürs Spiel packen — Texturen als WebP (≤ 1024 px), Geometrie per
// Meshopt. Aufruf: node tools/hofbau_pack.mjs .cache/hofbaukasten/hof_s708_v1.glb public/bauten/hof-708.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [quelle, ziel] = process.argv.slice(2);
if (!quelle || !ziel) { console.error('Aufruf: node tools/hofbau_pack.mjs <quelle.glb> <ziel.glb>'); process.exit(1); }
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(quelle);
await doc.transform(dedup(), prune(), weld(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(ziel, doc);
console.log(`${ziel}: ${(statSync(quelle).size / 1e6).toFixed(1)} MB → ${(statSync(ziel).size / 1e6).toFixed(1)} MB`);
