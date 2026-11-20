/**
 * D347: CC0-Fahrzeug für den Milbinger Ausschnitt. Keine KTX2-/Transmission-Abhängigkeit zur Laufzeit.
 * Quelle: https://tevy.dev/models/hatchback/v1/lod1.glb
 * node tools/kompaktwagen-pack.mjs <lod1.glb> [public/bauten/milbinger-kleinwagen.glb]
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Accessor, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { flatten, join, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , quelle, ziel = 'public/bauten/milbinger-kleinwagen.glb'] = process.argv;
if (!quelle) throw new Error('Dateipfad zum v1-LOD1-GLB angeben.');
const datei = readFileSync(quelle);
assert.equal(createHash('sha256').update(datei).digest('hex'), '51816627382232b5d7f0582e2aaff6c5f63c482bd6c859e05022fa129ebdfce0');
const pfad = 'node_modules/three/examples/jsm/libs/basis';
const modul = { exports: {} };
// Das mit three.js ausgelieferte Emscripten-Modul ist für Worker statt ES-Import gebaut.
new Function('exports', 'module', 'require', '__dirname', readFileSync(`${pfad}/basis_transcoder.js`, 'utf8'))(
  modul.exports, modul, createRequire(import.meta.url), pfad,
);
const basis = await modul.exports({ wasmBinary: readFileSync(`${pfad}/basis_transcoder.wasm`) });
basis.initializeBasis();

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
});
const dokument = await io.readBinary(datei);
const wurzel = dokument.getRoot();
for (const textur of wurzel.listTextures()) {
  const ktx = new basis.KTX2File(new Uint8Array(textur.getImage()));
  assert.ok(ktx.startTranscoding());
  const { origWidth: width, origHeight: height } = ktx.getImageLevelInfo(0, 0, 0);
  const RGBA32 = 13;
  const daten = new Uint8Array(ktx.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32));
  assert.ok(ktx.transcodeImage(daten, 0, 0, 0, RGBA32, 0, -1, -1));
  ktx.close();
  ktx.delete();
  const bild = await sharp(daten, { raw: { width, height, channels: 4 } }).removeAlpha().webp({ quality: 83 }).toBuffer();
  textur.setImage(bild).setMimeType('image/webp').setURI('');
}
for (const extension of wurzel.listExtensionsUsed()) {
  if (['KHR_texture_basisu', 'KHR_materials_transmission', 'KHR_materials_clearcoat', 'KHR_materials_emissive_strength']
    .includes(extension.extensionName)) extension.dispose();
}
dokument.createExtension(EXTTextureWebP).setRequired(true);

function farbrolle(name, ao) {
  if (name.startsWith('paint')) return ao ? 'lack-ao' : 'lack';
  if (name === 'tire') return 'gummi';
  if (name === 'glass' || name === 'mirror_glass') return 'glas';
  if (name.startsWith('rim') || name === 'caliper') return 'metall';
  if (name.startsWith('lamp') || name.startsWith('light')) return 'leuchten';
  return ao ? 'kunststoff-ao' : 'kunststoff';
}

const materialien = new Map();
for (const netz of wurzel.listMeshes()) for (const teil of netz.listPrimitives()) {
  const alt = teil.getMaterial(), name = alt.getName(), ao = alt.getOcclusionTexture();
  const rolle = farbrolle(name, !!ao);
  if (!materialien.has(rolle)) {
    const material = dokument.createMaterial(rolle).setDoubleSided(false)
      .setRoughnessFactor(({ gummi: .86, glas: .38, metall: .59, leuchten: .40 })[rolle] ?? .79)
      .setMetallicFactor(rolle === 'metall' ? .47 : rolle === 'glas' ? .09 : 0);
    if (ao && rolle.endsWith('-ao')) material.setOcclusionTexture(ao).setOcclusionStrength(.54);
    if (alt.getNormalTexture()) material.setNormalTexture(alt.getNormalTexture()).setNormalScale(.82);
    materialien.set(rolle, material);
  }
  let ton = alt.getBaseColorFactor().slice(0, 3);
  if (rolle.startsWith('lack')) ton = [.078, .133, .138];
  if (name === 'glass') ton = [.055, .078, .071];
  if (name === 'mirror_glass') ton = [.135, .16, .145];
  if (rolle === 'metall') ton = [.16, .15, .13];
  if (rolle === 'leuchten') ton = name.includes('front') ? [.46, .43, .32] : [.21, .047, .034];
  const position = teil.getAttribute('POSITION');
  const rgb = new Float32Array(position.getCount() * 3);
  for (let i = 0; i < position.getCount(); i++) rgb.set(ton, i * 3);
  const farbe = dokument.createAccessor().setType(Accessor.Type.VEC3).setBuffer(position.getBuffer()).setArray(rgb);
  teil.setMaterial(materialien.get(rolle)).setAttribute('COLOR_0', farbe);
}
for (const animation of wurzel.listAnimations()) animation.dispose();
await dokument.transform(flatten(), join({ keepNamed: false }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(ziel, dokument);
