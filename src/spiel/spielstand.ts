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

export const SPIELSTAND_VERSION = 1;

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
}

export interface Spielstand {
  version: number;
  team: TeamEintrag[];
  /** IDs bereits gefangener Vorkommen — die stehen nicht mehr in der Welt. */
  gefangen: string[];
  /** IDs besiegter Vorkommen. Kommen später wieder, aber nicht in derselben Sitzung. */
  besiegt: string[];
  position: [number, number];
  gesehen: string[];
  /** Gegenstände im Beutel: ID zu Anzahl. Nicht vorhandene ID heißt null Stück. */
  beutel: Record<string, number>;
  /** Gelesene Fragmente. Die Leseliste im Spiel besteht aus genau diesen. */
  fragmente: string[];
}

export const LEERER_STAND: Spielstand = {
  version: SPIELSTAND_VERSION,
  team: [],
  gefangen: [],
  besiegt: [],
  position: [0, 0],
  gesehen: [],
  // Zwei Sude und ein Köder zum Anfangen. Ohne Startausstattung ist der erste
  // verlorene Kampf eine Sackgasse, und der erste Fang reiner Zufall.
  beutel: { kraeutersud: 2, koeder: 1 },
  fragmente: [],
};

const DB = 'brachland';
const LADEN = 'spielstand';
const SCHLUESSEL = 'aktuell';

let db: Promise<IDBPDatabase> | null = null;
function hole() {
  db ??= openDB(DB, SPIELSTAND_VERSION, {
    upgrade(d) { if (!d.objectStoreNames.contains(LADEN)) d.createObjectStore(LADEN); },
  });
  return db;
}

export async function ladeStand(): Promise<Spielstand | null> {
  try {
    const roh = await (await hole()).get(LADEN, SCHLUESSEL);
    if (!roh || roh.version !== SPIELSTAND_VERSION) return null;
    // Fehlende Felder aus älteren Ständen ergänzen, statt den Stand zu verwerfen.
    // Ein verlorener Spielstand ist schlimmer als ein leerer Beutel.
    return { ...LEERER_STAND, ...roh, beutel: roh.beutel ?? {}, fragmente: roh.fragmente ?? [] } as Spielstand;
  } catch {
    // Privater Modus oder gesperrte Datenbank: lieber ohne Spielstand spielen als
    // gar nicht starten.
    return null;
  }
}

export async function speichereStand(stand: Spielstand): Promise<void> {
  try {
    await (await hole()).put(LADEN, stand, SCHLUESSEL);
  } catch {
    /* siehe ladeStand */
  }
}

export async function loescheStand(): Promise<void> {
  try {
    await (await hole()).delete(LADEN, SCHLUESSEL);
  } catch {
    /* siehe ladeStand */
  }
}
