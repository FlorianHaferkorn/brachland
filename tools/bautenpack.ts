/**
 * BRACHLAND — Bauwerke packen (ADR-0006, Stufe 2): Texturen nach WebP, Ecken schweissen,
 * Unbenutztes weg, Geometrie mit Meshopt komprimieren. Gruen besteht nur aus Geometrie:
 * Texturkompression allein liess Stauwehr bei 31 MB. Meshopt erhaelt deren quantisierte
 * Attribute exakt; die Engine bringt den Decoder bereits ueber useGLTF mit.
 *
 *   npx tsx tools/bautenpack.ts public/bauten/*.glb
 *   npx tsx tools/bautenpack.ts --verlustfrei --aus .cache/neuer-bau.glb public/bauten/stauwehr-gruen.glb
 * --verlustfrei: bestehende Attribute/Texturen nicht erneut quantisieren oder verlustbehaftet packen.
 * --aus: genau eine Eingabe in eine neue Datei schreiben, ohne die Quelle zu aendern.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function packeBauwerk(eingabe: string, ausgabe: string, verlustfrei = false) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  });
  const vorher = statSync(eingabe).size;
  const doc = await io.read(eingabe);
  if (!verlustfrei) {
    await doc.transform(
      weld(),
      // Positionen 14 Bit (bei 300 m Ausdehnung 2 cm — unter der Steinfuge), Normalen und Farben 8 Bit
      quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeColor: 8, quantizeTexcoord: 12 }),
      dedup(),
      prune(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [1024, 1024] }),
    );
  }
  // Nur der Codec, ohne meshopt()-Transform: der wuerde erneut quantisieren und umsortieren.
  // QUANTIZE bezeichnet hier den Codec-Modus fuer vorhandene Attribute, keinen neuen Quantisierungsschritt.
  // FILTER waere verlustbehaftet. TRIANGLES darf lediglich den Startindex eines Dreiecks zyklisch drehen.
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  mkdirSync(dirname(ausgabe), { recursive: true });
  await io.write(ausgabe, doc);
  const nachher = statSync(ausgabe).size;
  const tris = doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
  return { vorher, nachher, dreiecke: tris, texturen: doc.getRoot().listTextures().length, netze: doc.getRoot().listMeshes().length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const eingaben: string[] = [];
  let verlustfrei = false;
  let ausgabe: string | undefined;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--verlustfrei') verlustfrei = true;
    else if (args[i] === '--aus') {
      if (ausgabe || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--aus braucht genau einen Ausgabepfad.');
      ausgabe = args[++i];
    } else if (args[i].startsWith('--')) throw new Error(`Unbekannte Option: ${args[i]}`);
    else eingaben.push(args[i]);
  }
  if (!eingaben.length || (ausgabe && eingaben.length !== 1)) throw new Error('Mindestens eine Eingabe erforderlich; mit --aus genau eine.');
  if (ausgabe && existsSync(ausgabe)) throw new Error(`Ausgabe existiert bereits: ${ausgabe}. Fuer einen neuen Lauf einen neuen Namen verwenden.`);
  for (const eingabe of eingaben) {
    const ziel = ausgabe ?? eingabe;
    const m = await packeBauwerk(eingabe, ziel, verlustfrei);
    console.log(`${ziel}: ${(m.vorher / 1048576).toFixed(2)} → ${(m.nachher / 1048576).toFixed(2)} MiB · ${m.texturen} Texturen · ${Math.round(m.dreiecke)} Dreiecke · ${m.netze} Netze`);
  }
}
