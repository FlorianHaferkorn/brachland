/**
 * BRACHLAND — Teamreihenfolge
 *
 * Die Reihenfolge ist keine Kosmetik: Platz 1 zieht in jeden Kampf zuerst ein
 * (`BattleScreen` startet auf `aktiv = 0`), und ein Wechsel kostet den Zug. Wer
 * sein Team nicht ordnen kann, zahlt diesen Zug jedes Mal, wenn der erste Platz
 * gegen das Element des Gegners falsch steht.
 *
 * Warum eine eigene Datei fuer sechs Zeilen: Die Reihenfolge steht an **zwei**
 * Stellen — `stand.team` und `erfahrungRef`, weil die Engine keinen Fortschritt
 * kennt (siehe `sichere()` in `main.tsx`). Beide muessen dieselbe Bewegung
 * machen, sonst traegt nach dem Umsortieren die falsche Kreatur die falsche
 * Erfahrung, und man sieht es erst beim naechsten Stufenaufstieg. Eine gemeinsame
 * Funktion ist der einzige Weg, das zu garantieren; zwei Inline-`splice` sind es
 * nicht.
 */
import { REGELN, type Zustand } from '../engine/battle.js';
import type { NarbenArt } from '../data/schema.js';
import { NARBEN_TEXT } from './gegenstaende.js';

/**
 * Element von `von` nach `nach` schieben. Gibt eine neue Liste zurueck.
 *
 * Ausserhalb liegende Indizes geben die Liste unveraendert zurueck, statt zu
 * werfen: Aufrufer ist eine Oberflaeche, und ein Griff daneben soll keinen
 * Kampf abbrechen.
 */
export function verschiebe<T>(liste: readonly T[], von: number, nach: number): T[] {
  const kopie = [...liste];
  if (von < 0 || von >= kopie.length) return kopie;
  if (nach < 0 || nach >= kopie.length) return kopie;
  if (von === nach) return kopie;
  const [stueck] = kopie.splice(von, 1);
  kopie.splice(nach, 0, stueck);
  return kopie;
}

/**
 * Zustand eines Teammitglieds als Anzeige (D244).
 *
 * Seit G-138 trägt das Team den Befall über den Kampf hinaus — ohne Anzeige wäre das ein
 * Schaden, den man im nächsten Kampf bemerkt und nicht versteht. `kurz` steht am Namen,
 * `lang` sagt, was er kostet und wie man ihn loswird. `signal`: in der einen Signalfarbe
 * zeigen (Art Direction: Befall hat genau eine Farbe). `rein` zeigt nichts.
 */
export function zustandsAnzeige(
  zustand: Zustand, narbe?: { art: NarbenArt },
): { kurz: string; lang: string; signal: boolean } | null {
  switch (zustand) {
    case 'rein': return null;
    case 'befallen': return {
      kurz: 'befallen', signal: true,
      lang: `stärker, verliert aber im Feld jede Runde ${Math.round(REGELN.ZEHRUNG * 100)} % KP — eine Reinigung führt ihn zurück`,
    };
    case 'rueckgefuehrt': return {
      kurz: 'zurückgeführt', signal: false,
      lang: narbe ? `Narbe: ${NARBEN_TEXT[narbe.art]}` : 'trägt eine Narbe',
    };
    case 'verhaertet': return { kurz: 'verhärtet', signal: true, lang: 'lässt sich nicht mehr zurückführen' };
  }
}
