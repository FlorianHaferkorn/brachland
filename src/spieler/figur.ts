/**
 * BRACHLAND — Spielerfigur (Platzhalter)
 *
 * Kein Charakterdesign, sondern eine **Größenreferenz**. Ohne etwas Bekanntes im
 * Bild lässt sich nicht beurteilen, ob eine Fichte 22 m hoch wirkt oder ob ein Hang
 * steil ist — das Auge braucht einen Maßstab, und in einer Landschaft ohne Häuser
 * im Vordergrund ist das der eigene Körper.
 *
 * Bewusst monochrom und kantig: Die Art Direction lebt von Silhouetten, und die
 * eine Signalfarbe ist für Befall reserviert (ADR-0002). Ein bunter Platzhalter
 * würde die Farbdramaturgie kaputtmachen, bevor sie überhaupt existiert.
 *
 * Wird ersetzt, sobald es ein echtes Modell gibt — die Kette dafür steht
 * (`tools/README.md`), es fehlt nur die Stil-Referenz.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Gesamthöhe in Metern — muss zu `GROESSE.spieler` passen. */
export const FIGUR_HOEHE = 1.8;

const DUNKEL = new THREE.Color('#1a2320');
const MITTEL = new THREE.Color('#28332e');
const HELL = new THREE.Color('#39463f');

/** Färbt eine Geometrie flächig ein und schiebt sie an ihre Position. */
function teil(
  roh: THREE.BufferGeometry, farbe: THREE.Color,
  x: number, y: number, z: number,
): THREE.BufferGeometry {
  // Erst vereinheitlichen: Box und Cylinder sind indiziert, Icosahedron nicht.
  // `mergeGeometries` verweigert gemischte Index-Attribute — der Fehler tritt erst
  // zur Laufzeit auf und nimmt die ganze Szene mit.
  const g = roh.index ? roh.toNonIndexed() : roh;
  g.translate(x, y, z);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = farbe.r; col[i * 3 + 1] = farbe.g; col[i * 3 + 2] = farbe.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Baut die Figur. Blickrichtung ist -Z, passend zur Kamera, die von +Z schaut.
 *
 * Die Geometrie ist absichtlich grob (unter 300 Dreiecke): Sie steht dauerhaft im
 * Bild, ist aber nur Platzhalter — Aufwand gehört in die Kreaturen.
 */
export function baueSpielerGeometrie(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];

  // Beine — zwei schmale Quader, leicht auseinander
  for (const seite of [-1, 1]) {
    teile.push(teil(new THREE.BoxGeometry(0.17, 0.85, 0.19), DUNKEL, seite * 0.11, 0.425, 0));
  }

  // Rumpf: nach oben schmaler, damit die Silhouette Schultern bekommt
  teile.push(teil(new THREE.CylinderGeometry(0.20, 0.26, 0.62, 6), MITTEL, 0, 1.16, 0));

  // Kopf
  teile.push(teil(new THREE.IcosahedronGeometry(0.115, 0), HELL, 0, 1.60, 0));

  // Rückengepäck — gibt der Silhouette von hinten eine Kontur, und von hinten
  // sieht man die Figur die meiste Zeit.
  teile.push(teil(new THREE.BoxGeometry(0.30, 0.34, 0.17), DUNKEL, 0, 1.22, 0.20));

  // Arme
  for (const seite of [-1, 1]) {
    teile.push(teil(new THREE.BoxGeometry(0.10, 0.52, 0.12), MITTEL, seite * 0.28, 1.16, 0));
  }

  const g = mergeGeometries(teile, false);
  if (!g) throw new Error('Spielerfigur: Geometrien ließen sich nicht zusammenfassen');
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
