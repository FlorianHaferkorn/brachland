/**
 * BRACHLAND — Landezustand der Spielfigur (D458), rein, ohne three.js.
 *
 * D456 hat `Koerper_Landung_Weich` (federt 22 cm) und `Koerper_Landung_Hart` (Hocke 45 cm, Hand am Boden) gebaut;
 * D457 liess sie liegen, weil die Figur keinen Landemoment als Zustand kannte. Hier ist er — **aus der Bewegung
 * abgelesen, nicht neu geregelt**: `spieler/bewegung.ts` (D412) misst den Aufprall als gleichwertige Fallhöhe
 * v²/2g und kennt die schadlose Höhe und die Rolle in der Landung (D413). Daraus:
 *
 * - unter `merklichAb` (ein Absatz, eine Bordsteinkante): **nichts** — die Füsse folgen dem Boden ohnehin;
 * - bis zur schadlosen Höhe (`fall.schadlosBis`): **weich**;
 * - darüber: **hart**;
 * - Rolltaste im Fenster (D413) und der Fall war merklich: **rolle** — seit D461 die Hechtrolle von D460
 *   (`Koerper_Rolle`) ab `rolleAb` (Bild 5: gestreckt in der Luft; Tiefgehen und Abdruck davor entfallen), bei Rate 1.
 *
 * **Kein Spielwert:** Die Landung sperrt keine Eingabe und kostet keine Zeit; bewegt sich die Figur weiter, federt
 * nur der Oberkörper nach, die Beine laufen (Ebenen, D457). Eine Landestarre nach hartem Fall wäre eine Regel —
 * als Vorschlag im Ledger (D458), hier nicht gebaut.
 */
import type { Figurlaufzeit } from '../data/schema.js';

export type Landeart = 'weich' | 'hart' | 'rolle';

/**
 * Art der Landung. `fallhoehe`: gleichwertige Fallhöhe des Aufpralls in m (`fallhoeheAus`), `schadlosBis` aus
 * `content/bewegung.json` `fall`, `gerollt`: `gerolltBeiLandung`. `null`, wenn der Aufprall nicht der Rede wert ist.
 */
export function landeArt(fallhoehe: number, schadlosBis: number, gerollt: boolean, w: Figurlaufzeit['landung']): Landeart | null {
  if (!(fallhoehe >= w.merklichAb)) return null;
  if (gerollt) return 'rolle';
  // 1e-9 wie in `fallschaden`: v²/2g aus einer Höhe zurückgerechnet trifft die Schwelle sonst um eine Rundung daneben.
  return fallhoehe <= schadlosBis + 1e-9 ? 'weich' : 'hart';
}

/** Clip zur Landeart. */
export function landeClip(art: Landeart, w: Figurlaufzeit['landung']): string {
  return art === 'weich' ? w.clipWeich : art === 'hart' ? w.clipHart : w.clipRolle;
}

/** Was die Szene der Figur meldet: `nr` zählt Landungen (ein neuer Wert heisst: Clip von vorn). */
export interface Landung { nr: number; art: Landeart | null; fallhoehe: number }

export const neueLandung = (): Landung => ({ nr: 0, art: null, fallhoehe: 0 });

/** Einen Aufprall eintragen; unmerkliche zählen nicht. */
export function meldeLandung(l: Landung, fallhoehe: number, schadlosBis: number, gerollt: boolean, w: Figurlaufzeit['landung']): Landeart | null {
  const art = landeArt(fallhoehe, schadlosBis, gerollt, w);
  if (art) { l.nr++; l.art = art; l.fallhoehe = fallhoehe; }
  return art;
}

/**
 * Wie lange der Landeclip die Figur hält, Sekunden seit dem Aufsetzen: der ganze Clip im Stand; in Bewegung nur
 * bis `gehtAb` (Anteil des Clips) — danach gehört der Körper wieder dem Gang.
 */
export function landungLaeuft(seit: number, clipDauer: number, bewegt: boolean, w: Figurlaufzeit['landung']): boolean {
  return seit >= 0 && seit < clipDauer * (bewegt ? w.gehtAb : 1);
}
