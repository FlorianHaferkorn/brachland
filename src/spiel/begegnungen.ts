/**
 * BRACHLAND — Folgen einer Begegnung im Echtzeitkampf (D417)
 *
 * Aus dem Kampfbericht (`kampf/kampfende.ts`) wird der Spielstand:
 *
 * - **Gereinigte Tiere** → `gereinigt` (zählt für Aufträge `reinige`, für die Läuterung, beim Zähler ¼).
 * - **Getötete Tiere** → `besiegt` (zählt für `besiege`, beim Zähler voll). Menschen stehen in keiner
 *   der beiden Listen: Über sie urteilt eine eigene Achse (D385), nicht der Zähler der Tiere.
 * - **Menschen (D426)** geben beim ersten Haltungsbruch auf. Getötet (auch nach der Aufgabe) → Begegnung `getoetet`
 *   mit `mensch: true`: zählt beim Zähler der Mönche voll (`wanderfiguren.ts` `eingriffe`, D404/D406), in keinem
 *   Revier. Verschont → Begegnung `verschont`: kein Eingriff, kein Revier, keine Beute (`teileBeute`).
 * - **Marke** → `marke.ladung` ist, was am Ende übrig war.
 * - Jedes Ende eines Gegners wird eine `Begegnung` (Schnittstelle D416, `spiel/reviere.ts`). Die Ereignisse gibt
 *   `main.tsx` an `meldeBegegnungRef` → `vermerkeBegegnung` (`stand.begegnungen`). Die `gegnerId` ist dieselbe ID
 *   wie in `gereinigt`/`besiegt` — die Reviere zählen eine ID, die in `begegnungen` steht, nicht noch einmal.
 *
 * Beides gilt auch nach einer Niederlage: Wer vor dem eigenen Sturz ein Tier gereinigt hat, hat es
 * gereinigt. Beute (`teileBeute`) gibt es nur beim Sieg.
 *
 * IDs: `<kreatur>:<begegnung>:<platz>:<zeit>` — mit der Kreatur vorn, weil Aufträge und Zähler nach
 * diesem Präfix zählen (`spiel/auftraege.ts` `zaehle`), und mit der Zeit, weil ein Wegelager nach
 * 40 Minuten wieder besetzt ist und dieselbe Begegnung ein zweites Mal zählen soll.
 *
 * Renderfrei: `tests/markengriff.test.ts`.
 */
import type { Kampfbericht } from '../kampf/kampfende.js';
import type { Spielstand } from './spielstand.js';
import type { Begegnung } from './reviere.js';
import { FUNKE_PREIS, MAX_STUFE, angebot } from './schmiede.js';

export interface Begegnungsrahmen {
  /** Wo es geschah: Lager-ID, auf dem Übungsplatz nichts (der zählt nicht). */
  begegnung: string;
  /** Stabile ID eines einzelnen Wildtiers; Lager können nach einer Rast neu besetzt sein. */
  vorkommen?: string;
  region: string;
  zeit: number;
}

export interface Folgen {
  /** `gereinigt`, `besiegt`, `marke` neu; `begegnungen` nicht — die schreibt `vermerkeBegegnung` je Ereignis. */
  stand: Spielstand;
  /**
   * Je Gegner, der aus dem Kampf ging, eine `Begegnung` (Menschen eingeschlossen: `wegelagerer:…`; die Reviere finden
   * für sie keine Zelle). `umgangen` meldet der Kampf nie — einem Wegelager weicht man nicht aus, es stellt einen.
   */
  ereignisse: Begegnung[];
  getoetet: number;
  gereinigt: number;
  /** D426: Menschen, die aufgaben und gingen. */
  verschont: number;
}

/** Den Kampfbericht in den Spielstand übersetzen. Beute ist getrennt (`teileBeute`). */
export function folgenDerBegegnung(stand: Spielstand, b: Kampfbericht, r: Begegnungsrahmen): Folgen {
  const gereinigt = [...stand.gereinigt], besiegt = [...stand.besiegt];
  const ereignisse: Begegnung[] = [];
  let nTot = 0, nRein = 0, nSchon = 0;
  for (const g of b.gegner) {
    if (g.ausgang === 'steht') continue;
    const id = r.vorkommen ?? `${g.kreatur}:${r.begegnung}:${g.platz}:${r.zeit}`;
    if (g.ausgang === 'gereinigt') { gereinigt.push(id); nRein++; }
    else if (g.ausgang === 'verschont') nSchon++;
    else { if (!g.mensch) besiegt.push(id); nTot++; }
    ereignisse.push({ art: g.ausgang, gegnerId: id, region: r.region, x: g.x, z: g.z, zeit: r.zeit, ...(g.mensch ? { mensch: true as const } : {}) });
  }
  const neu: Spielstand = { ...stand, gereinigt, besiegt,
    marke: b.markenLadung === null ? stand.marke : { ...stand.marke, ladung: b.markenLadung } };
  return { stand: neu, ereignisse, getoetet: nTot, gereinigt: nRein, verschont: nSchon };
}

/**
 * Was die Schmiede nimmt — heute die Währung aus D177 (`schmiede.ts`), abgeleitet aus deren Preisen statt
 * abgeschrieben. Zusammen mit Gegenständen der Wirkung `material` (D393) ist das „Material“ im Sinn von D379.
 */
export const SCHMIEDE_WAEHRUNG: ReadonlySet<string> = new Set([
  ...Array.from({ length: MAX_STUFE }, (_, s) => Object.keys(angebot('klinge', s)?.preis ?? {})).flat(),
  ...Object.keys(FUNKE_PREIS),
]);

/**
 * Beute eines gewonnenen Wegelagers nach D379: **Material nur von Getöteten.** Jeder Gegner trägt
 * denselben Anteil; was ein Gereinigter getragen hätte, bleibt bei ihm (abgerundet). Alles andere —
 * Sud, Köder, Netz — liegt im Lager und bleibt ganz. D426: Ein Verschonter nimmt seinen Anteil mit wie ein
 * Gereinigter (Arbeitsregel; Vorschlag, dass er die Waffe liegen lässt, in A-41).
 *
 * Arbeitsregel, nicht gemessen: Das Lager hat eine gemeinsame Beute, keine je Gegner; Raten je Tier
 * (`oekonomie.json` `beute.tier`, D393) liest das Spiel noch nicht.
 */
export function teileBeute(beute: Readonly<Record<string, number>>, b: Kampfbericht,
  istMaterial: (id: string) => boolean): Record<string, number> {
  const aus = b.gegner.filter(g => g.ausgang !== 'steht');
  const tot = aus.filter(g => g.ausgang === 'getoetet').length;
  const anteil = aus.length === 0 ? 1 : tot / aus.length;
  const neu: Record<string, number> = {};
  for (const [id, n] of Object.entries(beute)) {
    const m = istMaterial(id) ? Math.floor(n * anteil + 1e-9) : n;
    if (m > 0) neu[id] = m;
  }
  return neu;
}
