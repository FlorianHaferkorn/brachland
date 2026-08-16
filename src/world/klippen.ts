/**
 * BRACHLAND — Klippen und Felsbänder
 *
 * Das Gelände kommt jetzt aus dem 1-Meter-Modell und ist damit **geometrisch**
 * richtig. Es sieht trotzdem weich aus, und der Grund ist nicht die Auflösung: Ein
 * Höhenraster kann per Bauart keinen Überhang, keine senkrechte Wand und keine
 * scharfe Abrisskante. Jede Zelle hat genau eine Höhe. Eine echte Felswand ist aber
 * genau das — mehrere Höhen über derselben Grundfläche.
 *
 * Deshalb werden Klippen **aufgesetzt** statt aus dem Raster geschnitzt: Wo das
 * Gelände über einen Schwellwert steil wird, steht eine Felsplatte in der Falllinie.
 * Sie ist keine Verschönerung, sie ist die einzige Möglichkeit, eine Wand zu bekommen.
 *
 * Bewusst nicht gemacht: das Terrain selbst aufzuschneiden. Das bräuchte ein
 * Voxel- oder Mesh-Verfahren, würde LOD, Kollision und Höhenabfrage gleichzeitig
 * brechen — und alles davon funktioniert gerade.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HoehenFeld } from './lod.js';
import { mulberry } from './props.js';

/** Ab dieser Neigung in Grad gilt ein Hang als Klippe. */
export const KLIPPE_AB_GRAD = 41;
/** Abstand der Prüfpunkte in Metern. Feiner heißt mehr Wände und mehr Dreiecke. */
const RASTER = 14;

export interface Klippe {
  /** Mittelpunkt am Fuß der Wand. */
  position: [number, number, number];
  /** Höhe der Wand in Metern. */
  hoehe: number;
  /** Breite quer zur Falllinie. */
  breite: number;
  /** Drehung um Y, sodass die Platte im Hang steht. */
  drehung: number;
  variante: number;
}

/**
 * Findet Klippen im Höhenfeld.
 *
 * Die Neigung wird über zwei Meter Abstand gemessen, nicht über einen — bei einem
 * 1-m-Modell ist ein einzelner Nachbar Rauschen, zwei sind eine Kante.
 */
export function findeKlippen(
  feld: HoehenFeld, hoeheAn: (x: number, z: number) => number, seed = 3,
): Klippe[] {
  const zufall = mulberry(seed);
  const raus: Klippe[] = [];
  const halbB = feld.breiteMeter / 2, halbT = feld.tiefeMeter / 2;

  for (let x = -halbB + RASTER; x < halbB - RASTER; x += RASTER) {
    for (let z = -halbT + RASTER; z < halbT - RASTER; z += RASTER) {
      const h = hoeheAn(x, z);
      const hx = hoeheAn(x + 2, z) - hoeheAn(x - 2, z);
      const hz = hoeheAn(x, z + 2) - hoeheAn(x, z - 2);
      const gefaelle = Math.hypot(hx, hz) / 4;
      const grad = Math.atan(gefaelle) * 180 / Math.PI;
      if (grad < KLIPPE_AB_GRAD) continue;

      // Nicht jede steile Zelle bekommt eine Wand — sonst wird der Hang zur Mauer.
      if (zufall() > 0.55) continue;

      // Falllinie: Die Wand steht quer dazu, mit dem Rücken zum Berg.
      const richtung = Math.atan2(hx, hz);
      // Höhe der Wand aus dem Gefälle: steiler heißt höher, gedeckelt bei 14 m.
      const hoehe = Math.min(14, 2.5 + (grad - KLIPPE_AB_GRAD) * 0.5 + zufall() * 3);
      raus.push({
        position: [x + (zufall() - 0.5) * RASTER * 0.6,
                   h - hoehe * 0.35,
                   z + (zufall() - 0.5) * RASTER * 0.6],
        hoehe,
        breite: 6 + zufall() * 10,
        drehung: richtung + (zufall() - 0.5) * 0.5,
        variante: Math.floor(zufall() * 3),
      });
    }
  }
  return raus;
}

/**
 * Geometrie einer Felsplatte.
 *
 * Eine gekippte, gebrochene Fläche mit Kanten — kein Quader. Die Silhouette macht
 * den Fels, und eine Silhouette braucht Ecken, die nicht im rechten Winkel stehen.
 */
export function baueKlippenGeometrie(variante: number): THREE.BufferGeometry {
  const zufall = mulberry(1000 + variante * 7919);
  const teile: THREE.BufferGeometry[] = [];
  const farben = ['#5f6469', '#6b6f72', '#565b60'];

  // Drei bis vier versetzte Platten übereinander: So entsteht ein Band statt einer Wand.
  const platten = 3 + Math.floor(zufall() * 2);
  for (let i = 0; i < platten; i++) {
    const t = i / platten;
    const g = new THREE.BoxGeometry(
      1 * (0.7 + zufall() * 0.5), (1 / platten) * (0.9 + zufall() * 0.4), 0.35 + zufall() * 0.3,
    );
    // Leicht kippen und versetzen — geschichteter Fels, nicht gestapelte Kisten.
    g.rotateZ((zufall() - 0.5) * 0.28);
    g.rotateX((zufall() - 0.5) * 0.18);
    g.translate((zufall() - 0.5) * 0.35, t + 0.5 / platten, (zufall() - 0.5) * 0.25);

    const roh = g.toNonIndexed();
    const f = new THREE.Color(farben[i % farben.length]);
    const n = roh.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    const wind = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      // Leichte Streuung je Fläche, damit Platten nicht wie Plastik wirken.
      const s = 0.88 + zufall() * 0.24;
      col[k * 3] = f.r * s; col[k * 3 + 1] = f.g * s; col[k * 3 + 2] = f.b * s;
      wind[k] = 0;
    }
    roh.setAttribute('color', new THREE.BufferAttribute(col, 3));
    roh.setAttribute('aWind', new THREE.BufferAttribute(wind, 1));
    teile.push(roh);
  }

  const g = mergeGeometries(teile, false);
  if (!g) throw new Error('Klippe: Geometrien ließen sich nicht zusammenfassen');
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
