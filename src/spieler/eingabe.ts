/**
 * BRACHLAND — Eingabe als Aktionen (D415)
 *
 * Der Code fragt **Aktionen**, nie Tasten (`docs/design/BRACHLAND_Menue-und-Einstellungen_v1.md` §6.4.1,
 * §8.4). Die Standardbelegung steht als Daten in `content/belegung.json` (Schema `Belegung`); eine freie
 * Belegung legt sich als Übersteuerung je Aktion darüber und wird getrennt vom Spielstand gesichert.
 *
 * **Kontexte statt Verbote.** Zwei Aktionen auf derselben Taste sind nur dann eine Kollision, wenn sie im
 * selben Spielzustand gelten. Die Zustände sind drei: `welt` (kein Kampf), `kampf_frei` (Kampf ohne
 * aufgeschaltetes Ziel), `kampf_ziel` (Ziel aufgeschaltet). Ein Kontext ist eine Menge davon —
 * `frei` = Welt und Kampf ohne Ziel, `ziel` = nur mit Ziel. So teilen sich Drehen und Zielwechsel Q/E
 * ohne Kollision, genau wie seit D168 (die Szene dreht nicht, solange ein Ziel aufgeschaltet ist).
 *
 * Reines Modul ohne DOM, React und three.js (`tests/eingabe.test.ts`). Die Browser-Seite —
 * Tastenereignisse, Gamepad-Abfrage — liegt in `spieler/steuerung.ts`, `spieler/gamepad.ts`,
 * `kampf/Kampfplatz.tsx`; sie lesen die Belegung über `aktuelleBelegung()`.
 */
import BELEGUNG_ROH from '../../content/belegung.json';
import { Belegung as BelegungSchema, EINGABE_KONTEXTE } from '../data/schema.js';

export const BELEGUNG_DATEN = BelegungSchema.parse(BELEGUNG_ROH);
export type Aktion = string;
export type Kontext = typeof EINGABE_KONTEXTE[number];
export type Spielzustand = 'welt' | 'kampf_frei' | 'kampf_ziel';

/** Welche Spielzustände ein Kontext umfasst. */
export const KONTEXT_ZUSTAENDE: Record<Kontext, readonly Spielzustand[]> = {
  immer: ['welt', 'kampf_frei', 'kampf_ziel'],
  welt: ['welt'],
  kampf: ['kampf_frei', 'kampf_ziel'],
  frei: ['welt', 'kampf_frei'],
  ziel: ['kampf_ziel'],
};

/** Aktion → Codes (Tastatur/Maus und Gamepad zusammen). */
export type Tastenkarte = Record<Aktion, string[]>;

/** Übersteuerung der freien Belegung: nur Tastatur/Maus, je Aktion bis zu zwei Codes. Gamepad ist fest (A-29 (5)). */
export type FreieBelegung = Record<Aktion, string[]>;

const KONTEXT = new Map(BELEGUNG_DATEN.aktionen.map(a => [a.id, a.kontext]));
const FEST = new Set(BELEGUNG_DATEN.aktionen.filter(a => a.fest).map(a => a.id));

/** Standardbelegung als Karte, Tastatur/Maus und Gamepad. */
export function standardKarte(): Tastenkarte {
  return Object.fromEntries(BELEGUNG_DATEN.aktionen.map(a => [a.id, [...a.tasten, ...a.pad]]));
}

/** Standard plus freie Belegung. Unbekannte Aktionen und feste Aktionen in der Übersteuerung zählen nicht. */
export function karteMit(frei: FreieBelegung): Tastenkarte {
  const karte = standardKarte();
  for (const a of BELEGUNG_DATEN.aktionen) {
    const eigen = frei[a.id];
    if (!eigen || a.fest) continue;
    karte[a.id] = [...eigen.slice(0, 2), ...a.pad];
  }
  return karte;
}

/** Index Code → Aktionen, damit ein Tastenereignis nicht jede Aktion durchsucht. */
export function rueckwaerts(karte: Tastenkarte): Map<string, Aktion[]> {
  const r = new Map<string, Aktion[]>();
  for (const [aktion, codes] of Object.entries(karte))
    for (const c of codes) { const l = r.get(c) ?? []; l.push(aktion); r.set(c, l); }
  return r;
}

/** Gilt eine Aktion im Spielzustand? Wer eine Aktion verdrahtet, prüft das, falls der Aufrufer es nicht ohnehin tut. */
export function giltIn(aktion: Aktion, zustand: Spielzustand): boolean {
  const k = KONTEXT.get(aktion);
  return !!k && KONTEXT_ZUSTAENDE[k].includes(zustand);
}

export interface Kollision { taste: string; aktionen: [Aktion, Aktion]; zustaende: Spielzustand[]; geduldet: boolean }

/**
 * Alle Überschneidungen: dieselbe Taste, zwei Aktionen, mindestens ein gemeinsamer Spielzustand.
 * `geduldet` heisst: steht mit Begründung in `belegung.json` `geteilt` (Bestand).
 */
export function kollisionen(karte: Tastenkarte): Kollision[] {
  const geduldet = new Set(BELEGUNG_DATEN.geteilt.map(g => `${g.taste}|${[...g.aktionen].sort().join('|')}`));
  const aus: Kollision[] = [];
  for (const [taste, aktionen] of rueckwaerts(karte)) {
    for (let i = 0; i < aktionen.length; i++) for (let j = i + 1; j < aktionen.length; j++) {
      const a = aktionen[i], b = aktionen[j];
      const za = KONTEXT_ZUSTAENDE[KONTEXT.get(a) ?? 'immer'], zb = KONTEXT_ZUSTAENDE[KONTEXT.get(b) ?? 'immer'];
      const gemeinsam = za.filter(z => zb.includes(z));
      if (gemeinsam.length === 0) continue;
      const paar = [a, b].sort() as [Aktion, Aktion];
      aus.push({ taste, aktionen: paar, zustaende: gemeinsam, geduldet: geduldet.has(`${taste}|${paar.join('|')}`) });
    }
  }
  return aus;
}

export type BelegErgebnis =
  | { ok: true; frei: FreieBelegung; verdraengt: Aktion[] }
  | { ok: false; grund: 'gesperrt' | 'fest' | 'unbekannt' | 'kollision'; mit?: Aktion[] };

/**
 * Eine Taste frei belegen (`platz` 0 oder 1 = erste/zweite Taste der Aktion). Kollidiert die Taste mit
 * einer anderen Aktion im selben Spielzustand, wird **nichts** geändert und die Gegenseite genannt —
 * ausser mit `tauschen`: dann verliert die andere Aktion diese Taste (das Menü fragt vorher).
 */
export function belege(frei: FreieBelegung, aktion: Aktion, platz: 0 | 1, code: string, tauschen = false): BelegErgebnis {
  if (!KONTEXT.has(aktion)) return { ok: false, grund: 'unbekannt' };
  if (FEST.has(aktion)) return { ok: false, grund: 'fest' };
  if (BELEGUNG_DATEN.sperre.includes(code) || code.startsWith('Pad:')) return { ok: false, grund: 'gesperrt' };
  const karte = karteMit(frei);
  const meins = KONTEXT_ZUSTAENDE[KONTEXT.get(aktion)!];
  const gegen = Object.entries(karte)
    .filter(([a, codes]) => a !== aktion && codes.includes(code)
      && KONTEXT_ZUSTAENDE[KONTEXT.get(a)!].some(z => meins.includes(z)))
    .map(([a]) => a);
  if (gegen.some(a => FEST.has(a))) return { ok: false, grund: 'fest', mit: gegen };
  if (gegen.length && !tauschen) return { ok: false, grund: 'kollision', mit: gegen };
  const neu: FreieBelegung = { ...frei };
  const tastenVon = (a: Aktion) => karte[a].filter(c => !c.startsWith('Pad:'));
  for (const a of gegen) neu[a] = tastenVon(a).filter(c => c !== code);
  const eigene = tastenVon(aktion).filter(c => c !== code);
  eigene.splice(Math.min(platz, eigene.length), platz < eigene.length ? 1 : 0, code);
  neu[aktion] = eigene.slice(0, 2);
  return { ok: true, frei: neu, verdraengt: gegen };
}

// ---- Halten / Umschalten (Einstellungen `rennen-modus`, `blocken-modus`) -----------------------

export type Haltemodus = 'halten' | 'umschalten';

/**
 * Zustand einer Halte-Aktion nach einem Tastenwechsel. Halten: an, solange gedrückt. Umschalten: jeder
 * **Druck** (nicht das Loslassen, nicht die Tastenwiederholung) kehrt den Zustand um.
 */
export function halteZustand(modus: Haltemodus, alt: boolean, gedrueckt: boolean, druckBeginnt: boolean): boolean {
  if (modus === 'halten') return gedrueckt;
  return druckBeginnt ? !alt : alt;
}

/**
 * Gemeinsamer Umschalt-Zustand. Rennen schaltet `steuerung.ts` (immer eingehängt), Blocken
 * `Kampfplatz.tsx` — je genau ein Besitzer, sonst kehrte ein Druck den Zustand zweimal um.
 */
export const umgeschaltet = { rennen: false, blocken: false };

// ---- Aktuelle Belegung (Laufzeit) ------------------------------------------------------------

let karteJetzt = standardKarte();
let indexJetzt = rueckwaerts(karteJetzt);

/** Aktionen hinter einem Code in der aktuellen Belegung. */
export function aktionenVon(code: string): readonly Aktion[] { return indexJetzt.get(code) ?? []; }
/** Ist eine der Tasten einer Aktion gedrückt? */
export function aktiv(aktion: Aktion, gedrueckt: ReadonlySet<string>, ohne?: ReadonlySet<string>): boolean {
  for (const c of karteJetzt[aktion] ?? []) if (gedrueckt.has(c) && !ohne?.has(c)) return true;
  return false;
}
/** Codes einer Aktion in der aktuellen Belegung (z. B. um Linien-Pfeile aus der Rollrichtung zu nehmen). */
export function tastenVon(aktion: Aktion): readonly string[] { return karteJetzt[aktion] ?? []; }
export function aktuelleBelegung(): Tastenkarte { return karteJetzt; }
/** Freie Belegung übernehmen (Menü, Laden beim Start). */
export function setzeBelegung(frei: FreieBelegung): void {
  karteJetzt = karteMit(frei);
  indexJetzt = rueckwaerts(karteJetzt);
}

// ---- Sichern der freien Belegung (getrennt vom Spielstand) ------------------------------------

export const BELEGUNG_SCHLUESSEL = 'brachland.belegung';
interface Speicher { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** Liest die freie Belegung; Unlesbares, Unbekanntes und Gesperrtes fällt still weg (dann gilt der Standard). */
export function ladeFreieBelegung(speicher: Speicher | null): FreieBelegung {
  try {
    const roh = JSON.parse(speicher?.getItem(BELEGUNG_SCHLUESSEL) ?? 'null') as { version?: number; frei?: unknown } | null;
    if (!roh || typeof roh.frei !== 'object' || roh.frei === null) return {};
    const aus: FreieBelegung = {};
    for (const [a, codes] of Object.entries(roh.frei as Record<string, unknown>)) {
      if (!KONTEXT.has(a) || FEST.has(a) || !Array.isArray(codes)) continue;
      aus[a] = codes.filter((c): c is string => typeof c === 'string' && !BELEGUNG_DATEN.sperre.includes(c) && !c.startsWith('Pad:')).slice(0, 2);
    }
    return aus;
  } catch { return {}; }
}
export function sichereFreieBelegung(speicher: Speicher | null, frei: FreieBelegung): void {
  try { speicher?.setItem(BELEGUNG_SCHLUESSEL, JSON.stringify({ version: BELEGUNG_DATEN.version, frei })); } catch { /* privater Modus */ }
}

// Beim Laden des Moduls im Browser die gesicherte Belegung übernehmen.
if (typeof localStorage !== 'undefined') {
  try { setzeBelegung(ladeFreieBelegung(localStorage)); } catch { /* gesperrt: Standard */ }
}
