/**
 * BRACHLAND — Auftragsfortschritt
 *
 * Die Story-Struktur legt fest: kritischer Pfad plus Fundstücke, kein Quest-Hub,
 * keine Dialogbäume. Fundstücke stehen seit G-42; was fehlte, war der Pfad — etwas,
 * dem man folgen kann, statt nur etwas, das man findet.
 *
 * **Der Fortschritt wird abgeleitet, nicht mitgeschrieben.** Ob drei Sporenhähne
 * besiegt sind, steht bereits im Spielstand: `besiegt` enthält die IDs der
 * verbrauchten Vorkommen, und eine Vorkommen-ID beginnt mit dem Kreaturnamen
 * (`sporenhahn:12:47`). Ein eigener Zähler wäre eine zweite Wahrheit über
 * denselben Sachverhalt — und die driftet, sobald irgendwo ein `+1` fehlt.
 *
 * Gespeichert wird deshalb nur das, was NICHT ableitbar ist: welche Aufträge
 * angenommen und welche Belohnungen abgeholt wurden.
 *
 * Reines Modul ohne three.js und React (`tests/auftraege.test.ts`).
 */
import type { Auftrag, Auftragsziel } from '../data/schema.js';

/** Was der Spielstand über einen Auftrag weiß. */
export type Auftragsstand = 'unbekannt' | 'angenommen' | 'abgeholt';

/**
 * Der Teil des Spielstands, den die Auswertung braucht.
 *
 * Bewusst als eigenes, kleines Interface statt als `Spielstand`: Damit hängt das
 * Modul nicht an IndexedDB und lässt sich mit vier Zeilen Testdaten prüfen.
 */
export interface Taten {
  /** IDs besiegter Vorkommen, Format `kreatur:i:j`. */
  besiegt: readonly string[];
  /** IDs gefangener Vorkommen, gleiches Format. */
  gefangen: readonly string[];
  /** Gelesene Fragmente. */
  fragmente: readonly string[];
  /** Besiegte Regenten. */
  regenten: readonly string[];
}

/** Wie viele Vorkommen einer Kreatur in dieser Liste stehen. */
function zaehle(ids: readonly string[], kreatur: string): number {
  // Auf den Doppelpunkt prüfen, nicht nur auf das Präfix: Sonst zählte
  // `schneehuhn` auch `schneehuhn-alt`, und solche IDs gibt es irgendwann.
  const praefix = `${kreatur}:`;
  return ids.filter(id => id.startsWith(praefix)).length;
}

/** Stand und Soll eines Ziels — beides, weil die Anzeige beides braucht. */
export interface Fortschritt {
  ist: number;
  soll: number;
  erfuellt: boolean;
}

export function werteZiel(ziel: Auftragsziel, t: Taten): Fortschritt {
  switch (ziel.art) {
    case 'besiege': {
      const ist = Math.min(ziel.anzahl, zaehle(t.besiegt, ziel.kreatur));
      return { ist, soll: ziel.anzahl, erfuellt: ist >= ziel.anzahl };
    }
    case 'fange': {
      const ist = Math.min(ziel.anzahl, zaehle(t.gefangen, ziel.kreatur));
      return { ist, soll: ziel.anzahl, erfuellt: ist >= ziel.anzahl };
    }
    case 'finde': {
      const ist = t.fragmente.includes(ziel.fragment) ? 1 : 0;
      return { ist, soll: 1, erfuellt: ist === 1 };
    }
    case 'regent': {
      const ist = t.regenten.includes(ziel.regent) ? 1 : 0;
      return { ist, soll: 1, erfuellt: ist === 1 };
    }
  }
}

/** Ein Ziel in einem Satz — das, was unter dem Auftragstitel steht. */
export function zielText(ziel: Auftragsziel, f: Fortschritt): string {
  switch (ziel.art) {
    case 'besiege': return `${ziel.kreatur} besiegen · ${f.ist}/${f.soll}`;
    case 'fange':   return `${ziel.kreatur} fangen · ${f.ist}/${f.soll}`;
    case 'finde':   return f.erfuellt ? 'Fundstück gelesen' : 'ein Fundstück lesen';
    case 'regent':  return f.erfuellt ? 'Regent besiegt' : 'den Regenten besiegen';
  }
}

export type Lage = 'gesperrt' | 'offen' | 'angenommen' | 'erfuellt' | 'abgeholt';

/**
 * Wo steht ein Auftrag gerade?
 *
 * `erfuellt` heißt: Die Bedingung stimmt, die Belohnung liegt aber noch beim
 * Geber. Das ist der Zustand, der den Rückweg begründet — ohne ihn wäre ein
 * Auftrag mit dem letzten Schlag zu Ende, und der Auftraggeber ein Automat.
 */
export function lage(
  a: Auftrag, staende: Readonly<Record<string, Auftragsstand>>, t: Taten,
): Lage {
  const eigen = staende[a.id] ?? 'unbekannt';
  if (eigen === 'abgeholt') return 'abgeholt';
  if (a.vorher && (staende[a.vorher] ?? 'unbekannt') !== 'abgeholt') return 'gesperrt';
  if (eigen === 'unbekannt') return 'offen';
  return werteZiel(a.ziel, t).erfuellt ? 'erfuellt' : 'angenommen';
}

/**
 * Die Aufträge eines Gebers, in der Reihenfolge, in der man sie sehen will:
 * abholbereit zuerst, dann laufend, dann neu. Gesperrte und erledigte fallen raus.
 */
export function beiGeber(
  alle: readonly Auftrag[], geber: string,
  staende: Readonly<Record<string, Auftragsstand>>, t: Taten,
): { auftrag: Auftrag; lage: Lage; fortschritt: Fortschritt }[] {
  const rang: Record<string, number> = { erfuellt: 0, angenommen: 1, offen: 2 };
  return alle
    .filter(a => a.geber === geber)
    .map(a => ({ auftrag: a, lage: lage(a, staende, t), fortschritt: werteZiel(a.ziel, t) }))
    .filter(e => e.lage !== 'gesperrt' && e.lage !== 'abgeholt')
    .sort((x, y) => (rang[x.lage] ?? 9) - (rang[y.lage] ?? 9));
}
