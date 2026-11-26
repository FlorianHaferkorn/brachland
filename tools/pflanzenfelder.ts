/** Efeu und Streu sind in Blender jeweils ein Netz über den ganzen Hof. Felder erhalten
 * jedes Originaldreieck samt Attributen; drei.js kann verdeckte Blickrichtungen so auslassen. */
import { type Document, type vec3 } from '@gltf-transform/core';
import { compactPrimitive, prune } from '@gltf-transform/functions';

export async function teilePflanzenfelder(doc: Document) {
  let anzahl = 0;
  for (const knoten of doc.getRoot().listNodes()) {
    const netz = knoten.getMesh();
    if (!netz || !['Efeutraeger', 'Laubstreutraeger'].includes(netz.getName())) continue;
    if (knoten.getExtension('EXT_mesh_gpu_instancing')) continue;
    const matrix = knoten.getWorldMatrix();
    const name = netz.getName();
    for (const teil of netz.listPrimitives()) {
      const lage = teil.getAttribute('POSITION');
      const indizes = teil.getIndices()?.getArray();
      if (!lage || !indizes || teil.getMode() !== 4) throw new Error('Indizierte Dreiecke für ' + name + ' erwartet.');
      const felder = new Map<string, number[]>();
      const punkt: vec3 = [0, 0, 0];
      for (let i = 0; i < indizes.length; i += 3) {
        let x = 0, z = 0;
        for (let ecke = i; ecke < i + 3; ecke++) {
          lage.getElement(indizes[ecke], punkt);
          x += matrix[0] * punkt[0] + matrix[4] * punkt[1] + matrix[8] * punkt[2] + matrix[12];
          z += matrix[2] * punkt[0] + matrix[6] * punkt[1] + matrix[10] * punkt[2] + matrix[14];
        }
        const kante = 6;
        const schluessel = Math.floor(x / (3 * kante)) + '_' + Math.floor(z / (3 * kante));
        let liste = felder.get(schluessel);
        if (!liste) { liste = []; felder.set(schluessel, liste); }
        liste.push(indizes[i], indizes[i + 1], indizes[i + 2]);
      }
      for (const [schluessel, liste] of felder) {
        const feldname = name + '_' + schluessel;
        const feld = teil.clone().setIndices(doc.createAccessor().setArray(new Uint32Array(liste)));
        compactPrimitive(feld);
        knoten.addChild(doc.createNode(feldname).setMesh(doc.createMesh(feldname).addPrimitive(feld)));
        anzahl++;
      }
    }
    knoten.setMesh(null);
  }
  if (anzahl) await doc.transform(prune({ keepAttributes: true, keepLeaves: true }));
  return anzahl;
}
