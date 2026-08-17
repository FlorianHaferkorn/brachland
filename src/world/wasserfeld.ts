/**
 * BRACHLAND — Wo steht Wasser, und wie tief?
 *
 * Gebraucht für das Waten: Die Figur muss jedes Bild wissen, ob sie im Bach steht.
 *
 * **Warum nicht das Biom-Raster?** Weil es die Frage nicht beantworten kann. Eine
 * Rasterzelle ist 15,6 m breit, ein Bach 4 m. Die Zelle ist entweder ganz Wasser
 * oder gar nicht — im Spiel wäre das ein 15 m breiter Streifen Watgebiet um einen
 * 4 m breiten Bach. Genau an dieser Verwechslung ist der erste Anlauf von
 * `tools/wassercheck.ts` gescheitert.
 *
 * Stattdessen exakt gegen die OSM-Linien, aus denen auch die Wassergeometrie
 * gebaut wird. Damit ist die Wasserlinie im Bild dieselbe wie die im Spiel.
 *
 * Die Kosten trägt ein Bucket-Raster: 9.500 Segmente in 32-m-Zellen, je Abfrage
 * neun Zellen. Ein Ganz-Feld-Raster wäre die naheliegende Alternative gewesen und
 * hätte bei brauchbarer Auflösung mehrere MB gekostet — für eine Information, die
 * auf 39 km Bachlauf verteilt fast überall „nein" lautet.
 */
import type { Weltdaten } from './osm.js';
import { MASSSTAB } from './terrain.js';

/**
 * Wassertiefe in der Bachmitte, je OSM-Art.
 *
 * Hüfthoch, nicht schwimmtief: Das Œntal führt Gebirgsbäche. Die Zahl ist eine
 * Setzung — OSM liefert keine Tiefen — und sie ist so gewählt, dass Waten spürbar
 * ist, ohne dass man ertrinkt.
 */
const TIEFE: Record<string, number> = { river: 1.6, stream: 0.85, ditch: 0.45 };
const TIEFE_STANDARD = 0.6;

/** Kantenlänge einer Bucket-Zelle. Deutlich größer als jede Gewässerbreite. */
const BUCKET = 32;

interface Segment { ax: number; az: number; bx: number; bz: number; halbe: number; tiefe: number }

export interface Wasserfeld {
  /**
   * Wassertiefe an einem Punkt in Metern. 0 heißt trocken.
   *
   * Der Verlauf ist quer zum Lauf glockenförmig: am Ufer 0, in der Mitte voll.
   * Eine Stufenkante würde sich beim Hineingehen anfühlen, als fiele man in ein
   * Loch — und sie stimmte auch nicht mit der Färbung der Wassergeometrie überein,
   * die denselben Querverlauf benutzt.
   */
  tiefeAn(x: number, z: number): number;
  /** Nur zur Kontrolle in Werkzeugen. */
  segmente: number;
}

/** Abstand eines Punktes zu einer Strecke, im Quadrat (spart die Wurzel). */
function abstandQ(px: number, pz: number, s: Segment): number {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const lq = dx * dx + dz * dz;
  const t = lq > 0 ? Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / lq)) : 0;
  const qx = s.ax + dx * t - px, qz = s.az + dz * t - pz;
  return qx * qx + qz * qz;
}

export function baueWasserfeld(
  welt: Weltdaten, breiteMeter: number, tiefeMeter: number,
): Wasserfeld {
  const [sued, west, nord, ost] = welt.bbox;
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * tiefeMeter,
  ];

  const eimer = new Map<number, Segment[]>();
  const schluessel = (cx: number, cz: number) => cx * 100_000 + cz;
  let anzahl = 0;

  for (const linie of welt.linien) {
    // Dieselbe halbe Breite wie in `baueGewaesser` — sonst liegt die Wasserlinie
    // im Bild woanders als die im Spiel.
    const halbe = linie.breite / (2 * MASSSTAB.stauchung);
    const tiefe = TIEFE[linie.art] ?? TIEFE_STANDARD;
    for (let k = 0; k < linie.punkte.length - 1; k++) {
      const [ax, az] = zuWelt(...linie.punkte[k]);
      const [bx, bz] = zuWelt(...linie.punkte[k + 1]);
      const s: Segment = { ax, az, bx, bz, halbe, tiefe };
      anzahl++;
      // In alle Zellen eintragen, die das Segment berührt — die Abfrage schaut
      // nur in die Zelle des Punktes und ihre acht Nachbarn.
      const cx0 = Math.floor(Math.min(ax, bx) / BUCKET), cx1 = Math.floor(Math.max(ax, bx) / BUCKET);
      const cz0 = Math.floor(Math.min(az, bz) / BUCKET), cz1 = Math.floor(Math.max(az, bz) / BUCKET);
      for (let cx = cx0; cx <= cx1; cx++)
        for (let cz = cz0; cz <= cz1; cz++) {
          const k2 = schluessel(cx, cz);
          const liste = eimer.get(k2);
          if (liste) liste.push(s); else eimer.set(k2, [s]);
        }
    }
  }

  return {
    segmente: anzahl,
    tiefeAn(x: number, z: number): number {
      const cx = Math.floor(x / BUCKET), cz = Math.floor(z / BUCKET);
      let beste = 0;
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const liste = eimer.get(schluessel(cx + a, cz + b));
          if (!liste) continue;
          for (const s of liste) {
            const dq = abstandQ(x, z, s);
            if (dq >= s.halbe * s.halbe) continue;
            // Querverlauf: 1 in der Mitte, 0 am Ufer. Wurzel, damit die flache
            // Zone am Ufer schmal bleibt — sonst watet man drei Meter im Nichts.
            const t = 1 - Math.sqrt(dq) / s.halbe;
            beste = Math.max(beste, s.tiefe * Math.sqrt(t));
          }
        }
      }
      return beste;
    },
  };
}
