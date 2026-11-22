/**
 * BRACHLAND — Einstellungs-Speicher (D415, Doc `BRACHLAND_Menue-und-Einstellungen_v1.md` §8.1)
 *
 * **Eine Quelle:** `content/einstellungen.json` beschreibt jede Einstellung (Standard, Wertebereich,
 * Stufenwerte); der Speicher hält nur `id → Wert`. Gesichert wird in `localStorage`
 * (`brachland.einstellungen`) — **getrennt vom Spielstand** und synchron, weil die Qualitätsstufe
 * feststehen muss, bevor der Renderer startet (Doc §7.3).
 *
 * **Rangfolge beim Lesen** (erste, die einen gültigen Wert hat, gewinnt):
 *
 * 1. **Adresse** — der URL-Schalter aus `url` (Entwickler-Übersteuerung für Messläufe). Wird **nie**
 *    gespeichert und gewinnt über alles; `quelle(id)` meldet `adresse`, damit das Menü die Zeile als
 *    „durch Adresse gesetzt“ markieren kann.
 * 2. **gespeichert** — was der Spieler gewählt hat.
 * 3. **Stufe** — der Stufenwert der gewählten Qualitätsstufe (nur Gruppe Grafik); bei „Automatisch“
 *    die vorgeschlagene Stufe (`setzeVorschlag`), bei „Eigene Werte“ keine.
 * 4. **Standard** aus den Daten.
 *
 * Ungültige gespeicherte Werte (`einstellungsWertGueltig`) und unbekannte ids werden beim Laden
 * verworfen — eine entfallene Einstellung darf den Rest nicht mitreissen.
 *
 * Reines Modul: Speicher und Adresse werden übergeben (`tests/einstellungen.test.ts`); `einstellungen()`
 * baut den einen Speicher der Seite aus `localStorage` und `location.search`.
 */
import ROH from '../../content/einstellungen.json';
import { Einstellungen, einstellungsWertGueltig, QUALITAETSSTUFEN, type Einstellung } from '../data/schema.js';

export const EINSTELLUNGS_DATEN = Einstellungen.parse(ROH);
export const EINSTELLUNGS_SCHLUESSEL = 'brachland.einstellungen';

export type Wert = boolean | string | number;
export type Quelle = 'adresse' | 'gespeichert' | 'stufe' | 'standard';
export type Stufe = typeof QUALITAETSSTUFEN[number];
export interface Speicher { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** URL-Text in einen Wert übersetzen; `undefined`, wenn er für diese Einstellung nichts bedeutet. */
export function wertAusAdresse(e: Einstellung, text: string | null): Wert | undefined {
  if (text === null) return undefined;
  let w: Wert | undefined;
  if (e.urlWerte) w = e.urlWerte[text];
  else if (e.art === 'schalter') w = text === '1' ? true : text === '0' ? false : undefined;
  else if (e.art === 'auswahl') w = text;
  else w = text.trim() === '' ? undefined : Number(text);
  return w !== undefined && einstellungsWertGueltig(e, w) ? w : undefined;
}

export interface EinstellungsSpeicher {
  wert(id: string): Wert;
  quelle(id: string): Quelle;
  /** Setzen und sichern. `false`, wenn die id unbekannt oder der Wert ungültig ist (dann ändert sich nichts). */
  setze(id: string, wert: Wert): boolean;
  /** Zurück auf den Standard — eine id, eine Gruppe oder alles. */
  zuruecksetzen(was?: { id?: string; gruppe?: string }): void;
  /** Bei Änderung melden (`'*'` = jede). Gibt die Abmeldung zurück. */
  abonniere(id: string, fn: (id: string, wert: Wert) => void): () => void;
  /** Vorschlag der Automatik (`qualitaetsvorschlag.ts`) — gilt, solange die Qualitätsstufe „automatisch“ ist. */
  setzeVorschlag(stufe: Stufe | null): void;
  /** Die Stufe, deren Werte gerade gelten (`null` bei „Eigene Werte“ ohne Vorschlag). */
  wirksameStufe(): Stufe | null;
  /** Persönliche Werte (`wirkt: spieler`) für den Export mit dem Spielstand. */
  persoenlich(): Record<string, Wert>;
}

export function erzeugeSpeicher(opt: {
  daten?: Einstellungen; speicher?: Speicher | null; adresse?: URLSearchParams;
} = {}): EinstellungsSpeicher {
  const daten = opt.daten ?? EINSTELLUNGS_DATEN;
  const nachId = new Map(daten.einstellungen.map(e => [e.id, e]));
  const adresse = opt.adresse ?? new URLSearchParams();
  const gespeichert = new Map<string, Wert>();
  const abos = new Map<string, Set<(id: string, w: Wert) => void>>();
  let vorschlag: Stufe | null = null;

  try {
    const roh = JSON.parse(opt.speicher?.getItem(EINSTELLUNGS_SCHLUESSEL) ?? 'null') as { werte?: Record<string, unknown> } | null;
    for (const [id, w] of Object.entries(roh?.werte ?? {})) {
      const e = nachId.get(id);
      if (e && einstellungsWertGueltig(e, w)) gespeichert.set(id, w as Wert);
    }
  } catch { /* unlesbar oder gesperrt: Standardwerte */ }

  const sichere = () => {
    try {
      opt.speicher?.setItem(EINSTELLUNGS_SCHLUESSEL,
        JSON.stringify({ version: daten.version, werte: Object.fromEntries(gespeichert) }));
    } catch { /* privater Modus: gilt für diese Sitzung */ }
  };

  const ausAdresse = (e: Einstellung) => e.url ? wertAusAdresse(e, adresse.get(e.url)) : undefined;

  const wirksameStufe = (): Stufe | null => {
    const e = nachId.get('qualitaetsstufe');
    const gewaehlt = e ? (ausAdresse(e) ?? gespeichert.get('qualitaetsstufe') ?? e.standard) : 'automatisch';
    if (gewaehlt === 'automatisch') return vorschlag;
    return (QUALITAETSSTUFEN as readonly string[]).includes(gewaehlt as string) ? gewaehlt as Stufe : null;
  };

  const loese = (id: string): [Wert, Quelle] => {
    const e = nachId.get(id);
    if (!e) throw new Error(`Einstellung '${id}' gibt es nicht (content/einstellungen.json)`);
    const a = ausAdresse(e);
    if (a !== undefined) return [a, 'adresse'];
    if (gespeichert.has(id)) return [gespeichert.get(id)!, 'gespeichert'];
    const stufe = wirksameStufe();
    const sw = stufe && e.stufen ? (e.stufen as Record<string, Wert | undefined>)[stufe] : undefined;
    if (sw !== undefined) return [sw, 'stufe'];
    return [e.standard, 'standard'];
  };

  /** Vorher/nachher vergleichen und jede geänderte Einstellung melden (Stufen ziehen andere mit). */
  const melde = (vorher: Map<string, Wert>) => {
    for (const e of daten.einstellungen) {
      const jetzt = loese(e.id)[0];
      if (vorher.get(e.id) === jetzt) continue;
      for (const k of [e.id, '*']) for (const fn of abos.get(k) ?? []) fn(e.id, jetzt);
    }
  };
  const stand = () => new Map(daten.einstellungen.map(e => [e.id, loese(e.id)[0]]));

  return {
    wert: id => loese(id)[0],
    quelle: id => loese(id)[1],
    setze(id, wert) {
      const e = nachId.get(id);
      if (!e || !einstellungsWertGueltig(e, wert)) return false;
      const vorher = stand();
      gespeichert.set(id, wert);
      sichere();
      melde(vorher);
      return true;
    },
    zuruecksetzen(was = {}) {
      const vorher = stand();
      for (const e of daten.einstellungen)
        if ((!was.id || was.id === e.id) && (!was.gruppe || was.gruppe === e.gruppe)) gespeichert.delete(e.id);
      sichere();
      melde(vorher);
    },
    abonniere(id, fn) {
      const s = abos.get(id) ?? new Set(); s.add(fn); abos.set(id, s);
      return () => { s.delete(fn); };
    },
    setzeVorschlag(stufe) {
      const vorher = stand();
      vorschlag = stufe;
      melde(vorher);
    },
    wirksameStufe,
    persoenlich: () => Object.fromEntries(daten.einstellungen
      .filter(e => e.wirkt === 'spieler').map(e => [e.id, loese(e.id)[0]])),
  };
}

let seite: EinstellungsSpeicher | null = null;
/** Der eine Speicher der Seite: `localStorage` und `location.search`. Ohne Browser ein Speicher im Arbeitsspeicher. */
export function einstellungen(): EinstellungsSpeicher {
  if (seite) return seite;
  let speicher: Speicher | null = null;
  try { speicher = typeof localStorage === 'undefined' ? null : localStorage; } catch { /* gesperrt */ }
  seite = erzeugeSpeicher({
    speicher,
    adresse: typeof location === 'undefined' ? undefined : new URLSearchParams(location.search),
  });
  return seite;
}
