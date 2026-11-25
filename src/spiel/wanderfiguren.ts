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
 * Seit D392 kennt eine Station den Zähler der Mönche (`eingriffe`), seit D416 seine Stufe „vertraut“ (`misstraut`).
 *
 * Reines Modul ohne three.js und React (`tests/wanderfiguren.test.ts`).
 */
import type { Stationsbedingung, Wanderfigur } from '../data/schema.js';
import type { Begegnung } from './reviere.js';

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
  /** D416: was der Kampf je Begegnung gemeldet hat (`spiel/reviere.ts` `vermerkeBegegnung`). Fehlt: leer. */
  begegnungen?: readonly Begegnung[];
  /**
   * D416: Anteil unberührter Reviere der Region (0…1, `spiel/reviere.ts` `unberuehrtAnteil`). Fehlt er, gilt 1 —
   * dann entscheidet beim Zähler allein der gewichtete Stand, wie vor D416.
   */
  unberuehrtAnteil?: number;
}

/** Wie schwer ein Eingriff beim Zähler wiegt (D404). Ohne Angabe zählt beides voll, wie vor D405. */
export interface EingriffGewichte { getoetet: number; gereinigt: number }
export const GLEICH_SCHWER: EingriffGewichte = { getoetet: 1, gereinigt: 1 };

/**
 * Wie viel der Brachgänger eingegriffen hat (D385): Die Mönche zählen jedes Tier, das er angefasst hat —
 * beides nimmt dem Land etwas. Seit D404 wiegt Reinigen leichter als Töten; **wie viel**, steht als Daten an
 * der Station (`bis.gewichte` in `content/wanderfiguren/`), nicht hier. Ein Vorkommen zählt einmal, und zwar
 * mit dem schwereren Gewicht, falls es in beiden Listen steht. Der Regent zählt nicht mit; über ihn urteilt die
 * Station selbst (`regent`/`heile`). Abgeleitet, nicht mitgeschrieben, wie der Auftragsfortschritt.
 */
export function eingriffe(w: Pick<Weltstand, 'besiegt' | 'gereinigt' | 'begegnungen'>, gewichte: EingriffGewichte = GLEICH_SCHWER): number {
  const tiere = (ids: readonly string[] = []) => ids.filter(id => !id.startsWith('regent:'));
  const je = new Map<string, number>();
  for (const id of tiere(w.gereinigt)) je.set(id, gewichte.gereinigt);
  for (const id of tiere(w.besiegt)) je.set(id, Math.max(je.get(id) ?? 0, gewichte.getoetet));
  // D416: Gemeldete Begegnungen zählen je Meldung — ein Lager ist nach seiner Ruhe wieder besetzt, dieselbe
  // Gegner-ID heisst dann ein anderes Tier. Steht die ID schon oben (Bestand), zählt sie dort, nicht doppelt.
  let summe = 0;
  for (const b of w.begegnungen ?? []) {
    // D426: Verschont ist kein Eingriff (wie umgangen); ein getöteter Mensch zählt voll wie ein getötetes Tier.
    if (b.art === 'umgangen' || b.art === 'verschont' || je.has(b.gegnerId) || b.gegnerId.startsWith('regent:')) continue;
    summe += b.art === 'getoetet' ? gewichte.getoetet : gewichte.gereinigt;
  }
  for (const g of je.values()) summe += g;
  return summe;
}

export function gilt(b: Stationsbedingung, w: Weltstand): boolean {
  switch (b.art) {
    case 'finde':   return w.fragmente.includes(b.fragment);
    case 'regent':  return w.regenten.includes(b.regent);
    case 'heile':   return w.geheilt.includes(b.regent);
    case 'auftrag': return w.auftraege[b.auftrag] === 'abgeholt';
    case 'eingriffe': return eingriffe(w, b.gewichte) >= b.anzahl - 1e-9;
    // D406/D416: nicht mehr „vertraut“ — über der Schwelle (nicht mehr geduldet) oder zu wenige Reviere unberührt.
    case 'misstraut': return eingriffe(w, b.gewichte) > b.anzahl + 1e-9
      || (w.unberuehrtAnteil ?? 1) < b.unberuehrtMindestens - 1e-9;
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
