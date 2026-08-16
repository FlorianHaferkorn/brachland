/**
 * BRACHLAND — Kollision mit Props
 *
 * Bewusst nur Stämme, Findlinge und Totholz. Büsche und Grasbüschel bleiben
 * durchlässig: Durch Unterholz *geht* man, und alles blockieren zu lassen macht
 * einen Wald unbegehbar, statt ihn dicht wirken zu lassen.
 *
 * Kein Physiksystem, sondern Kreise in einem Raster. Bei ~150.000 Props wäre eine
 * lineare Prüfung je Bild nicht bezahlbar; über die Rasterzelle sind es eine
 * Handvoll Kandidaten.
 */
import type { PropArt, PropInstanz } from '../world/props.js';

/** Stammradius je Art in Metern, wird mit der Instanzskalierung multipliziert. */
const RADIUS: Partial<Record<PropArt, number>> = {
  nadelbaum: 0.55,
  laubbaum: 0.65,
  findling: 0.90,
  totholz: 0.40,
};

/** Rasterweite. Muss größer sein als der größte Radius plus Spielerradius. */
const ZELLE = 8;

/** Halbe Schulterbreite der Figur. */
export const SPIELER_RADIUS = 0.35;

interface Hindernis { x: number; z: number; r: number }

export interface Kollisionsfeld {
  /** Schiebt eine Position aus allen überlappenden Hindernissen heraus. */
  schiebeRaus(x: number, z: number): [number, number];
  anzahl: number;
}

const schluessel = (ix: number, iz: number) => ix * 100003 + iz;

export function baueKollision(props: readonly PropInstanz[]): Kollisionsfeld {
  const raster = new Map<number, Hindernis[]>();
  let anzahl = 0;

  for (const p of props) {
    const basis = RADIUS[p.art];
    if (basis === undefined) continue;
    const h: Hindernis = {
      x: p.position[0],
      z: p.position[2],
      r: basis * (p.skalierung ?? 1),
    };
    const k = schluessel(Math.floor(h.x / ZELLE), Math.floor(h.z / ZELLE));
    const liste = raster.get(k);
    if (liste) liste.push(h); else raster.set(k, [h]);
    anzahl++;
  }

  return {
    anzahl,
    schiebeRaus(x, z) {
      const ix = Math.floor(x / ZELLE), iz = Math.floor(z / ZELLE);
      // Zwei Durchgänge: Wer zwischen zwei Stämmen steckt, wird sonst in den
      // zweiten hineingeschoben, während er aus dem ersten herauskommt.
      for (let runde = 0; runde < 2; runde++) {
        let bewegt = false;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const liste = raster.get(schluessel(ix + dx, iz + dz));
            if (!liste) continue;
            for (const h of liste) {
              const ex = x - h.x, ez = z - h.z;
              const mindest = h.r + SPIELER_RADIUS;
              const d2 = ex * ex + ez * ez;
              if (d2 >= mindest * mindest || d2 === 0) continue;
              const d = Math.sqrt(d2);
              x = h.x + (ex / d) * mindest;
              z = h.z + (ez / d) * mindest;
              bewegt = true;
            }
          }
        }
        if (!bewegt) break;
      }
      return [x, z];
    },
  };
}
