/**
 * BRACHLAND — Geräte mit Elementangriffen (D410, Entwurf).
 *
 * Kein zweites Elementsystem: Ein Gerät trägt ein Element aus `ELEMENTE` (`src/data/schema.ts`), und
 * seine Wirkung auf ein Tier folgt demselben Kreis wie Moves und Kernfunke — gedämpft mit der Wurzel,
 * genau wie `funkenFaktor` in `echtzeit.ts` (D189): Ein Gerät ist ein Zuschlag, kein Ersatz für den Hieb.
 *
 * Rein, ohne three.js und React. Das Spiel liest dieses Modul nicht; `echtzeit.ts` kennt keine Geräte.
 */
import { schadensfaktor, type Element, type Geraete } from '../data/schema.js';

export type Geraet = Geraete[number];
export type Aufsatz = Geraet['aufsaetze'][number];

/** Faktor eines Elements gegen ein Ziel mit diesen Elementen: √ des Kreisfaktors (1,41 · 1 · 0,71). Ohne Element 1. */
export function elementFaktor(element: Element, ziel: readonly Element[] | undefined): number {
  return ziel?.length ? Math.sqrt(schadensfaktor(element, [...ziel])) : 1;
}

export type Wirkung = 'stark' | 'neutral' | 'schwach';
export function wirkung(element: Element, ziel: readonly Element[] | undefined): Wirkung {
  const f = elementFaktor(element, ziel);
  return f > 1.05 ? 'stark' : f < 0.95 ? 'schwach' : 'neutral';
}

/** Schaden und Haltungsschaden eines Aufsatzes gegen ein Ziel — in Einheiten des leichten Klingenhiebs. */
export function trifft(g: Geraet, a: Aufsatz, ziel: readonly Element[] | undefined): { schaden: number; haltung: number; zustandSek: number } {
  const f = elementFaktor(g.element, ziel);
  return { schaden: a.schaden * f, haltung: a.haltung * f, zustandSek: a.zustand ? a.dauerSek * f : 0 };
}

/** Wie oft ein Aufsatz mit einer vollen Füllung auslöst. */
export function einsaetze(g: Geraet, a: Aufsatz): number {
  return Math.floor(g.betriebsstoff.jeFuellung / a.verbrauch + 1e-9);
}

/** Kann dieser Aufsatz töten? Was nicht tötet, zählt beim Zähler nicht als Tötung — es öffnet nur das Fenster. */
export function toetet(a: Aufsatz): boolean {
  return a.schaden > 0;
}

/** Die Geräte, die gegen ein Ziel am stärksten wirken (für Anzeige und Tests). */
export function staerkste(geraete: Geraete, ziel: readonly Element[]): string[] {
  const max = Math.max(...geraete.map(g => elementFaktor(g.element, ziel)));
  return geraete.filter(g => elementFaktor(g.element, ziel) === max).map(g => g.id);
}
