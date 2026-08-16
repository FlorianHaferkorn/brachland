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

export interface Vorkommen {
  /** Stabil über Sitzungen — Schlüssel für „schon gefangen“. */
  id: string;
  kreatur: string;
  /** 0-basiert. Höhere Stufen sind seltener und stehen abseits. */
  stufe: number;
  position: [number, number, number];
  drehung: number;
}

/**
 * Anteil der geeigneten Zellen, in denen tatsächlich eine Kreatur steht.
 *
 * Eine Zelle ist im Œntal ~42 m breit. `haeufig` = jede zehnte Zelle heißt: im Wald
 * steht im Schnitt alle ~130 m eine Kreatur. Dichter wirkt wie ein Zoo, dünner
 * findet man beim Spielen nichts.
 */
const ANTEIL: Record<string, number> = {
  haeufig: 0.10, gelegentlich: 0.05, selten: 0.02, fest: 1,
};

/** Wahrscheinlichkeit für Stufe 2 bzw. 3, wenn die Linie sie hat — am Rand der Region. */
const STUFE2 = 0.26;
const STUFE3 = 0.08;

/**
 * Ab dieser Entfernung von der Regionsmitte sind höhere Stufen voll wahrscheinlich.
 *
 * Der Grund ist der erste Kampf: Startet man mit einem Grathorn auf Stufe 1 (130 KP)
 * und steht 90 m weiter eine Hallenbrut auf Stufe 3 (156/94/62/72), ist der Einstieg
 * eine Wand. Schwierigkeit soll aus der Entfernung folgen, nicht aus dem Würfel —
 * das ist dieselbe Logik wie beim Traversal: Der Weg ist die Fortschrittskurve.
 */
const STUFEN_ABSTAND = 700;

/**
 * Innerhalb dieses Radius um die Regionsmitte steht ausschliesslich Stufe 1.
 *
 * Ohne harte Grenze bleibt eine Restwahrscheinlichkeit — und die traf beim Messen
 * ausgerechnet die naechstgelegene Kreatur (Hallenbrut S3 in 96 m). Der Startbereich
 * ist der einzige Ort, an dem eine Ausnahme den ganzen Einstieg kaputtmacht.
 */
const STARTBEREICH = 150;

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
    const maxStufe = k.stufen.length - 1;
    const anteil = ANTEIL[zone.haeufigkeit] ?? 0.05;

    for (const [i, j] of zone.zellen) {
      if (zufall() >= anteil) continue;
      const [zx, zz] = rasterZuWelt(i, j);
      // Innerhalb der Zelle versetzen, sonst stehen alle auf einem Gitter.
      const x = zx + (zufall() - 0.5) * zellBreite;
      const z = zz + (zufall() - 0.5) * zellTiefe;
      const w = zufall();
      const abstand = Math.hypot(x, z);
      const naehe = abstand < STARTBEREICH ? 0 : Math.min(1, abstand / STUFEN_ABSTAND);
      const p2 = STUFE2 * naehe;
      const p3 = STUFE3 * naehe * naehe;
      const stufe = maxStufe >= 2 && w < p3 ? 2 : maxStufe >= 1 && w < p2 ? 1 : 0;
      raus.push({
        id: `${zone.kreatur}:${i}:${j}`,
        kreatur: zone.kreatur,
        stufe,
        position: [x, hoeheAn(x, z), z],
        drehung: zufall() * Math.PI * 2,
      });
    }
  }
  return raus;
}
