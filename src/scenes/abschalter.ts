/**
 * BRACHLAND — Gruppen abschalten, um zu messen
 *
 * `?aus=fels,gras,baeume,kulisse,haeuser,menschen` lässt die genannten Gruppen weg.
 *
 * ## Wofür das da ist
 *
 * Am 26.08.2026 kamen die ersten Zahlen vom Zielgerät, und sie widersprachen
 * sich scheinbar: An der Felsflanke **177.780 Dreiecke, 155 Aufrufe, p95 21,0 ms**,
 * an einer anderen Stelle **224.818 Dreiecke, 111 Aufrufe, p95 18,0 ms**. Weniger
 * Geometrie, mehr Aufrufe, schlechteres Bild. Daraus lässt sich nichts schließen:
 * Es sind zwei verschiedene Orte mit zwei verschiedenen Bildinhalten, und neben
 * Dreiecken und Aufrufen steht als dritter Kandidat die **Füllrate** — an der
 * Felsflanke füllt bodennahes Gras zwei Drittel des Bildes.
 *
 * Drei Größen und zwei Messpunkte ergeben keine Antwort. Vier Messungen **am
 * selben Punkt**, bei denen jeweils eine Gruppe fehlt, ergeben eine.
 *
 * ## Warum als Adresse und nicht als Schalter im Menü
 *
 * Dieselbe Begründung wie beim Absetzpunkt (D86): Ein Messlauf muss
 * reproduzierbar sein. Ein Menüschalter ist ein Zustand, den man vergisst; eine
 * Adresse steht im Bildschirmfoto mit drauf.
 *
 * Unbekannte Namen werden stillschweigend ignoriert — ein Tippfehler in der
 * Adresse soll die Szene nicht anhalten.
 */

/** Gruppen, die sich abschalten lassen. */
export type Gruppe = 'fels' | 'gras' | 'baeume' | 'kulisse' | 'haeuser' | 'menschen';

const AUS: ReadonlySet<string> = new Set(
  (typeof location === 'undefined'
    ? ''
    : new URLSearchParams(location.search).get('aus') ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
);

/** Ist diese Gruppe für den laufenden Messlauf abgeschaltet? */
export function istAus(gruppe: Gruppe): boolean {
  return AUS.has(gruppe);
}

/** Was gerade fehlt — für die Anzeige, damit ein Bildschirmfoto selbsterklärend ist. */
export function abgeschaltet(): string[] {
  return [...AUS];
}
