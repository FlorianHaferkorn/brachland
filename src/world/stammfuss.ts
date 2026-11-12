/**
 * BRACHLAND — Stammfuss: Verdeckung am Boden für das Holz der Blender-Szenen (D262)
 *
 * Ein Stamm, der überall gleich hell ist, steht nicht im Boden, er steckt darin. Im Render macht
 * das der Bounce: Unten fehlt Himmel, Streu und Gras schlucken Licht. Das Spiel hat dafür nur den
 * AO-Pass im Zwischenbild, und der reicht 8 m weit, nicht 30 cm.
 *
 * Hier bekommt jede Ecke eines Holznetzes `_fuss`: ihre Höhe über dem **sichtbaren Gelände**
 * (`hoeheAn`, dasselbe Feld, das den Boden zeichnet), 0 am Boden, 1 ab `FUSS_HOEHE`. Der Shader
 * dunkelt damit Fülllicht stark und Sonne schwach ab (`windmaterial.ts`, Option `fuss`).
 *
 * Erster Versuch war der tiefste Punkt je Stammkreis (`staemme.json`). Die Kreise sind auf
 * Brusthöhe geschnitten; an schrägen Stämmen fing der Kreis nur die Mitte, und der Stamm wurde ab
 * dort dunkel, mit einem hellen Streifen darunter (Stauwehr, 12.11.2026). Der Geländebezug kennt
 * dieses Problem nicht und gilt nebenbei für liegendes Holz und Wurzeln.
 *
 * Einmal beim Laden, CPU, linear in den Ecken.
 */
import * as THREE from 'three';

/** Bis zu dieser Höhe über dem Gelände wirkt die Verdeckung, in Metern. */
export const FUSS_HOEHE = 1.2;

/**
 * `geo` liegt im Raum `matrix` (Netz → Gruppe der Szene), die Gruppe steht bei `ursprung` (Weltmeter).
 * Gibt die Zahl der Ecken zurück, die näher als `FUSS_HOEHE` am Gelände liegen.
 */
export function setzeStammfuss(
  geo: THREE.BufferGeometry, matrix: THREE.Matrix4,
  ursprung: { x: number; y: number; z: number },
  hoeheAn: (x: number, z: number) => number,
): number {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const fuss = new Float32Array(pos.count);
  const p = new THREE.Vector3();
  let nah = 0;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(matrix).add(ursprung as THREE.Vector3Like);
    const f = Math.min(1, Math.max(0, (p.y - hoeheAn(p.x, p.z)) / FUSS_HOEHE));
    fuss[i] = f;
    if (f < 1) nah++;
  }
  geo.setAttribute('_fuss', new THREE.Float32BufferAttribute(fuss, 1));
  return nah;
}
