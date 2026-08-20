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
