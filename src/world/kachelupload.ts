import * as THREE from 'three';

const MINDEST_BYTES = 256 * 1024;

/**
 * Bereitet die WebGL-Puffer einer noch nicht sichtbaren Kachelgruppe vor.
 * Three lädt im Projektionsschritt alle Attribute und bindet anschließend
 * den Index. Der leere Zeichenbereich verhindert die Rasterung.
 */
export function baueKachelupload(gl: THREE.WebGLRenderer) {
  const ziel = new THREE.WebGLRenderTarget(1, 1);
  const szene = new THREE.Scene();
  const kamera = new THREE.Camera();
  const material = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false });
  const platzhalter = new THREE.PlaneGeometry(1, 1);
  const traeger = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(platzhalter, material);
  traeger.frustumCulled = false;
  szene.add(traeger);

  function lade(geometrie: THREE.BufferGeometry): void {
    const vorher = gl.getRenderTarget();
    const face = gl.getActiveCubeFace(), mip = gl.getActiveMipmapLevel();
    const { start, count } = geometrie.drawRange;
    traeger.geometry = geometrie;
    geometrie.setDrawRange(0, 0);
    try {
      gl.setRenderTarget(ziel);
      gl.render(szene, kamera);
    } finally {
      gl.setRenderTarget(vorher, face, mip);
      geometrie.setDrawRange(start, count);
      traeger.geometry = platzhalter;
    }
  }

  lade(platzhalter);
  return {
    ladeGrossenPuffer(geometrie: THREE.BufferGeometry): boolean {
      const byte = Object.values(geometrie.attributes).reduce((summe, a) => summe + a.array.byteLength,
        geometrie.index?.array.byteLength ?? 0);
      if (byte < MINDEST_BYTES) return false;
      lade(geometrie);
      return true;
    },
    dispose() {
      platzhalter.dispose();
      ziel.dispose();
      material.dispose();
    },
  };
}
