/** D305: unveränderte Hausdreiecke mit gemeinsam verwendeten, wortgleichen Ecken. */
import * as THREE from 'three';

/** Nach der Normalberechnung, einmal beim Cache-Aufbau aufrufen.
 * Ein bereits indexiertes Objekt bleibt identisch. Sonst entsteht eine neue
 * Geometrie; der Aufrufer behält die Verantwortung für das Original/dispose.
 */
export function indexiereHausGeometrie(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.index) return g;
  const position = g.getAttribute('position');
  if (!position) throw new Error('Hausindex braucht ein Positionsattribut.');
  const anzahl = position.count;
  const attribute = Object.entries(g.attributes).map(([name, a]) => {
    if (!(a instanceof THREE.BufferAttribute) || !(a.array instanceof Float32Array) || a.count !== anzahl) {
      throw new Error(`Hausindex erwartet vollständige Float32-Attribute: ${name}`);
    }
    return { name, a, worte: new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length) };
  });
  if (Object.values(g.morphAttributes).some(a => a.length)) throw new Error('Hausindex unterstützt keine Morph-Attribute.');
  const koepfe = new Map<number, number>();
  const naechste = new Int32Array(anzahl), ursprung = new Uint32Array(anzahl), indizes = new Uint32Array(anzahl);
  let eindeutig = 0;
  for (let i = 0; i < anzahl; i++) {
    let hash = 2166136261;
    for (const { a, worte } of attribute) {
      const start = i * a.itemSize;
      for (let k = 0; k < a.itemSize; k++) hash = Math.imul(hash ^ worte[start + k], 16777619);
    }
    hash >>>= 0;
    const kopf = koepfe.get(hash) ?? -1;
    let treffer = -1;
    for (let j = kopf; j !== -1; j = naechste[j]) {
      const vorher = ursprung[j];
      let gleich = true;
      for (const { a, worte } of attribute) {
        for (let k = 0; k < a.itemSize; k++) if (worte[vorher * a.itemSize + k] !== worte[i * a.itemSize + k]) { gleich = false; break; }
        if (!gleich) break;
      }
      if (gleich) { treffer = j; break; }
    }
    if (treffer < 0) {
      treffer = eindeutig++;
      ursprung[treffer] = i;
      naechste[treffer] = kopf;
      koepfe.set(hash, treffer);
    }
    indizes[i] = treffer;
  }
  const neu = new THREE.BufferGeometry();
  neu.name = g.name;
  for (const { name, a, worte } of attribute) {
    const daten = new Float32Array(eindeutig * a.itemSize), ziel = new Uint32Array(daten.buffer);
    for (let i = 0; i < eindeutig; i++) for (let k = 0; k < a.itemSize; k++) ziel[i * a.itemSize + k] = worte[ursprung[i] * a.itemSize + k];
    const kopie = new THREE.BufferAttribute(daten, a.itemSize, a.normalized);
    kopie.name = a.name; kopie.setUsage(a.usage); kopie.gpuType = a.gpuType;
    neu.setAttribute(name, kopie);
  }
  neu.setIndex(new THREE.BufferAttribute(eindeutig <= 65536 ? new Uint16Array(indizes) : indizes, 1));
  neu.groups = g.groups.map(gruppe => ({ ...gruppe }));
  neu.setDrawRange(g.drawRange.start, g.drawRange.count);
  neu.boundingBox = g.boundingBox?.clone() ?? null;
  neu.boundingSphere = g.boundingSphere?.clone() ?? null;
  neu.userData = { ...g.userData };
  return neu;
}
