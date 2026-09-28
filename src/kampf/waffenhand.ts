/**
 * Lage einer Waffe an `Wrist.R` der Quaternius-Menschen (ADR-0008, D174 hierher gezogen): Klinge
 * entlang −Y, wie das Schwert im Paket. `Sword` hängt dort an `Middle1.R` (0, 0,00091, −0,00025) mit
 * −90° um Z, `Middle1.R` an `Wrist.R` (0, 0,00027, 0); die Finger sind entfernt, also direkt ans Gelenk.
 */
import * as THREE from 'three';

/**
 * D184: Der Speer aus Primitiven (kein Modell im Waffenpaket): Eschenschaft 2 m, die Hand sitzt im
 * hinteren Drittel, Spitze auf −Y wie die Klinge. Spielerin und Speermann tragen denselben.
 */
export function baueSpeer(): THREE.Group {
  const holz = new THREE.MeshStandardMaterial({ color: '#5a4431', roughness: 0.8 });
  const metall = new THREE.MeshStandardMaterial({ color: '#77736b', roughness: 0.45, metalness: 0.6, name: 'Steel' });
  const g = new THREE.Group();
  const schaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 2.0, 8), holz);
  schaft.position.y = -0.55; schaft.castShadow = true; g.add(schaft);
  const spitze = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.26, 6), metall);
  spitze.position.y = -1.68; spitze.rotation.x = Math.PI; spitze.castShadow = true; g.add(spitze);
  g.name = 'Speer';
  return g;
}

export const WAFFE_AN_HAND = {
  position: new THREE.Vector3(0, 0.00118, -0.00025),
  drehung: new THREE.Quaternion(-0.0116, 0.0118, -0.0165, 0.9997)
    .multiply(new THREE.Quaternion(0.000648, 0, -0.712020, 0.702159)).normalize(),
  // Knocheneinheiten: Die Armatur ist 100fach skaliert, Geometrie in Metern braucht 0,01.
  massstab: 0.01,
};

/** Hängt `waffe` (Meter, Griff im Ursprung) an die rechte Hand eines Menschen. `false`, wenn es keine gibt. */
export function haengeAnHand(figur: THREE.Object3D, waffe: THREE.Object3D): boolean {
  const hand = figur.getObjectByName('WristR') ?? figur.getObjectByName('Wrist.R');
  if (!hand) {
    const h = figur.getObjectByName('hand_r');
    if (!h) return false;
    legeAnHeldHand(waffe); h.add(waffe);
    return true;
  }
  waffe.position.copy(WAFFE_AN_HAND.position);
  waffe.quaternion.copy(WAFFE_AN_HAND.drehung);
  waffe.scale.setScalar(WAFFE_AN_HAND.massstab);
  hand.add(waffe);
  return true;
}

/**
 * Dieselbe Waffe an `hand_r` des neuen Skeletts (D175, UE-Mannequin): so gelegt, dass sie in der
 * Ruhe genauso im Raum liegt wie an `Wrist.R` der alten Wanderin — gerechnet mit
 * `.cache/handlage.mjs` aus beiden Dateien.
 */
export const WAFFE_AN_HELD_HAND = {
  position: new THREE.Vector3(-0.02204, 0.11643, 0.00679),
  drehung: new THREE.Quaternion(-0.49601, 0.50396, -0.49602, 0.50394).normalize(),
  massstab: 0.98399,
};
export function legeAnHeldHand(waffe: THREE.Object3D): void {
  waffe.position.copy(WAFFE_AN_HELD_HAND.position);
  waffe.quaternion.copy(WAFFE_AN_HELD_HAND.drehung);
  waffe.scale.setScalar(WAFFE_AN_HELD_HAND.massstab);
}
