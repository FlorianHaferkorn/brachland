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
 * können — dieselbe Bauart wie `ausdauer.ts` und `spiel/reiten.ts`.
 *
 * **Seit D412 stehen die Zahlen in `content/bewegung.json`** (Schema `Bewegung`), je mit
 * Realwert und Begründung der Abweichung (D398). Wer eine ändert, ändert sie dort, und
 * Spiel wie Messung ziehen mit; dieses Modul reicht sie nur unter den alten Namen weiter.
 */
import BEWEGUNG_ROH from '../../content/bewegung.json';
import type { Bewegung } from '../data/schema.js';

/** Die Bewegungswerte, geprüft von `npm run validate`. */
export const BEWEGUNG = BEWEGUNG_ROH as Bewegung;

/**
 * Renntempo aus der Adresse, für den Vergleich am M1 (D411: „Rennen 7,0 gegen 8,5 probieren“).
 *
 * `?renntempo=7` oder `?renntempo=8.5` (auch `7,0`). Zugelassen ist nur, was in
 * `laufen.rennenProbe` steht — ein Tippfehler in der Adresse soll kein drittes Tempo
 * erfinden, das dann jemand für einen Spielwert hält. Alles andere gibt den Standard.
 * Muster wie `src/world/echt.ts`: gelesen einmal beim Laden, ohne Adresse (Werkzeuge, Tests)
 * der Standard.
 */
export function renntempoAusAdresse(suche: string, laufen = BEWEGUNG.laufen): number {
  const roh = new URLSearchParams(suche).get('renntempo');
  if (roh === null) return laufen.rennen;
  const wert = Number(roh.replace(',', '.'));
  return laufen.rennenProbe.find(r => Math.abs(r - wert) < 1e-6) ?? laufen.rennen;
}

/**
 * Laufschritt und Rennen in Metern je Sekunde.
 *
 * Der Laufschritt ist schneller als der Mensch geht (1,4): Faktor 3, die eine
 * benannte Abweichung der Bewegung — die Region ist 4 km breit, und der Weg ist sonst
 * reine Wartezeit (Ledger G-27, D18). Die **Strecken** sind 1 : 1.
 *
 * Rennen war 11,0 m/s — schneller als der 100-m-Weltrekord im Mittel, auf Dauer und
 * ohne Ermüdung (Physik-Prüfung v1 §4.7). Seit D411/D412 **8,5 m/s**: Faktor 2 zum
 * Laufschritt, zehrt weiter nicht (D55). Am M1 mit `?renntempo=7` gegen 7,0 zu prüfen.
 */
export const GEHEN = BEWEGUNG.laufen.gehen;
export const RENNEN = renntempoAusAdresse(typeof location === 'undefined' ? '' : location.search);

/**
 * Klettertempo senkrecht in m/s (D412: 2,2 → 1,0, Faktor 3 auf rund 0,3 m/s).
 *
 * Stand bis D412 als Konstante in `RegionsSzene.tsx`. Die Reichweite je voller
 * Ausdauer bleibt (`klettern.reichweite`, 13,75 m); `ausdauer.ts` rechnet die Zehrung
 * daraus, damit Tempo und Reichweite nicht auseinanderlaufen.
 */
export const KLETTERN_TEMPO = BEWEGUNG.klettern.tempo;

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
