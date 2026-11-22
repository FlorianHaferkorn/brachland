/**
 * BRACHLAND — Fall, Aufprall und Kälte (D412)
 *
 * Drei Regeln aus der Physik-Prüfung (`docs/design/BRACHLAND_Physik-Pruefung_v1.md` §4.4, §4.6,
 * §5 (a)), entschieden von Flo am 22.11.2026 (D411):
 *
 * 1. **Endgeschwindigkeit.** Ohne Gleiter fällt man höchstens mit 53 m/s. Bis D412 nannte der
 *    Kommentar in `gleiten.ts` 50 m/s, der Code begrenzte nichts — aus 500 m kam man mit 99 m/s an.
 * 2. **Fallschaden.** Es gab keinen, und nirgends stand, dass das Absicht war. Jetzt: schadlos bis
 *    4,5 m (reale 1,5 m mal Faktor 3 der Beine), tödlich ab 15 m (ohne Faktor), dazwischen linear;
 *    eine Rolle in der Landung halbiert den Schaden darunter, nicht den Tod darüber.
 * 3. **Kälteuhr.** Treiben im tiefen Wasser kostete nichts. Jetzt sinkt das Leben nach rund 4 min
 *    und ist nach rund 10 min aufgebraucht (reale rund 30 min durch den Zeitfaktor 3); das Ufer setzt
 *    die Uhr zurück, das Tauchzeug ist auch Anzug und hält sie an.
 *
 * **Gemessen wird der Aufprall, nicht die Höhe.** Der Schaden hängt an der Geschwindigkeit beim
 * Aufsetzen, umgerechnet in die gleichwertige Fallhöhe `v² / 2g`. Sonst nähme ein Gleiterflug aus
 * 300 m Schaden, obwohl er mit 4 m/s landet (= 0,82 m, unter jeder Schwelle) — und die Rechnung
 * ist auch die ehrliche: Den Knochen ist egal, wo der Fall begann.
 *
 * Alle Werte aus `content/bewegung.json`. Reines Modul ohne three.js und React
 * (`tests/bewegung.test.ts`); die Bildschleife in `RegionsSzene.tsx` ruft nur diese Funktionen.
 *
 * **Leben ausserhalb des Kampfs gibt es noch nicht** (Leben lebt in `kampf/echtzeit.ts`, je Kampf
 * voll). Die Funktionen geben deshalb einen **Anteil** des Lebens zurück; die Szene meldet ihn, und
 * nur „tödlich“ hat heute eine Folge (Aufwachen in der letzten Zuflucht wie nach einer Niederlage,
 * D179). Arbeitswerte, nicht am M1 gespielt.
 */
import { BEWEGUNG, SCHWERKRAFT } from './tempo.js';

const FALL = BEWEGUNG.fall;
const KAELTE = BEWEGUNG.kaelte;

/** Endgeschwindigkeit im freien Fall, m/s (Physik-Prüfung v1 §5 (a)). */
export const FALL_MAX = FALL.endgeschwindigkeit;

/**
 * Senkrechte Geschwindigkeit nach der Endgeschwindigkeit begrenzen. Nur nach unten — ein Sprung
 * nach oben (5,4 m/s) liegt ohnehin weit darunter, und Aufwind gibt es nicht.
 */
export function begrenzeFall(steigen: number): number {
  return Math.max(-FALL_MAX, steigen);
}

/** Gleichwertige Fallhöhe einer Aufprallgeschwindigkeit, m: `v² / 2g`. */
export function fallhoeheAus(aufprall: number): number {
  const v = Math.max(0, aufprall);
  return (v * v) / (2 * SCHWERKRAFT);
}

/**
 * Schaden eines Aufpralls als Anteil des vollen Lebens, 0 … 1.
 *
 * `aufprall` ist der Betrag der Fallgeschwindigkeit beim Aufsetzen (m/s). Bis `schadlosBis`
 * nichts, ab `toedlichAb` genau 1 (tödlich, auch mit Rolle), dazwischen linear; eine Rolle
 * multipliziert den Schaden darunter mit `rolle` (0,5).
 */
export function fallschaden(aufprall: number, gerollt = false): number {
  const h = fallhoeheAus(aufprall);
  // 1e-9: v² / 2g aus einer Höhe zurückgerechnet trifft die Schwelle sonst um eine Rundung daneben.
  if (h <= FALL.schadlosBis + 1e-9) return 0;
  if (h >= FALL.toedlichAb - 1e-9) return 1;
  const roh = (h - FALL.schadlosBis) / (FALL.toedlichAb - FALL.schadlosBis);
  return gerollt ? roh * FALL.rolle : roh;
}

/** Laufender Zustand der Kälteuhr: Sekunden am Stück im tiefen Wasser. */
export interface Kaelte {
  sekunden: number;
}

export function neueKaelte(): Kaelte {
  return { sekunden: 0 };
}

/**
 * Ein Schritt der Kälteuhr. Rein: alter Zustand rein, neuer raus.
 *
 * - Ausserhalb des tiefen Wassers (am Ufer, im Bach, an Land) steht sie wieder auf null.
 * - Mit Anzug (`kaelte.anzug`, das Tauchzeug) läuft sie nicht — sie bleibt stehen, wo sie ist.
 *   Dass man mit Anzug danach ohne ihn weiterfriert, kommt nicht vor: Den Anzug legt man im Wasser
 *   nicht ab.
 */
export function kaelteSchritt(k: Kaelte, dt: number, imTiefenWasser: boolean, anzug: boolean): Kaelte {
  if (!imTiefenWasser) return k.sekunden === 0 ? k : neueKaelte();
  if (anzug || dt <= 0) return k;
  return { sekunden: k.sekunden + dt };
}

/**
 * Was die Kälte vom Leben übrig lässt, Anteil 0 … 1: voll bis `sinktNach`, dann linear bis null
 * bei `leerNach`.
 */
export function kaelteLeben(k: Kaelte): number {
  if (k.sekunden <= KAELTE.sinktNach) return 1;
  if (k.sekunden >= KAELTE.leerNach) return 0;
  return 1 - (k.sekunden - KAELTE.sinktNach) / (KAELTE.leerNach - KAELTE.sinktNach);
}
