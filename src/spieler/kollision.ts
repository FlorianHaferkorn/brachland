/**
 * BRACHLAND — Kollision mit Props
 *
 * Bewusst nur Stämme, Findlinge und Totholz — der Engine-Props und, seit G-136, der Blender-Szenen. Büsche und Grasbüschel bleiben
 * durchlässig: Durch Unterholz *geht* man, und alles blockieren zu lassen macht
 * einen Wald unbegehbar, statt ihn dicht wirken zu lassen.
 *
 * Kein Physiksystem, sondern Kreise in einem Raster. Bei ~150.000 Props wäre eine
 * lineare Prüfung je Bild nicht bezahlbar; über die Rasterzelle sind es eine
 * Handvoll Kandidaten.
 */
import type { PropArt, PropInstanz } from '../world/props.js';
import type { Weltdaten } from '../world/osm.js';
import { gesperrt, SZENEN_STAEMME } from '../world/bauwerke.js';

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

/** Gebäude als achsenparalleles Rechteck — Grundrisse sind überwiegend rechteckig. */
interface Rechteck { x0: number; x1: number; z0: number; z1: number }

export interface Kollisionsfeld {
  /** Schiebt eine Position aus allen überlappenden Hindernissen heraus. */
  schiebeRaus(x: number, z: number): [number, number];
  anzahl: number;
  gebaeude: number;
}

const schluessel = (ix: number, iz: number) => ix * 100003 + iz;

/**
 * Gebäudegrundrisse als Rechtecke in Weltkoordinaten.
 *
 * Eine exakte Polygonprüfung wäre genauer, aber OSM-Grundrisse sind fast immer
 * rechteckig, und der Unterschied ist ein halber Meter an einer Ecke. Ein Spieler,
 * der an einer Hauswand entlangläuft, merkt davon nichts — dass er *durch* das Haus
 * läuft, merkt er sofort.
 */
function baueGebaeudeRechtecke(
  welt: Weltdaten, breiteMeter: number, tiefeMeter: number,
): Rechteck[] {
  const [sued, west, nord, ost] = welt.bbox;
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * tiefeMeter,
  ];
  const aus: Rechteck[] = [];
  for (const g of welt.gebaeude ?? []) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [lat, lon] of g.punkte) {
      const [x, z] = zuWelt(lat, lon);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    // Ausgeblendete Haeuser (Freihaltung eines Bauwerks, `terrain.ts`) duerfen auch nicht unsichtbar im Weg stehen
    if (Number.isFinite(x0) && !gesperrt((x0 + x1) / 2, (z0 + z1) / 2, 'haeuser')) aus.push({ x0, x1, z0, z1 });
  }
  return aus;
}

export function baueKollision(
  props: readonly PropInstanz[],
  welt?: Weltdaten, breiteMeter = 0, tiefeMeter = 0,
  /**
   * Stämme der Blender-Szenen (G-136), `[x, z, r]`. Vorgabe: alle aus `public/bauten/staemme.json` —
   * im Freihalte-Radius einer Szene stehen keine Engine-Bäume, sondern ihre.
   */
  szenenStaemme: readonly (readonly [number, number, number])[] = SZENEN_STAEMME,
): Kollisionsfeld {
  const raster = new Map<number, Hindernis[]>();
  const bauten = new Map<number, Rechteck[]>();
  let anzahl = 0;

  const rechtecke = welt ? baueGebaeudeRechtecke(welt, breiteMeter, tiefeMeter) : [];
  for (const r of rechtecke) {
    // In jede berührte Zelle eintragen — Gebäude sind größer als eine Zelle.
    for (let iz = Math.floor(r.z0 / ZELLE); iz <= Math.floor(r.z1 / ZELLE); iz++)
      for (let ix = Math.floor(r.x0 / ZELLE); ix <= Math.floor(r.x1 / ZELLE); ix++) {
        const k = schluessel(ix, iz);
        const l = bauten.get(k);
        if (l) l.push(r); else bauten.set(k, [r]);
      }
  }

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

  for (const [x, z, r] of szenenStaemme) {
    const k = schluessel(Math.floor(x / ZELLE), Math.floor(z / ZELLE));
    const liste = raster.get(k);
    if (liste) liste.push({ x, z, r }); else raster.set(k, [{ x, z, r }]);
    anzahl++;
  }

  return {
    anzahl,
    gebaeude: rechtecke.length,
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
            const bl = bauten.get(schluessel(ix + dx, iz + dz));
            if (!bl) continue;
            for (const r of bl) {
              const ax0 = r.x0 - SPIELER_RADIUS, ax1 = r.x1 + SPIELER_RADIUS;
              const az0 = r.z0 - SPIELER_RADIUS, az1 = r.z1 + SPIELER_RADIUS;
              if (x <= ax0 || x >= ax1 || z <= az0 || z >= az1) continue;
              // Auf der kürzesten Strecke hinausschieben — sonst springt man durch.
              const links = x - ax0, rechts = ax1 - x;
              const vorne = z - az0, hinten = az1 - z;
              const min = Math.min(links, rechts, vorne, hinten);
              if (min === links) x = ax0;
              else if (min === rechts) x = ax1;
              else if (min === vorne) z = az0;
              else z = az1;
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
