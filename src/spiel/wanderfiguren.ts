/**
 * BRACHLAND — Wanderfiguren: an welcher Station eine Figur gerade steht (D375)
 *
 * Story-Bibel v2 §5: Jede Fraktion hat je Region eine Figur mit eigenem Weg. Sie zieht weiter, und
 * wer zu spät kommt, trifft sie an der alten Station nicht mehr. Hier steht nur diese eine Frage —
 * **wo steht sie jetzt** —, abgeleitet aus dem Spielstand wie der Auftragsfortschritt
 * (`spiel/auftraege.ts`): kein eigener Zähler, kein Skript.
 *
 * Was hier bewusst fehlt: ob man die Figur an einer Station angesprochen hat, ob sie einem traut,
 * ob sie scheitert. Das sind Spielmechaniken, die noch nicht entworfen sind (Ledger A-24).
 *
 * Reines Modul ohne three.js und React (`tests/wanderfiguren.test.ts`).
 */
import type { Stationsbedingung, Wanderfigur } from '../data/schema.js';

/** Der Teil des Spielstands, den die Auswertung braucht. */
export interface Weltstand {
  /** Gelesene Fragmente. */
  fragmente: readonly string[];
  /** Besiegte Regenten. */
  regenten: readonly string[];
  /** Geheilte Regionen, nach Regenten-ID. */
  geheilt: readonly string[];
  /** Aufträge mit Stand; nur `abgeholt` zählt als erledigt. */
  auftraege: Readonly<Record<string, string>>;
}

export function gilt(b: Stationsbedingung, w: Weltstand): boolean {
  switch (b.art) {
    case 'finde':   return w.fragmente.includes(b.fragment);
    case 'regent':  return w.regenten.includes(b.regent);
    case 'heile':   return w.geheilt.includes(b.regent);
    case 'auftrag': return w.auftraege[b.auftrag] === 'abgeholt';
  }
}

/**
 * Index der Station, an der die Figur steht — oder `null`, wenn sie gerade nirgends ist.
 *
 * Sie hat jede Station verlassen, deren `bis` eingetreten ist. An der nächsten steht sie nur, wenn
 * deren `ab` gilt: Der Bote des Erbes etwa erscheint erst nach dem Wandel. Ist auch die letzte
 * Station verlassen, ist die Figur fort.
 */
export function stationVon(f: Wanderfigur, w: Weltstand): number | null {
  let i = 0;
  while (i < f.stationen.length) {
    const bis = f.stationen[i].bis;
    if (!bis || !gilt(bis, w)) break;
    i++;
  }
  if (i >= f.stationen.length) return null;
  const ab = f.stationen[i].ab;
  return ab && !gilt(ab, w) ? null : i;
}
