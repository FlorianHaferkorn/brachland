/**
 * BRACHLAND — Spielstand
 *
 * Was gespeichert wird, ist die kürzeste Beschreibung dessen, was der Spieler getan
 * hat: Team, gefangene und besiegte Vorkommen, Position. Alles andere — wo welche
 * Kreatur steht, wie das Terrain aussieht — folgt deterministisch aus Weltdaten und
 * Seed und wäre gespeichert nur Ballast.
 *
 * IndexedDB statt localStorage: Der Spielstand wächst mit dem Team und den besiegten
 * Vorkommen, und localStorage ist synchron — jeder Schreibvorgang würde ein Bild
 * kosten. `idb` ist bereits Abhängigkeit für genau diesen Zweck.
 */
import { openDB, type IDBPDatabase } from 'idb';

import { AKTUELLE_VERSION, PLAETZE, beginneNeu, exportiere, importiere, ladePlatz, listePlaetze,
         listeSicherungen, schreibePlatz, type Ablage, type Einfuhr, type Ladung, type Platz,
         type PlatzKopf } from './speicherformat.js';
import type { Zustand } from '../engine/battle.js';
import type { HeldWahl } from '../spieler/held.js';
import type { WaffenStufen } from './schmiede.js';

/**
 * Version des Speicherformats (D415): 2 = Stand in der Hülle (`spiel/speicherformat.ts`). Version 1 war
 * der nackte Stand bis D415; er wird beim Laden migriert, nicht verworfen.
 */
export const SPIELSTAND_VERSION = AKTUELLE_VERSION;

export interface TeamEintrag {
  kreatur: string;
  /**
   * Stufe im Sinne von **Erfahrungsstufe** (1…40), nicht Mutationsstufe.
   *
   * Die Mutation folgt daraus (`mutationBei`) und wird nicht gespeichert: Sie ist
   * ableitbar, und was ableitbar ist, gehört nicht in einen Spielstand — sonst
   * driften die beiden auseinander, sobald sich eine Schwelle ändert.
   */
  stufe: number;
  erfahrung: number;
  /** Rest-KP. Wird beim Laden übernommen, damit ein Rückzug etwas kostet. */
  kp: number;
  /**
   * Befall-Zustand (G-138). Nicht ableitbar: Ein befallener Wildling bleibt befallen, bis ihn eine
   * Reinigung zurückführt — und die Narbe folgt dann aus der Herkunft (`NARBE`), nicht aus dem
   * Stand. Fehlt in älteren Ständen und heisst dann `rein`. Ohne Versionssprung (siehe `orte`).
   */
  zustand?: Zustand;
}

export interface Spielstand {
  version: number;
  team: TeamEintrag[];
  /** IDs bereits gefangener Vorkommen — die stehen nicht mehr in der Welt. */
  gefangen: string[];
  /** IDs besiegter Vorkommen. Kommen später wieder, aber nicht in derselben Sitzung. */
  besiegt: string[];
  position: [number, number];
  /**
   * Region, in deren Metern `position` steht (ADR-0014). Alte Stände kennen das Feld nicht und
   * bekommen über `LEERER_STAND` das Œntal — dort sind sie entstanden.
   */
  region: string;
  gesehen: string[];
  /** Gegenstände im Beutel: ID zu Anzahl. Nicht vorhandene ID heißt null Stück. */
  beutel: Record<string, number>;
  /** Gelesene Fragmente. Die Leseliste im Spiel besteht aus genau diesen. */
  fragmente: string[];
  /**
   * Besuchte Orte — die Karte zeichnet **nur** diese ein.
   *
   * Ohne das Feld wäre die Karte entweder allwissend (verrät jede Zuflucht, bevor
   * man sie gefunden hat) oder leer. Beides wäre falsch.
   *
   * **Ohne Versionssprung hinzugefügt**, und das war Absicht: Bis D415 verwarf `ladeStand`
   * bei abweichender Version den ganzen Stand, ergänzte aber fehlende Felder aus
   * `LEERER_STAND`. Seit D415 gibt es eine Migrationskette (`spiel/speicherformat.ts`);
   * ein neues Feld mit sicherem Standard braucht trotzdem keinen Sprung (`ergaenzeStand`).
   */
  orte: string[];
  /**
   * Besiegte Regenten. Der einzige Weltzustand, den es gibt — und der einzige,
   * der nicht aus `besiegt` ableitbar ist, weil ein Regent kein Vorkommen ist.
   */
  regenten: string[];
  /**
   * Geheilte Regionen nach Regenten-ID (D240): besiegt **und** Reinkulturen eingesetzt. Nicht
   * ableitbar — das Einsetzen verbraucht Gegenstände. Ohne Versionssprung (siehe `orte`).
   */
  geheilt: string[];
  /**
   * Aufträge: angenommen oder Belohnung abgeholt.
   *
   * Der **Fortschritt** steht bewusst nicht hier: Ob drei Sporenhähne besiegt sind,
   * folgt aus `besiegt` (siehe `spiel/auftraege.ts`). Gespeichert wird nur, was
   * nicht ableitbar ist — sonst gäbe es zwei Wahrheiten über dieselbe Sache.
   */
  auftraege: Record<string, 'angenommen' | 'abgeholt'>;
  /**
   * D355: Richtungskampf (ADR-0009) an oder aus — eine Spieleinstellung, kein Weltzustand. Ohne
   * Versionssprung ergänzt (Standard an, wie bisher), siehe `orte`.
   */
  richtungskampf: boolean;
  /**
   * Die Hauptfigur aus dem Charakter-Editor (D175). `null` heisst: noch nicht gewählt — dann zeigt
   * das Spiel den Editor vor dem ersten Schritt. Ohne Versionssprung (siehe `orte`).
   */
  held: HeldWahl | null;
  /** Stufen aus der Schmiede (D177), je Waffe 0…3. Ohne Versionssprung. */
  waffenStufen: WaffenStufen;
  /**
   * Wann ein Wegelager zuletzt geschlagen wurde (D178, ms seit 1970). Nach `LAGER_RUHE_MS` sitzt
   * dort wieder jemand — das Kopfgeld-Brett beim Wirt zeigt, wo. Ohne Versionssprung.
   */
  lagerSieg: Record<string, number>;
  /** Zuletzt benutzte Zuflucht (D179): Dort wacht man nach einer Niederlage auf. */
  letzteZuflucht?: string;
}

export const LEERER_STAND: Spielstand = {
  version: SPIELSTAND_VERSION,
  held: null,
  waffenStufen: { klinge: 0, axt: 0, speer: 0 },
  lagerSieg: {},
  team: [],
  gefangen: [],
  besiegt: [],
  position: [0, 0],
  region: 'oental',
  gesehen: [],
  // Zwei Sude und ein Köder zum Anfangen. Ohne Startausstattung ist der erste
  // verlorene Kampf eine Sackgasse, und der erste Fang reiner Zufall.
  beutel: { kraeutersud: 2, koeder: 1 },
  fragmente: [],
  orte: [],
  regenten: [],
  geheilt: [],
  auftraege: {},
  richtungskampf: true,
};

/**
 * Fehlende Felder älterer Stände aus `LEERER_STAND` ergänzen, statt den Stand zu verwerfen — ein
 * verlorener Spielstand ist schlimmer als ein leerer Beutel. Läuft nach jeder Migration (D415).
 */
export function ergaenzeStand(roh: Record<string, unknown>): Spielstand {
  return {
    ...LEERER_STAND, ...roh,
    beutel: roh.beutel ?? {},
    fragmente: roh.fragmente ?? [],
    orte: roh.orte ?? [],
    regenten: roh.regenten ?? [],
    auftraege: roh.auftraege ?? {},
  } as Spielstand;
}

const DB = 'brachland';
/**
 * Version der **Datenbank**, nicht des Speicherformats. Bis D415 hiessen beide `SPIELSTAND_VERSION`;
 * getrennt, weil ein Formatsprung sonst ein IndexedDB-Upgrade auslöste und ein älterer Build die
 * Datenbank danach nicht mehr öffnen könnte (`VersionError`).
 */
const DB_VERSION = 1;
const LADEN = 'spielstand';

let db: Promise<IDBPDatabase> | null = null;
function hole() {
  db ??= openDB(DB, DB_VERSION, {
    upgrade(d) { if (!d.objectStoreNames.contains(LADEN)) d.createObjectStore(LADEN); },
  });
  return db;
}

/** IndexedDB als `Ablage` für `spiel/speicherformat.ts`. */
const ablage: Ablage = {
  lies: async k => (await hole()).get(LADEN, k),
  schreibe: async (k, v) => { await (await hole()).put(LADEN, v, k); },
  schluessel: async () => (await (await hole()).getAllKeys(LADEN)).map(String),
};

/** Gewählter Platz (1–3), in `localStorage` gemerkt; ohne Speicher Platz 1. */
const PLATZ_SCHLUESSEL = 'brachland.platz';
export function aktiverPlatz(): Platz {
  try {
    const n = Number(localStorage.getItem(PLATZ_SCHLUESSEL));
    return (PLAETZE as readonly number[]).includes(n) ? n as Platz : 1;
  } catch { return 1; }
}
export function waehlePlatz(platz: Platz): void {
  try { localStorage.setItem(PLATZ_SCHLUESSEL, String(platz)); } catch { /* gilt für diese Sitzung nicht */ }
}

/**
 * Meldungen der letzten Ladung (migriert, Rückfall auf die Rast, Sicherung aufbewahrt, Speicher gesperrt)
 * — `main.tsx` zeigt die erste als Hinweis. Leer, wenn alles glatt ging.
 */
export let letzteMeldungen: string[] = [];

/** Den gewählten Platz laden: `aktuell`, sonst `rast`, sonst der Stand vor D415 (migriert). */
export async function ladeStand(): Promise<Spielstand | null> {
  try {
    const l: Ladung = await ladePlatz(ablage, aktiverPlatz(), ergaenzeStand);
    letzteMeldungen = l.meldungen;
    return l.art === 'geladen' ? l.stand : null;
  } catch {
    // Privater Modus oder gesperrte Datenbank: lieber ohne Spielstand spielen als gar nicht starten —
    // aber nicht mehr still (Doc §1.5).
    letzteMeldungen = ['Der Browser lässt das Speichern nicht zu (privates Fenster?) — dieser Durchgang wird nicht gesichert.'];
    return null;
  }
}

/**
 * Den gewählten Platz schreiben. `rast` (D415, A-29 (7)) schreibt zusätzlich die Fassung der letzten
 * Rast, auf die das Laden zurückfällt. Ein ungültiger Stand wird nicht geschrieben (`schreibePlatz`).
 */
export async function speichereStand(stand: Spielstand, opt: { rast?: boolean } = {}): Promise<void> {
  try {
    const r = await schreibePlatz(ablage, aktiverPlatz(), stand, opt);
    if (!r.ok) console.warn(`Spielstand nicht geschrieben, der letzte gute bleibt: ${r.grund}`);
  } catch {
    /* siehe ladeStand */
  }
}

/** „Neues Spiel“ auf dem gewählten Platz: der alte Stand wandert unter `sicherung/`, gelöscht wird nichts. */
export async function beginneNeuesSpiel(neu: Spielstand): Promise<boolean> {
  try { return (await beginneNeu(ablage, aktiverPlatz(), neu)).ok; } catch { return false; }
}

/** Kopf der drei Plätze für die Platzliste des Menüs. */
export async function plaetze(): Promise<PlatzKopf[]> {
  try { return await listePlaetze(ablage); } catch { return []; }
}

/** Aufbewahrte Sicherungen (unlesbare, neuere, ersetzte Stände) — zum Herunterladen für die Fehlersuche. */
export async function sicherungen(): Promise<string[]> {
  try { return await listeSicherungen(ablage); } catch { return []; }
}

/** Eine Datei im Browser herunterladen lassen (`Blob` + Link). */
function herunterladen(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export als Datei (Doc §6.7 `spielstand-sichern`). Persönliche Einstellungen nur, wenn übergeben. */
export function exportiereStand(stand: Spielstand, einstellungen?: Record<string, unknown>): void {
  const d = exportiere(stand, { einstellungen });
  herunterladen(d.name, d.text);
}

/** Eine aufbewahrte Sicherung unverändert als Datei herunterladen. */
export async function exportiereSicherung(k: string): Promise<boolean> {
  try {
    const roh = await ablage.lies(k);
    if (roh === undefined) return false;
    herunterladen(`brachland-${k.replace(/[^a-z0-9-]/gi, '_')}.json`, JSON.stringify(roh, null, 2));
    return true;
  } catch { return false; }
}

/**
 * Import einer Datei (Doc §6.7 `spielstand-laden`): geprüft, migriert, validiert. Gelingt es, wird der
 * gewählte Platz wie bei „Neues Spiel“ ersetzt (alter Stand nach `sicherung/`). Das Menü lädt danach neu.
 */
export async function importiereStand(datei: Blob): Promise<Einfuhr> {
  const r = importiere(await datei.text(), ergaenzeStand);
  if (!r.ok) return r;
  try {
    const s = await beginneNeu(ablage, aktiverPlatz(), r.stand);
    return s.ok ? r : { ok: false, grund: s.grund };
  } catch { return { ok: false, grund: 'Der Browser lässt das Speichern nicht zu' }; }
}
