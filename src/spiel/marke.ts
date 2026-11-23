/**
 * BRACHLAND — Die Marke im Spielstand (D417)
 *
 * **Was gespeichert wird:** nur `marke.ladung` (Ladungen jetzt) und `gereinigt` (IDs der Gereinigten, wie
 * `besiegt` im Format `kreatur:…`). **Was abgeleitet wird** (Spielstand-Grundsatz, `spielstand.ts` Kopf):
 *
 * - **Läuterung** (D393, `content/oekonomie.json` `marke.laeuterung`): 1 je gereinigtem Tier. Verhärtete
 *   (5) und Regenten (15) gibt es im Echtzeitkampf noch nicht; ihre IDs würden mit `verhaertet:` bzw.
 *   `regent:` beginnen und sind hier schon so gezählt.
 * - **Markenstufe**: Zahl der erreichten Schwellen (25 / 60 / 110 / 170).
 * - **Fassung**: 4 + 2 je besiegtem Regent (`content/reinigen.json`, D379) + 1 je Markenstufe (D393).
 *
 * Ein gespeichertes `fassung`- oder `laeuterung`-Feld wäre eine zweite Wahrheit neben `gereinigt` und
 * `regenten` — die driftet, sobald eine Schwelle in den Daten wandert.
 *
 * **Migration** (`hebeMarke`): `gereinigt` übernimmt alle alten `gefangen` (bis D417 zählten Aufträge mit
 * Ziel `reinige` das Aufnehmen, D375 — niemand verliert Fortschritt), `marke.ladung` startet voll. Der
 * Schritt ist **idempotent** und hängt an keiner Versionsnummer: Er läuft als Migration (`speicherformat.ts`)
 * und noch einmal in `ergaenzeStand`, damit die Reihenfolge der Merges mit D416 (Reviere, ebenfalls v3)
 * egal ist.
 *
 * Renderfrei: `tests/markengriff.test.ts`.
 */
import OEKONOMIE_ROH from '../../content/oekonomie.json';
import REINIGEN_ROH from '../../content/reinigen.json';
import { Oekonomie, ReinigenDaten } from '../data/schema.js';
import { fassung, markenStufe } from './oekonomie.js';

const OEKONOMIE = Oekonomie.parse(OEKONOMIE_ROH);
const REINIGEN = ReinigenDaten.parse(REINIGEN_ROH);

/** Der Teil des Spielstands, an dem die Marke hängt. */
export interface Markenstand {
  gereinigt: readonly string[];
  regenten: readonly string[];
  marke: { ladung: number };
}

export function laeuterung(s: Pick<Markenstand, 'gereinigt'>): number {
  const l = OEKONOMIE.marke.laeuterung;
  let summe = 0;
  for (const id of s.gereinigt) summe += id.startsWith('regent:') ? l.regent : id.startsWith('verhaertet:') ? l.verhaerteter : l.tier;
  return summe;
}

export function stufeDerMarke(s: Pick<Markenstand, 'gereinigt'>): number {
  return markenStufe(laeuterung(s), OEKONOMIE);
}

/** Wie viele Ladungen die Marke fasst. */
export function markenFassung(s: Pick<Markenstand, 'gereinigt' | 'regenten'>): number {
  return fassung(laeuterung(s), s.regenten.length, REINIGEN.fassung, OEKONOMIE);
}

/** Ladung, auf die Fassung begrenzt (eine Fassung kann nicht schrumpfen, aber ein Stand kann von Hand geändert sein). */
export function markenLadung(s: Markenstand): number {
  return Math.max(0, Math.min(markenFassung(s), s.marke.ladung));
}

/** Rast (Reinigen v1 §4 A3, D379): Die Marke füllt sich auf ihre Fassung. */
export function fuelleMarke(s: Pick<Markenstand, 'gereinigt' | 'regenten'>): { ladung: number } {
  return { ladung: markenFassung(s) };
}

/**
 * Migrationsschritt (idempotent): fehlende Felder der Marke aus dem alten Stand ableiten. Ein Stand, der
 * `gereinigt` schon hat, bleibt unverändert — auch wenn `gefangen` danach gewachsen ist (Aufnehmen im
 * Rundenkampf zählt seit D417 nicht mehr als Reinigen).
 */
export function hebeMarke<T extends Record<string, unknown>>(spiel: T): T & { gereinigt: string[]; marke: { ladung: number } } {
  const liste = (w: unknown): string[] => (Array.isArray(w) ? w.filter((x): x is string => typeof x === 'string') : []);
  const gereinigt = Array.isArray(spiel.gereinigt) ? liste(spiel.gereinigt) : [...new Set(liste(spiel.gefangen))];
  const regenten = liste(spiel.regenten);
  const alt = spiel.marke as { ladung?: unknown } | undefined;
  const ladung = alt && typeof alt.ladung === 'number' && Number.isFinite(alt.ladung) ? alt.ladung
    : markenFassung({ gereinigt, regenten });
  return { ...spiel, gereinigt, marke: { ...(alt ?? {}), ladung } };
}
