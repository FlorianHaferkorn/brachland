/**
 * BRACHLAND — Kreaturensilhouetten (Platzhalter)
 *
 * ADR-0002 sperrt echte Kreaturenmodelle, bis die Stil-Referenz steht: ein Bild
 * definiert den Look für alle ~200, sonst driftet der Stil auseinander. Bis dahin
 * braucht das Spiel trotzdem etwas, das in der Welt steht und angreifbar ist.
 *
 * Deshalb Silhouetten statt Modelle. Vier Bauformen nach `basisRig`, eingefärbt nach
 * Element. Das reicht, um im Nebel zu erkennen, dass dort etwas steht und welches
 * Element es hat — mehr leistet die Art Direction auf Entfernung ohnehin nicht.
 *
 * Bewusst NICHT gemacht: Details, die später weggeworfen werden. Jede Silhouette
 * bleibt unter 250 Dreiecken.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Element } from '../data/schema.js';

/**
 * Elementfarben — gedämpft, wie alles außer dem Befall.
 *
 * `sporen` ist der einzige helle Ton: Sporen sind im Kanon biolumineszent, und die
 * Signalfarbe der Art Direction (#3fd9a0) gehört zum Befall. Die Kreaturenfarbe
 * liegt bewusst daneben, nicht darauf.
 */
export const ELEMENT_FARBE: Record<Element, string> = {
  holz:      '#4a5c33',
  stein:     '#6e7276',
  'alt-tech': '#5a6b74',
  sporen:    '#6f9c6a',
  wasser:    '#3f6672',
  brand:     '#7a4a33',
  frost:     '#8fa6ad',
  faeulnis:  '#5c5238',
};

export type BasisRig = 'quadruped' | 'quadruped_small' | 'biped_bird' | 'serpent';

/**
 * Widerristhöhe je Bauform in Metern.
 *
 * Aus den realen Vorbildern: Steinbock und Wildschwein ~1 m, Fuchs und Salamander
 * deutlich darunter, Auerhahn aufgerichtet ~0,85 m, Kreuzotter liegt flach.
 * Maßstabstreue ist der Grund, warum das Projekt überhaupt 3D ist.
 */
export const RIG_HOEHE: Record<BasisRig, number> = {
  quadruped: 1.0, quadruped_small: 0.4, biped_bird: 0.85, serpent: 0.22,
};

function rig(name: string): BasisRig {
  return (name in RIG_HOEHE ? name : 'quadruped') as BasisRig;
}

/** Färbt eine Geometrie flächig ein und schiebt sie an ihre Stelle. */
function teil(
  roh: THREE.BufferGeometry, farbe: THREE.Color, x: number, y: number, z: number,
  drehX = 0,
): THREE.BufferGeometry {
  const g = roh.index ? roh.toNonIndexed() : roh;
  if (drehX) g.rotateX(drehX);
  g.translate(x, y, z);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = farbe.r; col[i * 3 + 1] = farbe.g; col[i * 3 + 2] = farbe.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function bauQuadruped(hell: THREE.Color, dunkel: THREE.Color, h: number) {
  const teile: THREE.BufferGeometry[] = [];
  const rumpfH = h * 0.34, beinH = h * 0.5;
  const L = h * 1.15, B = h * 0.42;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    teile.push(teil(new THREE.BoxGeometry(B * 0.22, beinH, B * 0.22), dunkel,
      sx * B * 0.34, beinH / 2, sz * L * 0.3));
  }
  teile.push(teil(new THREE.BoxGeometry(B, rumpfH, L), hell, 0, beinH + rumpfH / 2, 0));
  // Kopf sitzt vorn und tiefer — das macht die Silhouette lesbar als Tier.
  teile.push(teil(new THREE.BoxGeometry(B * 0.55, h * 0.22, h * 0.3), hell,
    0, beinH + rumpfH * 0.85, -L * 0.58));
  // Hörner/Ohren als Kontur nach oben
  for (const sx of [-1, 1]) {
    teile.push(teil(new THREE.ConeGeometry(h * 0.05, h * 0.26, 4), dunkel,
      sx * B * 0.2, beinH + rumpfH * 1.2, -L * 0.55));
  }
  teile.push(teil(new THREE.BoxGeometry(B * 0.16, h * 0.1, L * 0.32), dunkel,
    0, beinH + rumpfH * 0.9, L * 0.6));
  return teile;
}

function bauVogel(hell: THREE.Color, dunkel: THREE.Color, h: number) {
  const teile: THREE.BufferGeometry[] = [];
  const beinH = h * 0.34;
  for (const sx of [-1, 1]) {
    teile.push(teil(new THREE.BoxGeometry(h * 0.06, beinH, h * 0.06), dunkel,
      sx * h * 0.09, beinH / 2, 0));
  }
  const g = new THREE.IcosahedronGeometry(h * 0.26, 1);
  g.scale(0.85, 1.05, 1.15);
  teile.push(teil(g, hell, 0, beinH + h * 0.26, 0));
  teile.push(teil(new THREE.IcosahedronGeometry(h * 0.13, 0), hell, 0, beinH + h * 0.6, -h * 0.08));
  teile.push(teil(new THREE.ConeGeometry(h * 0.05, h * 0.16, 4), dunkel,
    0, beinH + h * 0.58, -h * 0.2, Math.PI / -2));
  // Aufgestellter Fächer — die Silhouette, an der man die Art erkennt
  const faecher = new THREE.CylinderGeometry(h * 0.34, h * 0.1, h * 0.05, 6, 1, false, 0, Math.PI);
  teile.push(teil(faecher, dunkel, 0, beinH + h * 0.34, h * 0.3, Math.PI / 2));
  return teile;
}

function bauSchlange(hell: THREE.Color, dunkel: THREE.Color, h: number) {
  const teile: THREE.BufferGeometry[] = [];
  const glieder = 7, laenge = h * 5.5;
  for (let i = 0; i < glieder; i++) {
    const t = i / (glieder - 1);
    const dicke = h * (1 - 0.55 * t);
    teile.push(teil(new THREE.BoxGeometry(dicke, dicke * 0.8, laenge / glieder), i % 2 ? hell : dunkel,
      Math.sin(t * Math.PI * 2) * h * 0.9, dicke * 0.4, (t - 0.5) * laenge));
  }
  teile.push(teil(new THREE.BoxGeometry(h * 1.1, h * 0.7, h * 1.0), hell, 0, h * 0.4, -laenge * 0.55));
  return teile;
}

/**
 * Baut die Silhouette einer Kreatur. Blickrichtung -Z, wie bei der Spielerfigur.
 * Das Ergebnis ist auf die reale Höhe der Bauform normiert.
 */
export function baueKreaturGeometrie(basisRig: string, elemente: Element[]): THREE.BufferGeometry {
  const r = rig(basisRig);
  const h = RIG_HOEHE[r];
  const hell = new THREE.Color(ELEMENT_FARBE[elemente[0]] ?? '#5a6058');
  // Zweites Element färbt die Akzente — Doppeltypen sind so auf Distanz erkennbar.
  const dunkel = new THREE.Color(ELEMENT_FARBE[elemente[1] ?? elemente[0]] ?? '#3a403a')
    .multiplyScalar(0.62);

  const teile = r === 'biped_bird' ? bauVogel(hell, dunkel, h)
    : r === 'serpent' ? bauSchlange(hell, dunkel, h)
    : bauQuadruped(hell, dunkel, h);

  const g = mergeGeometries(teile, false);
  if (!g) throw new Error(`Kreatursilhouette ${basisRig}: Geometrien nicht zusammenfassbar`);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
