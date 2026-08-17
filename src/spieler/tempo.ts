/**
 * BRACHLAND — Fortbewegungstempi an einer Stelle
 *
 * ## Warum diese Datei existiert
 *
 * Dieselbe Zahl stand an drei Orten und war an allen dreien verschieden:
 *
 * | Quelle | gehen | rennen |
 * |---|---|---|
 * | `RegionsSzene.tsx` (der Code, der läuft) | 4,2 | 11,0 |
 * | Ledger D18 (die Entscheidung) | 3,0 | 7,0 |
 * | `tools/masstab.ts` (die Messung) | 1,4 | 5,0 |
 *
 * `npm run masstab` meldete deshalb „Querung gehen 48 min" für ein Spiel, in dem
 * man 16 min braucht — die Messung beschrieb einen Fußgänger, den es nicht gibt.
 * Aufgefallen ist es erst, als `tools/gleitcheck.ts` den Gleitflug gegen den
 * Fußweg rechnen sollte und dafür ein Renntempo brauchte.
 *
 * Ein reines Modul ohne three.js und React, damit die Werkzeuge es importieren
 * können — dieselbe Bauart wie `ausdauer.ts` und `spiel/reiten.ts`. Wer die Zahl
 * ändert, ändert sie hier, und Spiel wie Messung ziehen mit.
 */

/**
 * Gehen und Rennen in Metern je Sekunde.
 *
 * Schneller als der Mensch (1,4 bzw. 5,0). Das ist eine bewusste Abweichung vom
 * 1:1-Maßstab an genau einer Stelle: Die Region ist 4 km breit, und bis es
 * Traversal gibt, ist der Weg sonst reine Wartezeit (Ledger G-27, D18).
 *
 * D18 nennt 3,0 und 7,0 — das war der erste Wurf. Der Code steht seit dem
 * Traversal-Umbau auf 4,2 und 11,0, und **der Code gewinnt**: Er ist die Fassung,
 * die jemand gespielt hat. Der Ledger-Eintrag ist entsprechend nachgezogen.
 */
export const GEHEN = 4.2;
export const RENNEN = 11.0;

/** Schwerkraft in m/s² und Absprunggeschwindigkeit in m/s. */
export const SCHWERKRAFT = 9.81;
export const ABSPRUNG = 5.4;

/** Scheitelhöhe eines Sprungs in Metern: v² / 2g. */
export const SPRUNGHOEHE = (ABSPRUNG * ABSPRUNG) / (2 * SCHWERKRAFT);

/**
 * Wie lange man für eine Strecke braucht, in Sekunden.
 *
 * Mit Umwegfaktor, weil niemand die Luftlinie geht: Gelände, Steigungsgrenze und
 * Gewässer machen aus jeder geraden Linie einen Bogen. 1,4 ist der übliche
 * Anhaltswert für offenes Gelände und die Annahme, mit der `gleitcheck.ts`
 * rechnet — sie steht hier, damit beide Seiten dieselbe benutzen.
 */
export const UMWEGFAKTOR = 1.4;

export function fussweg(meter: number, rennend = true): number {
  return (meter * UMWEGFAKTOR) / (rennend ? RENNEN : GEHEN);
}
