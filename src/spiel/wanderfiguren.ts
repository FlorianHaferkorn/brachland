/**
 * BRACHLAND — Wanderfiguren: an welcher Station eine Figur gerade steht (D375)
 *
 * Story-Bibel v2 §5: Jede Fraktion hat je Region eine Figur mit eigenem Weg. Sie zieht weiter, und
 * wer zu spät kommt, trifft sie an der alten Station nicht mehr. Hier steht nur diese eine Frage —
 * **wo steht sie jetzt** —, abgeleitet aus dem Spielstand wie der Auftragsfortschritt
 * (`spiel/auftraege.ts`): kein eigener Zähler, kein Skript.
 *
 * Was hier bewusst fehlt: ob man die Figur an einer Station angesprochen hat, ob sie einem traut,
 * ob sie scheitert. Das sind Spielmechaniken, die noch nicht gebaut sind (Entwurf: `docs/design/BRACHLAND_Quests_v1.md`, D392).
 * Seit D392 kennt eine Station den Zähler der Mönche (`eingriffe`).
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
  /** IDs getöteter Vorkommen (`kreatur:i:j`) und der Regenten (`regent:<id>`). Fehlt in alten Aufrufen: leer. */
  besiegt?: readonly string[];
  /** IDs über die Marke gereinigter Vorkommen. Fehlt in alten Aufrufen: leer. */
  gereinigt?: readonly string[];
}

/**
 * Wie oft der Brachgänger eingegriffen hat (D385): Die Mönche zählen ein gereinigtes Tier wie ein getötetes —
 * beides nimmt dem Land etwas. Der Regent zählt nicht mit; über ihn urteilt die Station selbst (`regent`/`heile`).
 * Abgeleitet, nicht mitgeschrieben, wie der Auftragsfortschritt.
 */
export function eingriffe(w: Pick<Weltstand, 'besiegt' | 'gereinigt'>): number {
  const tiere = (ids: readonly string[] = []) => ids.filter(id => !id.startsWith('regent:'));
  return new Set([...tiere(w.besiegt), ...tiere(w.gereinigt)]).size;
}

export function gilt(b: Stationsbedingung, w: Weltstand): boolean {
  switch (b.art) {
    case 'finde':   return w.fragmente.includes(b.fragment);
    case 'regent':  return w.regenten.includes(b.regent);
    case 'heile':   return w.geheilt.includes(b.regent);
    case 'auftrag': return w.auftraege[b.auftrag] === 'abgeholt';
    case 'eingriffe': return eingriffe(w) >= b.anzahl;
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
