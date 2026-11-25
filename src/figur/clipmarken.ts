/**
 * BRACHLAND — Clipmarken lesen (D457), rein, ohne three.js.
 *
 * Die Marken gehören **D456** (`content/clipmarken.json`, Schema `Clipmarken` in `src/data/schema.ts`): je Clip
 * der Spielfigur Bildnummern bei `bildrate` Bildern je Sekunde, Clipzeit = Bild / `bildrate`. Hier steht kein
 * zweites Schema, nur der **Leser**, der daraus die Zahlen holt, die `kette.ts` braucht — in Clipsekunden:
 *
 * - `einstieg` ← `einstieg`: ab hier beginnt ein geketteter Schlag (aus der Kettenpose des vorigen, ohne Hut);
 * - `kettenpose` ← `kette`: erstes Schlüsselbild nach dem Durchzug, frühester Absprung in den nächsten Schlag;
 * - `halt` ← `halt`: letztes Schlüsselbild vor der Rückkehr in die Hut (noch nicht ausgewertet).
 *
 * **Fehlt die Datei oder ein Clip darin, ist das kein Fehler:** Die Laufzeit fällt auf Clipanfang und Clipende
 * zurück (`hiebClipzeit` ohne Marken), der Versatz klingt per Inertialisierung ab. Unbekanntes wird übergangen,
 * nie geworfen — die Prüfung der Datei ist Sache von `npm run validate` und `tests/clipguete.test.ts`.
 */
import type { Clipmarken } from '../data/schema.js';

export interface Kettenmarke { einstieg?: number; kettenpose?: number; halt?: number }

const zahl = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined);

/** Marken je Clipname, in **Clipsekunden**. Nur Clips mit mindestens einer Marke. */
export function leseClipmarken(roh: unknown): Map<string, Kettenmarke> {
  const aus = new Map<string, Kettenmarke>();
  if (!roh || typeof roh !== 'object') return aus;
  const r = roh as Partial<Clipmarken>;
  const jeSek = zahl(r.bildrate) || 24;
  if (!r.clips || typeof r.clips !== 'object') return aus;
  for (const [name, m] of Object.entries(r.clips)) {
    if (!m || typeof m !== 'object') continue;
    const einstieg = zahl(m.einstieg), kette = zahl(m.kette), halt = zahl(m.halt);
    if (einstieg === undefined && kette === undefined && halt === undefined) continue;
    const marke: Kettenmarke = {};
    if (einstieg !== undefined) marke.einstieg = einstieg / jeSek;
    if (kette !== undefined) marke.kettenpose = kette / jeSek;
    if (halt !== undefined) marke.halt = halt / jeSek;
    aus.set(name, marke);
  }
  return aus;
}
