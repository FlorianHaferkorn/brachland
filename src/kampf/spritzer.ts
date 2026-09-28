/**
 * Spritzer (D190): sichtbare Elementwirkung beim Entladen — Tropfen bzw. Staub fliegen in Schlagrichtung
 * auseinander, ein flacher Ring läuft am Boden aus. 48 Teilchen als eine InstancedMesh, ein Ring, kein
 * Material je Teilchen; mehrere Ausbrüche teilen sich den Vorrat (älteste werden überschrieben).
 */
import * as THREE from 'three';

const ANZAHL = 80, JE_AUSBRUCH = 40, DAUER = 0.8, RING_DAUER = 0.6;
export const SPRITZER_FARBE = { wasser: '#7fd4ff', stein: '#a39a86' } as const;

export function baueSpritzer() {
  const gruppe = new THREE.Group();
  gruppe.name = 'spritzer';
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
  const tropfen = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.08, 0), mat, ANZAHL);
  tropfen.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tropfen.frustumCulled = false;
  gruppe.add(tropfen);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.visible = false;
  gruppe.add(ring);
  const pos = new Float32Array(ANZAHL * 3), vel = new Float32Array(ANZAHL * 3), alter = new Float32Array(ANZAHL).fill(99);
  let naechster = 0, ringAlter = 99;
  const m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
  for (let i = 0; i < ANZAHL; i++) { m.makeScale(0, 0, 0); tropfen.setMatrixAt(i, m); }

  return {
    gruppe,
    /** Ausbruch am Punkt, `rx/rz` Schlagrichtung (normiert). */
    ausloesen(x: number, y: number, z: number, rx: number, rz: number, farbe: string) {
      mat.color.set(farbe); ringMat.color.set(farbe);
      for (let k = 0; k < JE_AUSBRUCH; k++) {
        const i = naechster; naechster = (naechster + 1) % ANZAHL;
        const w = (Math.random() - 0.5) * 2.2, tempo = 2.5 + Math.random() * 3.5;
        const dx = rx * Math.cos(w) - rz * Math.sin(w), dz = rx * Math.sin(w) + rz * Math.cos(w);
        pos.set([x, y + Math.random() * 0.6, z], i * 3);
        vel.set([dx * tempo, 1.5 + Math.random() * 3, dz * tempo], i * 3);
        alter[i] = 0;
      }
      ring.position.set(x, y - 0.9, z); ringAlter = 0; ring.visible = true;
    },
    schritt(dt: number) {
      for (let i = 0; i < ANZAHL; i++) {
        if (alter[i] >= DAUER) continue;
        alter[i] += dt;
        vel[i * 3 + 1] -= 9.8 * dt;
        for (let a = 0; a < 3; a++) pos[i * 3 + a] += vel[i * 3 + a] * dt;
        const g = alter[i] < DAUER ? 1 - alter[i] / DAUER : 0;
        p.fromArray(pos, i * 3); s.setScalar(g);
        m.compose(p, q, s); tropfen.setMatrixAt(i, m);
      }
      tropfen.instanceMatrix.needsUpdate = true;
      mat.opacity = 0.85;
      if (ringAlter < RING_DAUER) {
        ringAlter += dt;
        const t = ringAlter / RING_DAUER;
        ring.scale.setScalar(0.4 + 2.2 * t); ringMat.opacity = 0.6 * (1 - t);
      } else ring.visible = false;
    },
  };
}
