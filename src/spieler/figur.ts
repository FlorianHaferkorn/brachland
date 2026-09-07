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
 * **In Teilen statt als ein Klumpen.** Ein einziges verschmolzenes Mesh kann nicht
 * gehen — die Figur glitt über den Boden, und genau das fällt sofort auf. Beine und
 * Arme liegen deshalb einzeln vor, jeweils mit dem Drehpunkt im Ursprung, damit die
 * Szene sie um Hüfte und Schulter schwenken kann. Das ist kein Rig und ersetzt auch
 * keines; es ist der Unterschied zwischen „gleitet" und „geht".
 */
import * as THREE from 'three';
import { PALETTE } from '../world/palette.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Gesamthöhe in Metern — muss zu `GROESSE.spieler` passen. */
export const FIGUR_HOEHE = 1.8;

/** Höhe des Hüftgelenks über dem Boden. Beine hängen von hier nach unten. */
export const HUEFTE = 0.85;
/** Höhe des Schultergelenks. */
export const SCHULTER = 1.42;

const DUNKEL = new THREE.Color(PALETTE.figur.dunkel);
const MITTEL = new THREE.Color(PALETTE.figur.mittel);
const HELL = new THREE.Color(PALETTE.figur.hell);

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

function fertig(teile: THREE.BufferGeometry[], was: string): THREE.BufferGeometry {
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error(`Spielerfigur (${was}): Geometrien ließen sich nicht zusammenfassen`);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export interface SpielerTeile {
  /** Rumpf, Kopf, Gepäck — steht fest am Anker. */
  rumpf: THREE.BufferGeometry;
  /** Bein, Drehpunkt im Ursprung, hängt nach unten. Für beide Seiten dasselbe. */
  bein: THREE.BufferGeometry;
  /** Arm, Drehpunkt im Ursprung, hängt nach unten. */
  arm: THREE.BufferGeometry;
}

/**
 * Baut die Figur in Teilen. Blickrichtung ist -Z, passend zur Kamera von +Z.
 *
 * Die Geometrie ist absichtlich grob (unter 300 Dreiecke): Sie steht dauerhaft im
 * Bild, ist aber nur Platzhalter — Aufwand gehört in die Kreaturen.
 */
export function baueSpielerTeile(): SpielerTeile {
  const rumpfTeile: THREE.BufferGeometry[] = [];

  // Rumpf: nach oben schmaler, damit die Silhouette Schultern bekommt
  rumpfTeile.push(teil(new THREE.CylinderGeometry(0.20, 0.26, 0.62, 6), MITTEL, 0, 1.16, 0));
  // Kopf
  rumpfTeile.push(teil(new THREE.IcosahedronGeometry(0.115, 0), HELL, 0, 1.60, 0));
  // Rückengepäck — gibt der Silhouette von hinten eine Kontur, und von hinten
  // sieht man die Figur die meiste Zeit.
  rumpfTeile.push(teil(new THREE.BoxGeometry(0.30, 0.34, 0.17), DUNKEL, 0, 1.22, 0.20));

  // Bein und Arm haengen vom Drehpunkt nach unten: Mittelpunkt auf -Laenge/2.
  const bein = teil(new THREE.BoxGeometry(0.17, HUEFTE, 0.19), DUNKEL, 0, -HUEFTE / 2, 0);
  const arm = teil(new THREE.BoxGeometry(0.10, 0.52, 0.12), MITTEL, 0, -0.26, 0);

  return {
    rumpf: fertig(rumpfTeile, 'Rumpf'),
    bein: fertig([bein], 'Bein'),
    arm: fertig([arm], 'Arm'),
  };
}
