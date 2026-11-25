/**
 * BRACHLAND — Luftzustand der Spielfigur (D461), rein, ohne three.js.
 *
 * D460 hat `Koerper_Sprung_Ab` (Abdruck gestreckt → Flughaltung, 8 Bilder) und `Koerper_Sprung_Flug` (Flughaltung,
 * Schleife) gebaut. Hier ist der Zustand dazu — **aus der Bewegung abgelesen, nicht neu geregelt**: `Spieler` in der
 * Szene meldet je Bild, ob die Figur in der Luft ist und ob sie in diesem Bild abgesprungen ist; die Figur spielt
 *
 * - nach einem **Absprung** erst den Abdruck (einmal, seine ganze Länge), dann die Flughaltung;
 * - nach einer **Kante ohne Absprung** die Flughaltung, aber erst nach `fallAb` Sekunden in der Luft — ein Absatz
 *   oder eine Bodenwelle ist kein Flug, und die Füsse folgen dort ohnehin dem Boden;
 * - am Boden nichts: Das Aufsetzen ist die Landung (`landung.ts`, D458).
 *
 * **Kein Spielwert:** Absprungtempo, Schwerkraft und Sprunghöhe stehen in `content/bewegung.json` und werden hier
 * nicht gelesen. **Benannte Abweichung (D398):** Die Regel hebt die Figur im Bild des Tastendrucks ab — sie geht nicht
 * erst in die Knie. Der Abdruck-Clip läuft deshalb, während sie schon steigt; ein echter Absprung braucht 0,2–0,3 s
 * Beugen und Strecken am Boden. Das zu zeigen hiesse, den Sprung zu verzögern (Spielwert) — hier nicht gebaut.
 */
import type { Figurlaufzeit } from '../data/schema.js';

/** Was die Szene der Figur meldet: `nr` zählt Flüge (ein neuer Wert heisst: Clip von vorn). */
export interface Luft { nr: number; inLuft: boolean; absprung: boolean; seit: number }

export const neueLuft = (): Luft => ({ nr: 0, inLuft: false, absprung: false, seit: 0 });

/**
 * Ein Bild eintragen. `inLuft`: die Figur hat nach diesem Bild keinen Boden unter sich (nicht im Wasser, nicht am
 * Fels, nicht am Gleiter, nicht im Sattel). `absprung`: in diesem Bild hat die Regel den Sprung ausgelöst.
 */
export function meldeLuft(l: Luft, inLuft: boolean, absprung: boolean, dt: number): void {
  if (absprung && inLuft) { l.nr++; l.inLuft = true; l.absprung = true; l.seit = 0; return; }
  if (!inLuft) { l.inLuft = false; l.absprung = false; l.seit = 0; return; }
  if (!l.inLuft) { l.nr++; l.inLuft = true; l.absprung = false; l.seit = 0; return; }
  l.seit += Math.max(0, dt);
}

export type Luftbild = 'ab' | 'flug';

/** Was die Figur in der Luft zeigt; `null` am Boden und in den ersten `fallAb` Sekunden eines Falls ohne Absprung. */
export function luftBild(l: Luft, abDauer: number, w: Figurlaufzeit['sprung']): Luftbild | null {
  if (!l.inLuft) return null;
  if (l.absprung) return l.seit < abDauer ? 'ab' : 'flug';
  return l.seit >= w.fallAb ? 'flug' : null;
}

/** Clip zum Luftbild. */
export function luftClip(bild: Luftbild, w: Figurlaufzeit['sprung']): string {
  return bild === 'ab' ? w.clipAb : w.clipFlug;
}
