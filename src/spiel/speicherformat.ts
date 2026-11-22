/**
 * BRACHLAND — Speicherformat: Hülle, Migration, Plätze, Export (D415, Doc §7)
 *
 * **Hülle** `{ format, version, geschrieben, spiel }` um den Spielstand. Version 1 ist der Stand bis
 * D415 **ohne** Hülle (das nackte Objekt mit `version: 1`, so wie `speichereStand` ihn schrieb);
 * Version 2 ist derselbe Stand in der Hülle. Version 3 (D416) bringt die Reviere: `begegnungen` (was der Kampf je
 * Begegnung meldet) und `reviere` (was Rasten an den Revieren entschieden haben, `spiel/reviere.ts`).
 *
 * **Migration statt Verwerfen.** `MIGRATIONEN[n]` hebt Version n auf n + 1; geladen wird über die ganze
 * Kette. Bis D415 verwarf `ladeStand` bei jeder anderen Version den ganzen Stand — deshalb kamen neue
 * Felder bisher ohne Versionssprung (`ergaenzeStand` füllt sie aus `LEERER_STAND`). Beides bleibt: Ein
 * Feld mit sicherem Standard braucht weiter keinen Sprung; ein Sprung kostet jetzt aber nichts mehr.
 *
 * **Nie still verwerfen.** Was sich nicht öffnen lässt — kaputt, unbekanntes Format, eine **neuere**
 * Version —, wird unverändert unter `sicherung/…` kopiert, **bevor** irgendetwas den Platz überschreibt,
 * und gemeldet. Dann wird die zweite Fassung des Platzes versucht.
 *
 * **Plätze:** drei (`platz-1` … `platz-3`), je zwei Fassungen: `aktuell` (jede Änderung) und `rast`
 * (Stand der letzten Rast, A-29 (7)). Ist `aktuell` nicht lesbar, lädt `rast`. Der Stand vor D415 lag
 * unter dem Schlüssel `aktuell`; er wird für Platz 1 gelesen, migriert und **bleibt liegen**.
 *
 * **Export/Import** als JSON-Datei mit Prüfsumme (FNV-1a über `spiel`, Schlüssel sortiert — so übersteht
 * die Datei Umformatieren, aber kein Ändern eines Werts). Import prüft Format, Prüfsumme, migriert und
 * validiert gegen `SpielstandDaten`.
 *
 * Reines Modul über eine `Ablage` (IndexedDB in `spielstand.ts`, `Map` in `tests/speicherformat.test.ts`).
 */
import { SpielstandDaten, SpielstandHuelle } from '../data/schema.js';
import type { Spielstand } from './spielstand.js';

export const FORMAT = 'brachland-spielstand';
export const AKTUELLE_VERSION = 3;
export const PLAETZE = [1, 2, 3] as const;
export type Platz = typeof PLAETZE[number];
export type Fassung = 'aktuell' | 'rast';
/** Schlüssel des einzigen Platzes vor D415. Wird gelesen, nie geschrieben, nie gelöscht. */
export const ALTER_SCHLUESSEL = 'aktuell';

/**
 * Felder, die D392/D393/D400/D412 brauchen werden, die der Code aber **noch nicht schreibt** — sie kommen mit der
 * nächsten Migration (v4), wenn der erste davon geschrieben wird (Doc §7.2 „Neu im Stand“). Bis dahin gilt:
 * Das Heft (D392) leitet sich aus `fragmente`/`orte`/`auftraege` ab, die Kälteuhr (D412) lebt in der
 * Szene und beginnt nach dem Laden neu, Bruchstücke (D400) liegen als Gegenstände im `beutel`.
 * Mit v3 (D416) erledigt: die Eingriffe beim Zähler (`begegnungen` und, abgeleitet, `besiegt`/`gefangen`).
 */
export const KOMMT_SPAETER = [
  'heft: eigene Vermerke (D392) — heute nur abgeleitet, nichts zu speichern',
  'einsicht (D400) — kein Code schreibt sie',
  'markenLadung, markenFassung (D393) — Entwurf in spiel/oekonomie.ts, nicht im Spiel; das Aufladen nach Revier steht in spiel/reviere.ts (D416)',
  'ausruestung (D393) — kein Code schreibt sie',
  'begehung (Kartenraster, A-29 (2)) und eigene Kartenzeichen',
  'lehrhinweiseGesehen, spielzeit',
  'kaelteuhr (D412) — bewusst nicht: Ufer und Laden setzen sie zurück',
] as const;

export const schluessel = (platz: Platz, fassung: Fassung) => `platz-${platz}/${fassung}`;

/** Ablage, auf der die Plätze liegen. `lies` gibt `undefined` für einen fehlenden Schlüssel. */
export interface Ablage {
  lies(k: string): Promise<unknown>;
  schreibe(k: string, v: unknown): Promise<void>;
  schluessel(): Promise<string[]>;
}

export interface Huelle { format: typeof FORMAT; version: number; geschrieben: string; spiel: Spielstand;
  pruefsumme?: string; einstellungen?: Record<string, unknown> }

// ---- Migration --------------------------------------------------------------------------------

/** Welche Version hat ein roher Stand? `null` = kein Spielstand, den dieses Spiel kennt. */
export function erkenneVersion(roh: unknown): number | null {
  if (!roh || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;
  if (o.format === FORMAT) return typeof o.version === 'number' && Number.isInteger(o.version) ? o.version : null;
  // Version 1: nackt, mit `version: 1` und einem Team.
  if (o.format === undefined && o.version === 1 && Array.isArray(o.team)) return 1;
  return null;
}

/** `MIGRATIONEN[n]` hebt Version n auf n + 1. Jede bekommt einen Test mit einem echten alten Stand. */
export const MIGRATIONEN: Record<number, (alt: unknown, jetzt: Date) => unknown> = {
  /** 1 → 2: Hülle um den nackten Stand. Am Inhalt ändert sich nichts. */
  1: (alt, jetzt) => ({ format: FORMAT, version: 2, geschrieben: jetzt.toISOString(),
    spiel: { ...(alt as object), version: 2 } }),
  /**
   * 2 → 3 (D416): Reviere. Neu sind `begegnungen` (leer — was vorher geschah, steht schon in `besiegt`/`gefangen`
   * und wird daraus abgeleitet, nicht kopiert) und `reviere` (noch keine Rast ausgewertet). Sonst bleibt alles.
   */
  2: alt => {
    const h = alt as Record<string, unknown>;
    const spiel = (h.spiel ?? {}) as Record<string, unknown>;
    return { ...h, version: 3, spiel: { ...spiel, version: 3,
      begegnungen: Array.isArray(spiel.begegnungen) ? spiel.begegnungen : [],
      reviere: spiel.reviere && typeof spiel.reviere === 'object' ? spiel.reviere : { rasten: 0, leerFolge: [], je: {} } } };
  },
};

export type Oeffnung =
  | { art: 'ok'; huelle: Huelle; vonVersion: number }
  | { art: 'neuer'; version: number }
  | { art: 'kaputt'; grund: string };

/**
 * Einen rohen Stand öffnen: Version erkennen, migrieren, fehlende Felder ergänzen, prüfen.
 * `ergaenze` füllt fehlende Felder (aus `LEERER_STAND`, siehe `spielstand.ts`).
 */
export function oeffne(roh: unknown, ergaenze: (s: Record<string, unknown>) => Spielstand, jetzt = new Date()): Oeffnung {
  const v = erkenneVersion(roh);
  if (v === null) return { art: 'kaputt', grund: 'kein BRACHLAND-Spielstand oder unlesbar' };
  if (v > AKTUELLE_VERSION) return { art: 'neuer', version: v };
  let stand: unknown = roh;
  try {
    for (let n = v; n < AKTUELLE_VERSION; n++) {
      const m = MIGRATIONEN[n];
      if (!m) return { art: 'kaputt', grund: `keine Migration von Version ${n}` };
      stand = m(stand, jetzt);
    }
  } catch (f) { return { art: 'kaputt', grund: `Migration gescheitert: ${(f as Error).message}` }; }
  const h = SpielstandHuelle.safeParse(stand);
  if (!h.success) return { art: 'kaputt', grund: `Hülle: ${kurz(h.error.issues)}` };
  if (!h.data.spiel || typeof h.data.spiel !== 'object') return { art: 'kaputt', grund: 'Hülle ohne Spiel' };
  const spiel = ergaenze({ ...(h.data.spiel as Record<string, unknown>), version: AKTUELLE_VERSION });
  const s = SpielstandDaten.safeParse(spiel);
  if (!s.success) return { art: 'kaputt', grund: `Spielstand: ${kurz(s.error.issues)}` };
  return { art: 'ok', vonVersion: v,
    huelle: { ...(h.data as Omit<Huelle, 'spiel'>), format: FORMAT, version: AKTUELLE_VERSION, spiel } };
}

const kurz = (issues: { path: (string | number)[]; message: string }[]) =>
  issues.slice(0, 3).map(i => `${i.path.join('.') || '(Wurzel)'} ${i.message}`).join('; ');

/** Neue Hülle um einen Stand. */
export function verpacke(stand: Spielstand, jetzt = new Date()): Huelle {
  return { format: FORMAT, version: AKTUELLE_VERSION, geschrieben: jetzt.toISOString(),
    spiel: { ...stand, version: AKTUELLE_VERSION } };
}

// ---- Plätze -----------------------------------------------------------------------------------

export type Ladung =
  | { art: 'leer'; meldungen: string[] }
  | { art: 'geladen'; stand: Spielstand; fassung: Fassung | 'alt'; vonVersion: number; meldungen: string[] };

/** Unverändert unter `sicherung/…` ablegen, ehe der Platz überschrieben werden kann. Gibt den Schlüssel zurück. */
export async function sichereUnveraendert(ablage: Ablage, roh: unknown, herkunft: string, jetzt = new Date()): Promise<string> {
  const k = `sicherung/${jetzt.toISOString()}/${herkunft}`;
  await ablage.schreibe(k, { herkunft, aufbewahrt: jetzt.toISOString(), roh });
  return k;
}

/**
 * Einen Platz laden: `aktuell`, dann `rast`, für Platz 1 zuletzt der Schlüssel vor D415. Ein alter Stand
 * wird migriert und gleich in der neuen Form auf den Platz geschrieben; der alte Schlüssel bleibt liegen.
 */
export async function ladePlatz(ablage: Ablage, platz: Platz,
  ergaenze: (s: Record<string, unknown>) => Spielstand, jetzt = new Date()): Promise<Ladung> {
  const meldungen: string[] = [];
  const quellen: [Fassung | 'alt', string][] = [['aktuell', schluessel(platz, 'aktuell')], ['rast', schluessel(platz, 'rast')]];
  const hatNeu = (await ablage.lies(quellen[0][1])) !== undefined || (await ablage.lies(quellen[1][1])) !== undefined;
  if (platz === 1 && !hatNeu) quellen.push(['alt', ALTER_SCHLUESSEL]);
  for (const [fassung, k] of quellen) {
    const roh = await ablage.lies(k);
    if (roh === undefined) continue;
    const o = oeffne(roh, ergaenze, jetzt);
    if (o.art === 'ok') {
      if (fassung === 'alt') {
        // Der alte Schlüssel bleibt liegen; der Platz bekommt beide Fassungen in neuer Form.
        await ablage.schreibe(schluessel(platz, 'aktuell'), o.huelle);
        await ablage.schreibe(schluessel(platz, 'rast'), o.huelle);
        meldungen.push(`Spielstand aus Version ${o.vonVersion} übernommen; das Original liegt unverändert daneben.`);
      } else if (fassung === 'rast') {
        meldungen.push('Der letzte Stand war nicht lesbar — geladen ist der Stand der letzten Rast.');
      }
      return { art: 'geladen', stand: o.huelle.spiel, fassung, vonVersion: o.vonVersion, meldungen };
    }
    const s = await sichereUnveraendert(ablage, roh, `platz-${platz}-${fassung}`, jetzt);
    meldungen.push(o.art === 'neuer'
      ? `Ein Stand aus einer neueren Fassung des Spiels (Version ${o.version}) ist aufbewahrt (${s}), nicht geladen.`
      : `Ein Stand war nicht lesbar (${o.grund}); er ist aufbewahrt (${s}), nicht gelöscht.`);
  }
  return { art: 'leer', meldungen };
}

export type Schreibung = { ok: true } | { ok: false; grund: string };

/**
 * Einen Platz schreiben. `rast` schreibt beide Fassungen; die erste Schreibung eines Platzes auch, damit
 * es von Anfang an einen Rückfall gibt. **Ein ungültiger Stand wird nicht geschrieben** — der letzte
 * gute bleibt, statt von einem Fehler im Spiel überschrieben zu werden.
 */
export async function schreibePlatz(ablage: Ablage, platz: Platz, stand: Spielstand,
  opt: { rast?: boolean } = {}, jetzt = new Date()): Promise<Schreibung> {
  const h = verpacke(stand, jetzt);
  const s = SpielstandDaten.safeParse(h.spiel);
  if (!s.success) return { ok: false, grund: kurz(s.error.issues) };
  await ablage.schreibe(schluessel(platz, 'aktuell'), h);
  if (opt.rast || (await ablage.lies(schluessel(platz, 'rast'))) === undefined) {
    await ablage.schreibe(schluessel(platz, 'rast'), h);
  }
  return { ok: true };
}

/** Kopf eines Platzes für die Platzliste, ohne `spiel` auszuwerten. */
export interface PlatzKopf { platz: Platz; belegt: boolean; version: number | null; geschrieben: string | null; region: string | null }
export async function listePlaetze(ablage: Ablage): Promise<PlatzKopf[]> {
  const aus: PlatzKopf[] = [];
  for (const platz of PLAETZE) {
    let roh = await ablage.lies(schluessel(platz, 'aktuell'));
    if (roh === undefined && platz === 1) roh = await ablage.lies(ALTER_SCHLUESSEL);
    const v = erkenneVersion(roh);
    const o = (roh ?? {}) as Record<string, unknown>;
    const spiel = (v === 1 ? o : o.spiel ?? {}) as Record<string, unknown>;
    aus.push({ platz, belegt: roh !== undefined, version: v,
      geschrieben: typeof o.geschrieben === 'string' ? o.geschrieben : null,
      region: typeof spiel.region === 'string' ? spiel.region : null });
  }
  return aus;
}

/** Aufbewahrte Sicherungen (für „als Datei sichern“ in der Fehlersuche). */
export async function listeSicherungen(ablage: Ablage): Promise<string[]> {
  return (await ablage.schluessel()).filter(k => k.startsWith('sicherung/')).sort();
}

/**
 * Platz leeren („Neues Spiel“, Doc §6.7: mit doppelter Nachfrage im Menü). Gelöscht wird nichts: Beide
 * Fassungen wandern unter `sicherung/`, dann bekommt der Platz den neuen Stand.
 */
export async function beginneNeu(ablage: Ablage, platz: Platz, neu: Spielstand, jetzt = new Date()): Promise<Schreibung> {
  for (const f of ['aktuell', 'rast'] as const) {
    const roh = await ablage.lies(schluessel(platz, f));
    if (roh !== undefined) await sichereUnveraendert(ablage, roh, `neues-spiel-platz-${platz}-${f}`, jetzt);
  }
  const h = verpacke(neu, jetzt);
  if (!SpielstandDaten.safeParse(h.spiel).success) return { ok: false, grund: 'neuer Stand ungültig' };
  await ablage.schreibe(schluessel(platz, 'aktuell'), h);
  await ablage.schreibe(schluessel(platz, 'rast'), h);
  return { ok: true };
}

// ---- Export / Import --------------------------------------------------------------------------

/** JSON mit sortierten Schlüsseln — dieselbe Prüfsumme, egal wie die Datei formatiert ist. */
export function stabilJson(w: unknown): string {
  if (Array.isArray(w)) return `[${w.map(stabilJson).join(',')}]`;
  if (w && typeof w === 'object') {
    return `{${Object.keys(w as object).filter(k => (w as Record<string, unknown>)[k] !== undefined).sort()
      .map(k => `${JSON.stringify(k)}:${stabilJson((w as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(w ?? null);
}

/** FNV-1a, 32 Bit, als 8 Hex-Ziffern. Erkennt Beschädigung und versehentliches Ändern, ist kein Schutz gegen Absicht. */
export function pruefsumme(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** Dateiname und Inhalt der Exportdatei (`brachland-<region>-<datum>.json`, Doc §6.7). */
export function exportiere(stand: Spielstand, opt: { einstellungen?: Record<string, unknown> } = {}, jetzt = new Date()):
  { name: string; text: string } {
  const h = verpacke(stand, jetzt);
  const datei: Huelle = { ...h, pruefsumme: pruefsumme(stabilJson(h.spiel)), ...(opt.einstellungen ? { einstellungen: opt.einstellungen } : {}) };
  const tag = jetzt.toISOString().slice(0, 10);
  const region = (stand.region || 'brachland').replace(/[^a-z0-9-]/gi, '');
  return { name: `brachland-${region}-${tag}.json`, text: JSON.stringify(datei, null, 2) };
}

export type Einfuhr =
  | { ok: true; stand: Spielstand; vonVersion: number; einstellungen?: Record<string, unknown> }
  | { ok: false; grund: string };

/** Exportdatei prüfen und öffnen. Ein nackter v1-Stand (ohne Hülle, ohne Prüfsumme) wird auch angenommen. */
export function importiere(text: string, ergaenze: (s: Record<string, unknown>) => Spielstand, jetzt = new Date()): Einfuhr {
  let roh: unknown;
  try { roh = JSON.parse(text); } catch { return { ok: false, grund: 'keine JSON-Datei' }; }
  const o = (roh ?? {}) as Record<string, unknown>;
  if (o.format === FORMAT && typeof o.pruefsumme === 'string' && o.pruefsumme !== pruefsumme(stabilJson(o.spiel))) {
    return { ok: false, grund: 'Prüfsumme stimmt nicht — die Datei ist beschädigt oder von Hand geändert' };
  }
  const r = oeffne(roh, ergaenze, jetzt);
  if (r.art === 'neuer') return { ok: false, grund: `Die Datei stammt aus einer neueren Fassung des Spiels (Version ${r.version})` };
  if (r.art === 'kaputt') return { ok: false, grund: r.grund };
  const einst = o.einstellungen && typeof o.einstellungen === 'object' ? o.einstellungen as Record<string, unknown> : undefined;
  return { ok: true, stand: r.huelle.spiel, vonVersion: r.vonVersion, ...(einst ? { einstellungen: einst } : {}) };
}
