/**
 * BRACHLAND — Reviere: Lage, Zustand aus dem Spielstand, Regeln an der Rast (D416)
 *
 * An Revieren hängen vier Dinge aus D379/D393/D399/D400/D402/D406: das **ruhige Revier** (die Rast dort lädt die
 * Marke um die halbe Fassung), die Stufe **„vertraut“** des Zählers der Mönche (geduldet und mindestens die Hälfte der
 * Reviere unberührt), die **Verhärtung** (jedes zweite leergetötete Revier zieht einen Verhärteten nach) und das
 * **Nachwachsen** (im selben Revier nie, aus Nachbarrevieren bis zur Hälfte, solange die Region nicht geheilt ist).
 *
 * **Woraus der Zustand kommt.** Gespeichert wird nur, was der Spieler getan hat (wie überall, `spielstand.ts`):
 * - `begegnungen` (seit Spielstand v3): was der Kampf meldet, mit Lage — `vermerkeBegegnung` (Schnittstelle D417).
 *   Das Revier wird beim Lesen aus der Lage bestimmt, nicht gespeichert; ändern sich die Grenzen in den Daten, folgt
 *   der Zustand.
 * - `besiegt` / `gefangen` (Bestand): Vorkommen-IDs `kreatur:i:j` tragen ihre Zelle im Weltraster — daraus folgt das
 *   Revier. Gereinigt zählt seit D417 `gereinigt` (Migration v4 hat die alten `gefangen` übernommen); ein Stand ohne
 *   das Feld fällt auf `gefangen` zurück (D375). Eine ID, die schon in `begegnungen` steht, zählt nicht zweimal —
 *   der Echtzeitkampf meldet dieselbe ID dort und in `gereinigt`/`besiegt`.
 * - `reviere` (seit v3): nur, was Regeln an der Rast entschieden haben und nicht ableitbar ist — Zahl der Rasten,
 *   Reihenfolge der leergetöteten Reviere, nachgezogene Verhärtete, zugewanderte Tiere.
 *
 * **ADR-0020 (zusammenhängende Welt):** Nichts hier nimmt „eine Region = ganze Welt“ an. `baueRevierwelt` nimmt die
 * Karten aller Regionen; `revierAnGeo` sucht erst die Region aus der Lage. Nachbarn dürfen IDs anderer Regionen sein.
 *
 * Alle Schwellen sind Daten (`content/oekonomie.json` `marke`, `toeten`, `reviere`; `content/wanderfiguren/zaehler.json`).
 * Rein, ohne three.js und React (`tests/reviere.test.ts`).
 */
import type { Oekonomie, Revier, Revierkarte } from '../data/schema.js';

// ------------------------------------------------------------------ Typen

export type BegegnungsArt = 'getoetet' | 'gereinigt' | 'umgangen';
export const BEGEGNUNGSARTEN: readonly BegegnungsArt[] = ['getoetet', 'gereinigt', 'umgangen'];

/**
 * Was der Kampf je Begegnung meldet (Schnittstelle zu D417): wie sie ausging, wer, wo (Meter der Region, x Ost,
 * z Süd), wann (ms seit 1970). Ein Rudel meldet je Tier ein Ereignis.
 */
export interface Begegnung {
  art: BegegnungsArt;
  gegnerId: string;
  region: string;
  x: number;
  z: number;
  zeit: number;
}

/** Was eine Rast je Revier entschieden hat. Fehlende Felder heissen 0. */
export interface RevierFortschritt {
  /** Nachgezogene Verhärtete (Verhärtung, D400/D402). */
  verhaertet?: number;
  /** Aus Nachbarrevieren zugewanderte Tiere (Nachwachsen, D393/D399). */
  zugewandert?: number;
  /** Rasten, seit hier etwas nachwachsen dürfte (zählt bis `nachwachsen.abRasten`). */
  wartet?: number;
}

export interface Revierstand {
  rasten: number;
  /** Leergetötete Reviere in der Reihenfolge, in der eine Rast sie als leer gesehen hat — „jedes zweite“ zählt hier. */
  leerFolge: string[];
  je: Record<string, RevierFortschritt>;
}

export const LEERER_REVIERSTAND: Revierstand = { rasten: 0, leerFolge: [], je: {} };

/** Der Teil des Spielstands, den die Reviere lesen. */
export interface StandMitRevieren {
  region: string;
  besiegt: readonly string[];
  gefangen: readonly string[];
  /** D417: gereinigte IDs; ohne das Feld (Stand vor v4, Tests) zählt `gefangen` als gereinigt. */
  gereinigt?: readonly string[];
  begegnungen?: readonly Begegnung[];
  reviere?: Revierstand;
}

/** Regeln als Daten, aus `oekonomie.json` gelesen (`regelnAus`). */
export interface Revierregeln {
  ruhigAb: number;
  ruhigMindestens: number;
  ruhigeRast: number;
  leerAb: number;
  verhaertungJeLeeremRevier: number;
  bezug: 'bestand' | 'begegnet';
  /** Bei `begegnet`: Nenner mindestens dieser Anteil des Bestands. */
  mindestBestand: number;
  nachwachsen: { abRasten: number; anteil: number; jeRast: number };
}

export function regelnAus(o: Oekonomie): Revierregeln {
  if (!o.reviere) throw new Error('oekonomie.json: Block `reviere` fehlt (D416)');
  return {
    ruhigAb: o.marke.ruhigAb, ruhigMindestens: o.marke.ruhigMindestens, ruhigeRast: o.marke.ruhigeRast,
    leerAb: o.toeten.leerAb, verhaertungJeLeeremRevier: o.toeten.verhaertungJeLeeremRevier,
    bezug: o.reviere.bezug, mindestBestand: o.reviere.mindestBestand, nachwachsen: o.reviere.nachwachsen,
  };
}

// ------------------------------------------------------------------ Lage

const METER_JE_GRAD = 111_320;
type BBox = readonly [number, number, number, number];

/** Breite und Tiefe einer Region in Metern — dieselbe Rechnung wie `regionsMasse` in `data/inhalte.ts`. */
export function masseAus(bbox: BBox): { breite: number; tiefe: number } {
  const [sued, west, nord, ost] = bbox;
  return { breite: (ost - west) * METER_JE_GRAD * Math.cos((sued + nord) / 2 * Math.PI / 180), tiefe: (nord - sued) * METER_JE_GRAD };
}

export interface Revierwelt {
  /** Revier an einer Stelle der Region (Meter der Region). Ausserhalb der Region: das Randrevier (geklemmt). */
  revierAn(region: string, x: number, z: number): Revier | null;
  /** Revier an einer geographischen Lage — sucht zuerst die Region, deren Bbox die Lage enthält (ADR-0020). */
  revierAnGeo(lat: number, lon: number): Revier | null;
  /** Zelle des Revierrasters einer Lage (für Werkzeuge und Tests). */
  zelleAn(region: string, x: number, z: number): [number, number] | null;
  revier(id: string): Revier | undefined;
  /** Alle Reviere einer Region. */
  reviereVon(region: string): readonly Revier[];
  /** Region eines Reviers. */
  regionVon(revierId: string): string | undefined;
  /** Lage einer Vorkommen-ID `kreatur:i:j` (Zelle des Weltrasters, Mitte) — `null` für andere IDs. */
  vorkommenLage(region: string, id: string): [number, number] | null;
}

/** Revierwelt aus den Karten aller Regionen und deren Bbox (`content/regions/*.json`). */
export function baueRevierwelt(karten: readonly Revierkarte[], regionen: readonly { id: string; bbox: BBox }[]): Revierwelt {
  const je = new Map<string, { karte: Revierkarte; bbox: BBox; masse: { breite: number; tiefe: number }; nachZeichen: Map<string, Revier> }>();
  const alle = new Map<string, Revier>(), regionVon = new Map<string, string>();
  for (const k of karten) {
    const r = regionen.find(x => x.id === k.region);
    if (!r) throw new Error(`Revierkarte '${k.region}': Region fehlt`);
    je.set(k.region, { karte: k, bbox: r.bbox, masse: masseAus(r.bbox), nachZeichen: new Map(k.reviere.map(v => [v.zeichen, v])) });
    for (const v of k.reviere) { alle.set(v.id, v); regionVon.set(v.id, k.region); }
  }
  const zelleAn = (region: string, x: number, z: number): [number, number] | null => {
    const e = je.get(region);
    if (!e || !Number.isFinite(x) || !Number.isFinite(z)) return null;
    const { spalten, zeilen } = e.karte.raster;
    const j = Math.max(0, Math.min(spalten - 1, Math.floor((x / e.masse.breite + 0.5) * spalten)));
    const i = Math.max(0, Math.min(zeilen - 1, Math.floor((z / e.masse.tiefe + 0.5) * zeilen)));
    return [i, j];
  };
  const revierAn = (region: string, x: number, z: number): Revier | null => {
    const c = zelleAn(region, x, z);
    if (!c) return null;
    const e = je.get(region)!;
    return e.nachZeichen.get(e.karte.raster.karte[c[0]][c[1]]) ?? null;
  };
  return {
    revierAn, zelleAn,
    revierAnGeo(lat, lon) {
      for (const [region, e] of je) {
        const [sued, west, nord, ost] = e.bbox;
        if (lat < sued || lat > nord || lon < west || lon > ost) continue;
        return revierAn(region, ((lon - west) / (ost - west) - 0.5) * e.masse.breite, ((nord - lat) / (nord - sued) - 0.5) * e.masse.tiefe);
      }
      return null;
    },
    revier: id => alle.get(id),
    reviereVon: region => je.get(region)?.karte.reviere ?? [],
    regionVon: id => regionVon.get(id),
    vorkommenLage(region, id) {
      const e = je.get(region);
      const m = /^[^:]+:(\d+):(\d+)$/.exec(id);
      if (!e || !m) return null;
      const n = e.karte.raster.vorkommenRaster;
      const i = Number(m[1]), j = Number(m[2]);
      if (i >= n || j >= n) return null;
      // Wie `rasterZuWelt` in `world/terrain.ts` (ohne den Versatz in der Zelle, der höchstens eine halbe Zelle beträgt).
      return [(j / (n - 1) - 0.5) * e.masse.breite, (i / (n - 1) - 0.5) * e.masse.tiefe];
    },
  };
}

/** Erwarteter Bestand eines Reviers: Summe der Tiere aus dem Vorkommen. */
export function bestand(r: Revier): number {
  return Object.values(r.tiere).reduce((a, b) => a + b, 0);
}

// ------------------------------------------------------------------ Schnittstelle D417

const rund = (v: number) => Math.round(v * 10) / 10;

/**
 * Eine Begegnung im Spielstand vermerken (Schnittstelle zu D417: der Kampf ruft das je Tier am Ende einer Begegnung).
 * Gibt einen neuen Stand zurück; der alte bleibt unverändert. Dieselbe Meldung (gleiches Tier, gleiche Zeit, gleicher
 * Ausgang) zählt einmal — StrictMode und doppelte Rufe schaden nicht. Eine ungültige Meldung (leere ID, NaN-Lage,
 * unbekannte Art) ändert nichts. Das Revier wird **nicht** gespeichert, sondern beim Lesen aus der Lage bestimmt.
 */
export function vermerkeBegegnung<T extends { begegnungen?: readonly Begegnung[] }>(stand: T, e: Begegnung): T {
  if (!e || !BEGEGNUNGSARTEN.includes(e.art) || typeof e.gegnerId !== 'string' || !e.gegnerId
    || typeof e.region !== 'string' || !e.region
    || !Number.isFinite(e.x) || !Number.isFinite(e.z) || !Number.isFinite(e.zeit)) return stand;
  const alt = stand.begegnungen ?? [];
  if (alt.some(b => b.gegnerId === e.gegnerId && b.zeit === e.zeit && b.art === e.art)) return stand;
  const neu: Begegnung = { art: e.art, gegnerId: e.gegnerId, region: e.region, x: rund(e.x), z: rund(e.z), zeit: e.zeit };
  return { ...stand, begegnungen: [...alt, neu] };
}

// ------------------------------------------------------------------ Zustand je Revier

export interface Revierzustand {
  revier: Revier;
  getoetet: number;
  gereinigt: number;
  /** Begegnet und weder getötet noch gereinigt. */
  umgangen: number;
  /** Verschiedene Tiere, denen man hier begegnet ist (getötet + gereinigt + umgangen). */
  begegnet: number;
  eingriffe: number;
  zugewandert: number;
  verhaertet: number;
}

/**
 * Zustand aller Reviere aus dem Spielstand. `vorkommenLage` ergänzt die Lage von IDs, die nicht `kreatur:i:j` sind
 * (feste Vorkommen, Rückkehrer nach der Heilung); ohne sie zählen solche IDs keinem Revier.
 */
export function revierZustaende(welt: Revierwelt, stand: StandMitRevieren,
  vorkommenLage?: (id: string) => [number, number] | null): Map<string, Revierzustand> {
  const raus = new Map<string, Revierzustand>();
  const z = (r: Revier) => {
    let e = raus.get(r.id);
    if (!e) {
      const f = stand.reviere?.je[r.id] ?? {};
      e = { revier: r, getoetet: 0, gereinigt: 0, umgangen: 0, begegnet: 0, eingriffe: 0, zugewandert: f.zugewandert ?? 0, verhaertet: f.verhaertet ?? 0 };
      raus.set(r.id, e);
    }
    return e;
  };
  for (const r of welt.reviereVon(stand.region)) z(r);
  for (const [id] of Object.entries(stand.reviere?.je ?? {})) { const r = welt.revier(id); if (r) z(r); }

  // 1. Gemeldete Begegnungen. Je Tier zählt jede Meldung mit Eingriff; „umgangen“ nur, wenn es danach keinen gab.
  const gemeldet = new Set<string>();
  const eingriffJe = new Set<string>();
  for (const b of stand.begegnungen ?? []) if (b.art !== 'umgangen') eingriffJe.add(`${b.region}|${b.gegnerId}`);
  const umgangenGezaehlt = new Set<string>();
  for (const b of stand.begegnungen ?? []) {
    gemeldet.add(b.gegnerId);
    const r = welt.revierAn(b.region, b.x, b.z);
    if (!r) continue;
    const e = z(r), schluessel = `${b.region}|${b.gegnerId}`;
    if (b.art === 'umgangen') {
      if (eingriffJe.has(schluessel) || umgangenGezaehlt.has(schluessel)) continue;
      umgangenGezaehlt.add(schluessel); e.umgangen++;
    } else e[b.art]++;
  }
  // 2. Bestand: `besiegt` und `gefangen` über die Zelle der Vorkommen-ID, in der Region des Stands.
  const lage = (id: string) => welt.vorkommenLage(stand.region, id) ?? vorkommenLage?.(id) ?? null;
  const zaehle = (ids: readonly string[], art: 'getoetet' | 'gereinigt', schon: Set<string>) => {
    for (const id of new Set(ids)) {
      if (id.startsWith('regent:') || gemeldet.has(id) || schon.has(id)) continue;
      const p = lage(id);
      const r = p ? welt.revierAn(stand.region, p[0], p[1]) : null;
      if (!r) continue;
      schon.add(id); z(r)[art]++;
    }
  };
  const schon = new Set<string>();
  // Getötet zuerst: erst gefangen, dann getötet (gibt es nicht, aber eingriffe() nimmt dann auch das schwerere).
  zaehle(stand.besiegt, 'getoetet', schon);
  zaehle(stand.gereinigt ?? stand.gefangen, 'gereinigt', schon);
  for (const e of raus.values()) {
    e.eingriffe = e.getoetet + e.gereinigt;
    e.begegnet = e.eingriffe + e.umgangen;
  }
  return raus;
}

/**
 * Die „Tiere des Reviers“, gegen die ruhig und leer gemessen werden (`reviere.bezug`): der Bestand (Zugewanderte
 * gehören dazu) oder die Begegneten, dann aber mindestens `mindestBestand` des Bestands.
 */
export function bezugTiere(z: Revierzustand, regeln: Pick<Revierregeln, 'bezug' | 'mindestBestand'>): number {
  const b = bestand(z.revier) + z.zugewandert;
  return regeln.bezug === 'bestand' ? b : Math.max(z.begegnet, b * regeln.mindestBestand);
}

/**
 * Ruhig (D393, A-28 (3), D399): mindestens `ruhigAb` der Eingriffe sind Reinigungen **und** mindestens
 * `ruhigMindestens` der Tiere des Reviers sind gereinigt.
 */
export function istRuhig(z: Revierzustand, regeln: Revierregeln): boolean {
  const tiere = bezugTiere(z, regeln);
  return z.eingriffe > 0 && tiere > 0
    && z.gereinigt / z.eingriffe >= regeln.ruhigAb - 1e-9
    && z.gereinigt / tiere >= regeln.ruhigMindestens - 1e-9;
}

/** Unberührt (D406): hier wurde nichts getötet und nichts gereinigt. Umgehen berührt nicht. */
export function istUnberuehrt(z: Revierzustand): boolean {
  return z.eingriffe === 0;
}

/** Leergetötet (D400): mindestens `leerAb` der Tiere des Reviers sind getötet. */
export function istLeergetoetet(z: Revierzustand, regeln: Revierregeln): boolean {
  const tiere = bezugTiere(z, regeln);
  return z.getoetet > 0 && tiere > 0 && z.getoetet / tiere >= regeln.leerAb - 1e-9;
}

/** Anteil unberührter Reviere einer Region (0…1). Ohne Reviere: 1 — dann entscheidet allein der Stand beim Zähler. */
export function unberuehrtAnteil(zustaende: ReadonlyMap<string, Revierzustand>, welt: Revierwelt, region: string): number {
  const liste = welt.reviereVon(region);
  if (!liste.length) return 1;
  return liste.filter(r => { const z = zustaende.get(r.id); return !z || istUnberuehrt(z); }).length / liste.length;
}

/** Kurzform für den Zähler: Anteil unberührter Reviere in der Region des Stands. */
export function unberuehrtAnteilVon(welt: Revierwelt, stand: StandMitRevieren,
  vorkommenLage?: (id: string) => [number, number] | null): number {
  return unberuehrtAnteil(revierZustaende(welt, stand, vorkommenLage), welt, stand.region);
}

// ------------------------------------------------------------------ Marke an der Rast

/**
 * Ladung der Marke nach einer Rast (Gegenstände v1 §7): an einer Zuflucht voll; im Freien nur in einem ruhigen Revier,
 * dann um `ruhigeRast` der Fassung (abgerundet, nie über die Fassung); in einem leeren oder befallenen Revier nichts.
 */
export function ladungNachRast(a: { ladung: number; fassung: number; zuflucht: boolean; ruhig: boolean },
  regeln: Pick<Revierregeln, 'ruhigeRast'>): number {
  if (a.zuflucht) return a.fassung;
  if (!a.ruhig) return Math.min(a.ladung, a.fassung);
  return Math.min(a.fassung, a.ladung + Math.floor(a.fassung * regeln.ruhigeRast + 1e-9));
}

// ------------------------------------------------------------------ Zähler der Mönche

export type Zaehlerstufe = 'vertraut' | 'geduldet' | 'abgewandt';

/**
 * Stufe beim Zähler (D406): *geduldet* = gewichteter Stand ≤ `anzahl`; *vertraut* = geduldet **und** mindestens
 * `unberuehrtMindestens` der Reviere unberührt. Die Werte stehen an der Station des Zählers (`misstraut`).
 */
export function zaehlerStufe(standGewichtet: number, anteilUnberuehrt: number,
  regel: { anzahl: number; unberuehrtMindestens: number }): Zaehlerstufe {
  if (standGewichtet > regel.anzahl + 1e-9) return 'abgewandt';
  return anteilUnberuehrt >= regel.unberuehrtMindestens - 1e-9 ? 'vertraut' : 'geduldet';
}

// ------------------------------------------------------------------ Ereignisse: Rast

export type Revieraenderung =
  | { art: 'leergetoetet'; revier: string; nr: number }
  | { art: 'verhaertung'; revier: string; anzahl: number }
  | { art: 'nachwachsen'; revier: string; anzahl: number; aus: string[] };

/**
 * Was eine Rast an den Revieren ändert — ausgewertet, nicht in der Szene verteilt. Gibt den neuen `Revierstand`
 * und die Änderungen zurück; wer die Welt baut, setzt sie um (heute: niemand, siehe Umsetzungsliste D416).
 *
 * 1. **Leergetötet** wird ein Revier, sobald eine Rast es so sieht; die Reihenfolge steht in `leerFolge`.
 * 2. **Verhärtung** (D400/D402): Das n-te leergetötete Revier zieht `⌊n·r⌋ − ⌊(n−1)·r⌋` Verhärtete nach
 *    (r = `verhaertungJeLeeremRevier`, 0,5 = jedes zweite). Nur solange die Region nicht geheilt ist.
 * 3. **Nachwachsen** (D393/D399): In ein Revier, in dem getötet wurde, wandern aus Nachbarrevieren Tiere nach — nie aus
 *    ihm selbst, nur wenn ein Nachbar noch befallen ist (weder ruhig noch leer), erst nach `abRasten` Rasten,
 *    höchstens `jeRast` je Rast, bis zu `anteil` der Getöteten und nie über `anteil` des Bestands. Ein ruhiges Revier
 *    nimmt nichts auf (die Gunst des Heilers bleibt). Nur solange die Region nicht geheilt ist.
 */
export function werteRastAus(welt: Revierwelt, stand: StandMitRevieren, regeln: Revierregeln,
  opt: { geheilt: boolean; vorkommenLage?: (id: string) => [number, number] | null }):
  { reviere: Revierstand; aenderungen: Revieraenderung[] } {
  const alt = stand.reviere ?? LEERER_REVIERSTAND;
  const neu: Revierstand = { rasten: alt.rasten + 1, leerFolge: [...alt.leerFolge], je: {} };
  for (const [id, f] of Object.entries(alt.je)) neu.je[id] = { ...f };
  const f = (id: string) => (neu.je[id] ??= {});
  const aenderungen: Revieraenderung[] = [];
  const zustaende = revierZustaende(welt, stand, opt.vorkommenLage);
  const liste = [...zustaende.values()].sort((a, b) => a.revier.id.localeCompare(b.revier.id));

  // 1 + 2: leer und Verhärtung
  const r = regeln.verhaertungJeLeeremRevier;
  for (const z of liste) {
    if (!istLeergetoetet(z, regeln) || neu.leerFolge.includes(z.revier.id)) continue;
    neu.leerFolge.push(z.revier.id);
    const nr = neu.leerFolge.length;
    aenderungen.push({ art: 'leergetoetet', revier: z.revier.id, nr });
    const anzahl = Math.floor(nr * r + 1e-9) - Math.floor((nr - 1) * r + 1e-9);
    if (anzahl > 0 && !opt.geheilt) {
      f(z.revier.id).verhaertet = (f(z.revier.id).verhaertet ?? 0) + anzahl;
      aenderungen.push({ art: 'verhaertung', revier: z.revier.id, anzahl });
    }
  }

  // 3: Nachwachsen
  if (!opt.geheilt) {
    const n = regeln.nachwachsen;
    for (const z of liste) {
      if (z.getoetet === 0 || istRuhig(z, regeln)) continue;
      const ziel = Math.min(Math.floor(z.getoetet * n.anteil + 1e-9), Math.floor(bestand(z.revier) * n.anteil + 1e-9));
      const offen = ziel - (f(z.revier.id).zugewandert ?? 0);
      if (offen <= 0) continue;
      const aus = z.revier.nachbarn.filter(id => {
        const nb = zustaende.get(id);
        if (!nb) return !!welt.revier(id); // Nachbar ohne Zustand: nie betreten, also befallen
        return !istRuhig(nb, regeln) && !istLeergetoetet(nb, regeln);
      });
      if (!aus.length) continue;
      const fz = f(z.revier.id);
      fz.wartet = (fz.wartet ?? 0) + 1;
      if (fz.wartet < n.abRasten) continue;
      const anzahl = Math.min(n.jeRast, offen);
      fz.zugewandert = (fz.zugewandert ?? 0) + anzahl;
      aenderungen.push({ art: 'nachwachsen', revier: z.revier.id, anzahl, aus });
    }
  }
  return { reviere: neu, aenderungen };
}
