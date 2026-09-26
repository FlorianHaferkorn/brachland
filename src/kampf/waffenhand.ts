/**
 * Lage einer Waffe an `Wrist.R` der Quaternius-Menschen (ADR-0008, D174 hierher gezogen): Klinge
 * entlang −Y, wie das Schwert im Paket. `Sword` hängt dort an `Middle1.R` (0, 0,00091, −0,00025) mit
 * −90° um Z, `Middle1.R` an `Wrist.R` (0, 0,00027, 0); die Finger sind entfernt, also direkt ans Gelenk.
 */
import * as THREE from 'three';

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
