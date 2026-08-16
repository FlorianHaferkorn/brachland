/**
 * BRACHLAND — Kreaturvorkommen in der Welt
 *
 * Kreaturen werden nicht platziert, sie folgen aus den Kartendaten: `baueSpawns`
 * liefert je Kreatur die Rasterzellen, die zu ihrem OSM-Tag und ihrem Höhenband
 * passen. Hier wird daraus eine konkrete, **deterministische** Menge von Vorkommen.
 *
 * Deterministisch heißt: gleicher Seed, gleiche Welt, gleiche Kreaturen an gleicher
 * Stelle — über Sitzungen und Geräte hinweg. Gespeichert wird deshalb nur, was der
 * Spieler *getan* hat (gefangen, besiegt), nie wo etwas steht. Das ist dieselbe
 * Rechnung wie bei den Props: 155.000 Positionen zu speichern wäre für eine
 * Offline-PWA absurd, sie neu zu würfeln wäre nicht wiedererkennbar.
 */
import { baueSpawns, type Weltdaten } from './osm.js';
import { mulberry } from './props.js';
import { wildStufe, mutationBei } from '../spiel/fortschritt.js';

export interface Vorkommen {
  /** Stabil über Sitzungen — Schlüssel für „schon gefangen“. */
  id: string;
  kreatur: string;
  /**
   * Erfahrungsstufe 1…40. Die Mutation folgt daraus.
   *
   * Höhere Stufen stehen weiter draußen — Schwierigkeit folgt dem Weg, nicht dem
   * Würfel (Ledger D33).
   */
  stufe: number;
  /** Mutation 0…2, abgeleitet aus Stufe und Länge der Linie. Für die Gestalt. */
  mutation: number;
  position: [number, number, number];
  drehung: number;
}

/**
 * Kreaturen je Quadratkilometer geeigneten Geländes.
 *
 * Bewusst als **Flächendichte**, nicht als Anteil der Rasterzellen: Sonst hängt die
 * Zahl der Kreaturen an der Auflösung des Weltrasters. Beim Wechsel von 96 auf 256
 * Zellen wären aus 1.000 Kreaturen über Nacht 7.000 geworden — dieselbe Region,
 * dieselbe Regel, siebenfacher Besatz.
 *
 * 55 je km² im Wald heißt: im Schnitt alle ~130 m eine. Dichter wirkt wie ein Zoo,
 * dünner findet man beim Spielen nichts.
 */
const JE_KM2: Record<string, number> = {
  haeufig: 55, gelegentlich: 28, selten: 11, fest: 0,
};

/**
 * Innerhalb dieses Radius um die Regionsmitte steht ausschliesslich Stufe 1.
 *
 * Ohne harte Grenze bleibt eine Restwahrscheinlichkeit — und die traf beim Messen
 * ausgerechnet die naechstgelegene Kreatur (Hallenbrut S3 in 96 m). Der Startbereich
 * ist der einzige Ort, an dem eine Ausnahme den ganzen Einstieg kaputtmacht.
 */
const STARTBEREICH = 150;

/**
 * Die Erfahrungsstufe folgt der Entfernung (`wildStufe`), die Mutation folgt der
 * Stufe. Beides läuft damit über **eine** Regel statt über zwei Würfe, und der
 * frühere Sonderfall „Mutation 3 direkt neben dem Startpunkt" kann nicht mehr
 * auftreten.
 */

export interface KreaturSpawn {
  id: string;
  stufen: unknown[];
  spawn: {
    osmTag?: string; minHoehe?: number; maxHoehe?: number;
    haeufigkeit: string; position?: [number, number];
  };
}

export function verteileKreaturen(
  welt: Weltdaten,
  kreaturen: KreaturSpawn[],
  rasterZuWelt: (i: number, j: number) => [number, number],
  hoeheAn: (x: number, z: number) => number,
  breiteMeter: number,
  tiefeMeter: number,
  seed = 7,
): Vorkommen[] {
  const zonen = baueSpawns(welt, kreaturen);
  const nachId = new Map(kreaturen.map(k => [k.id, k]));
  const zellBreite = breiteMeter / (welt.aufloesung - 1);
  const zellTiefe = tiefeMeter / (welt.aufloesung - 1);

  const zufall = mulberry(seed);
  const raus: Vorkommen[] = [];

  for (const zone of zonen) {
    const k = nachId.get(zone.kreatur);
    if (!k) continue;
    const zellFlaecheKm2 = (zellBreite * zellTiefe) / 1e6;
    const anteil = zone.haeufigkeit === 'fest'
      ? 1
      : Math.min(1, (JE_KM2[zone.haeufigkeit] ?? 28) * zellFlaecheKm2);

    for (const [i, j] of zone.zellen) {
      if (zufall() >= anteil) continue;
      const [zx, zz] = rasterZuWelt(i, j);
      // Innerhalb der Zelle versetzen, sonst stehen alle auf einem Gitter.
      const x = zx + (zufall() - 0.5) * zellBreite;
      const z = zz + (zufall() - 0.5) * zellTiefe;
      const abstand = Math.hypot(x, z);
      // Im Startbereich bleibt es bei den untersten Stufen — dort entscheidet die
      // erste Begegnung, ob jemand weiterspielt.
      const stufe = abstand < STARTBEREICH
        ? Math.max(1, Math.min(5, Math.round(2 + zufall() * 3)))
        : wildStufe(abstand, zufall());
      raus.push({
        id: `${zone.kreatur}:${i}:${j}`,
        kreatur: zone.kreatur,
        stufe,
        mutation: mutationBei(stufe, k.stufen.length),
        position: [x, hoeheAn(x, z), z],
        drehung: zufall() * Math.PI * 2,
      });
    }
  }
  return raus;
}
