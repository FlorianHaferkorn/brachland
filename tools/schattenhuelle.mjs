/**
 * BRACHLAND — Schattenhülle eines Bauwerks (D457): grobe Kopie der schattenwerfenden Körper, nur Lage, keine Textur.
 *   node tools/schattenhuelle.mjs public/bauten-ziel/felsmulde-bauten.glb public/bauten-ziel/felsmulde-schatten.glb [anteil=0.08] [fehler=0.01]
 * Anlass: Die Zielbild-Felsmulde zeichnete ihre 1,2 Mio. Dreiecke ein zweites Mal in die Schattenkarte (5 ms je Bild am
 * M1). Die Karte löst 24 cm je Texel auf — dafür reichen wenige Prozent der Flächen. Das Spiel lässt die sichtbaren
 * Netze keinen Schatten mehr werfen und hängt diese Hülle unsichtbar (kein Farb-, kein Tiefenschreiben) daneben.
 * Nur grosse Körper (Mauern, Felsen, Hof, Becken, Steine, Versturz, Wurzeln, Stubben, Balken); Schutt, Moos, Streu nie.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { simplify, weld, prune, dedup } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const [ein, aus, anteil = '0.08', fehler = '0.01'] = process.argv.slice(2);
if (!ein || !aus) throw new Error('Aufruf: schattenhuelle.mjs <bauten.glb> <schatten.glb> [anteil] [fehler]');
const WIRFT = /^(Mauer[ABC]|Stuetzmauer|Fels|Hof|Becken|Stein|Versturz|Wurzel|Stubben|Balken)(?!.*_Schutt)/;
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(ein);
const zaehle = () => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
let weg = 0;
for (const n of doc.getRoot().listNodes()) if (n.getMesh() && !WIRFT.test(n.getName())) { n.setMesh(null); weg++; }
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
  p.setMaterial(null);
  for (const s of p.listSemantics()) if (s !== 'POSITION') p.setAttribute(s, null);
}
await doc.transform(prune({ keepLeaves: false }));
const vor = zaehle();
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Number(anteil), error: Number(fehler), lockBorder: false }), dedup(), prune());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(aus, doc);
console.log(`${aus}: ${doc.getRoot().listNodes().filter(n => n.getMesh()).length} Körper (${weg} ohne Schatten), ${Math.round(vor)} → ${Math.round(zaehle())} Dreiecke`);
