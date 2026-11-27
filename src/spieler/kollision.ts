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
import { imPolygon, type Weltdaten } from '../world/osm.js';
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

interface Grundriss {
  ring: [number, number][];
  x0: number; x1: number; z0: number; z1: number;
  umlauf: number;
}

export interface Kollisionsfeld {
  /** Schiebt eine Position aus allen überlappenden Hindernissen heraus. */
  schiebeRaus(x: number, z: number): [number, number];
  anzahl: number;
  gebaeude: number;
}

const schluessel = (ix: number, iz: number) => ix * 100003 + iz;

/** Grundrisse in Weltmetern. Die Rastergrenzen schließen die Schulterbreite ein. */
function baueGrundrisse(welt: Weltdaten, breiteMeter: number, tiefeMeter: number): Grundriss[] {
  const [sued, west, nord, ost] = welt.bbox;
  const aus: Grundriss[] = [];
  for (const g of welt.gebaeude ?? []) {
    if (g.punkte.length < 3) continue;
    const ring: [number, number][] = g.punkte.map(([lat, lon]) => [
      ((lon - west) / (ost - west) - .5) * breiteMeter,
      ((nord - lat) / (nord - sued) - .5) * tiefeMeter,
    ]);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, flaeche = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, z] = ring[i];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      flaeche += ring[j][0] * z - x * ring[j][1];
    }
    if (!flaeche || gesperrt((x0 + x1) / 2, (z0 + z1) / 2, 'haeuser')) continue;
    aus.push({ ring, umlauf: Math.sign(flaeche), x0: x0 - SPIELER_RADIUS, x1: x1 + SPIELER_RADIUS,
      z0: z0 - SPIELER_RADIUS, z1: z1 + SPIELER_RADIUS });
  }
  return aus;
}

/** Kürzester Weg zur Fassade, einschließlich konkaver Grundrisse und gedrehter Giebel. */
function vonWandAbruecken(x: number, z: number, g: Grundriss): [number, number] | null {
  if (x <= g.x0 || x >= g.x1 || z <= g.z0 || z >= g.z1) return null;
  let d2 = Infinity, randX = x, randZ = z, nx = 0, nz = 0;
  for (let i = 0, j = g.ring.length - 1; i < g.ring.length; j = i++) {
    const [ax, az] = g.ring[j], [bx, bz] = g.ring[i];
    const dx = bx - ax, dz = bz - az, laenge2 = dx * dx + dz * dz;
    if (laenge2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / laenge2));
    const rx = ax + t * dx, rz = az + t * dz, abstand2 = (x - rx) ** 2 + (z - rz) ** 2;
    if (abstand2 >= d2) continue;
    d2 = abstand2; randX = rx; randZ = rz;
    nx = dz * g.umlauf; nz = -dx * g.umlauf;
  }
  const innen = imPolygon([x, z], g.ring);
  if (!innen && d2 >= SPIELER_RADIUS ** 2 - 1e-10) return null;
  if (d2 > 1e-12) {
    const seite = innen ? -1 : 1;
    nx = (x - randX) * seite; nz = (z - randZ) * seite;
  }
  const schub = SPIELER_RADIUS / Math.hypot(nx, nz);
  return [randX + nx * schub, randZ + nz * schub];
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
  const bauten = new Map<number, Grundriss[]>();
  let anzahl = 0;

  const grundrisse = welt ? baueGrundrisse(welt, breiteMeter, tiefeMeter) : [];
  for (const r of grundrisse) {
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
    gebaeude: grundrisse.length,
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
        // Häuser liegen in jeder von ihnen berührten Rasterzelle, auch in Zellen ohne Stamm.
        const haeuser = bauten.get(schluessel(Math.floor(x / ZELLE), Math.floor(z / ZELLE)));
        if (haeuser) for (const haus of haeuser) {
          const korrigiert = vonWandAbruecken(x, z, haus);
          if (korrigiert) { [x, z] = korrigiert; bewegt = true; }
        }
        if (!bewegt) break;
      }
      return [x, z];
    },
  };
}
