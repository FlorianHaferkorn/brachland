/**
 * BRACHLAND — Belohnungen auflösen (D393)
 *
 * Aufträge und Story (D392) vergeben Belohnungen als **Kategorie** (`aufwertung-1..4`, `verbrauch`,
 * `werkzeug`, `waffe`, `ruestung`, `marke`, `wissen`, `zugang`). Hier wird daraus Gegenstand und
 * Menge — aus `content/belohnungen.json`, nicht aus Zahlen im Code.
 *
 * Zwei Sorten:
 * - **Mengenware** (Material, Verbrauch, Eichsiegel): ein Gegenstand, die Menge hängt an der Sprosse
 *   der Belohnungsleiter. Gibt es mehrere Kandidaten (`verbrauch`), entscheidet der Schlüssel der
 *   Vergabestelle — derselbe Auftrag gibt immer dasselbe, zwei Aufträge nicht zwingend das Gleiche.
 * - **Unikate** (Werkzeug, Fundwaffe, Zeug, Wissen, Zugang): jedes Stück höchstens einmal je
 *   Spielstand. Deshalb wird nie einzeln gewürfelt, sondern über alle Vergabestellen verteilt.
 *   Das ist die Regel gegen Kopier-Belohnungen: Ist der Vorrat leer, ist das ein Fehler im Inhalt.
 *
 * Rein, ohne three.js und React (`tests/oekonomie.test.ts`).
 */
import type { Belohnungen, BelohnungsKategorie, BelohnungsRang } from '../data/schema.js';

/** Eine Stelle, an der etwas vergeben wird: Auftrag, Ort, Figurenstation. */
export interface Vergabe {
  /** Eindeutig je Stelle, z. B. die Auftrags-ID. Entscheidet bei mehreren Kandidaten. */
  schluessel: string;
  kategorie: BelohnungsKategorie;
  rang: BelohnungsRang;
  region: string;
  /** Bestimmter Gegenstand statt „der nächste freie“ (bei Unikaten und `verbrauch`). */
  wunsch?: string;
}

export type Auflösung =
  | { ok: true; schluessel: string; belohnung: Record<string, number> }
  | { ok: false; schluessel: string; grund: string };

/** FNV-1a mit Nachmischen — wie `wildZustand` in `heilung.ts`, damit fortlaufende IDs streuen. */
function streu(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function istUnikat(t: Belohnungen, k: BelohnungsKategorie): boolean {
  return k in t.unikate;
}

/** Mengenware einer Stelle. `null`, wenn die Kategorie auf dieser Sprosse nichts hergibt. */
export function loeseMenge(t: Belohnungen, v: Vergabe): Record<string, number> | null {
  const kandidaten = (t.mengen[v.kategorie] ?? []).filter(k => (k.menge[v.rang] ?? 0) > 0);
  if (!kandidaten.length) return null;
  const gewaehlt = v.wunsch
    ? kandidaten.find(k => k.gegenstand === v.wunsch)
    : kandidaten[Math.floor(streu(v.schluessel) * kandidaten.length)];
  if (!gewaehlt) return null;
  return { [gewaehlt.gegenstand]: gewaehlt.menge[v.rang]! };
}

/**
 * Löst alle Vergabestellen eines Spielstands auf einmal auf. Unikate gehen in der Reihenfolge des
 * Vorrats an die Stellen in Reihenfolge ihrer Schlüssel (stabil, unabhängig von der Dateireihenfolge);
 * Wünsche zuerst. Ein Stück, das `schonVergeben` nennt, wird nicht noch einmal ausgegeben.
 */
export function verteile(t: Belohnungen, stellen: readonly Vergabe[], schonVergeben: readonly string[] = []): Auflösung[] {
  const weg = new Set(schonVergeben);
  const ergebnis = new Map<Vergabe, Auflösung>();
  const nein = (v: Vergabe, grund: string) => ergebnis.set(v, { ok: false, schluessel: v.schluessel, grund });
  const ja = (v: Vergabe, belohnung: Record<string, number>) => ergebnis.set(v, { ok: true, schluessel: v.schluessel, belohnung });
  const sortiert = [...stellen].sort((a, b) => a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0);

  for (const v of sortiert) if (!istUnikat(t, v.kategorie)) {
    const m = loeseMenge(t, v);
    if (m) ja(v, m); else nein(v, `'${v.kategorie}' gibt auf der Sprosse '${v.rang}' nichts her${v.wunsch ? ` (Wunsch '${v.wunsch}')` : ''}`);
  }
  const unikate = sortiert.filter(v => istUnikat(t, v.kategorie));
  const vorrat = (v: Vergabe) => t.unikate[v.kategorie]?.[v.region] ?? [];
  // Erst die Wünsche, damit „der nächste freie“ niemandem sein bestimmtes Stück wegnimmt.
  for (const v of unikate) if (v.wunsch) {
    if (!vorrat(v).includes(v.wunsch)) nein(v, `'${v.wunsch}' liegt nicht im Vorrat '${v.kategorie}' von ${v.region}`);
    else if (weg.has(v.wunsch)) nein(v, `'${v.wunsch}' ist schon vergeben — keine Kopier-Belohnung`);
    else { weg.add(v.wunsch); ja(v, { [v.wunsch]: 1 }); }
  }
  for (const v of unikate) if (!v.wunsch) {
    const frei = vorrat(v).find(g => !weg.has(g));
    if (!frei) nein(v, `Vorrat '${v.kategorie}' in ${v.region} ist leer`);
    else { weg.add(frei); ja(v, { [frei]: 1 }); }
  }
  return stellen.map(v => ergebnis.get(v)!);
}

/** Mehrere Belohnungen zu einer zusammenlegen (ein Auftrag mit zwei Kategorien). */
export function lege(...teile: Record<string, number>[]): Record<string, number> {
  const summe: Record<string, number> = {};
  for (const t of teile) for (const [g, n] of Object.entries(t)) summe[g] = (summe[g] ?? 0) + n;
  return summe;
}
