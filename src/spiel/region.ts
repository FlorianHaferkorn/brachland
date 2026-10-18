/**
 * BRACHLAND — welche Region gerade geladen ist (ADR-0014)
 *
 * Jede Region ist eine eigene Karte. Welche, sagt `?region=<id>`; ohne Angabe, und überall,
 * wo es keine Adresszeile gibt (Tests, Werkzeuge), ist es das Œntal. Alles, was vor dem
 * Fahlmoos gebaut wurde, sieht dadurch genau die Welt wie bisher.
 *
 * Renderfrei und ohne `content/`-Import: `bauwerke.ts` liest die Region beim Laden des
 * Moduls, und das läuft auch unter `tsx` in den Tests, wo `import.meta.glob` fehlt.
 * Ob es die Region gibt, prüft deshalb erst `main.tsx` gegen `REGIONEN`.
 */
import type { Region } from '../data/schema.js';

export const START_REGION = 'oental';

export type Seite = Region['nachbarn'][number]['seite'];

/** Region aus der Adresszeile. Leer oder nicht gesetzt heißt Œntal. */
export function regionAusSuche(suche: string): string {
  return new URLSearchParams(suche).get('region')?.trim().toLowerCase() || START_REGION;
}

export const AKTIVE_REGION: string =
  typeof location === 'undefined' ? START_REGION : regionAusSuche(location.search);

/** Nur, was in dieser Region liegt. Aufträge, Orte und Fundstücke tragen ihre Region selbst. */
export const inRegion = <T extends { region: string }>(liste: Iterable<T>, region: string): T[] =>
  [...liste].filter(x => x.region === region);

/**
 * An welcher Kante die Spielfigur steht. `x` wächst nach Osten, `z` nach Süden
 * (`nachMetern`); `halbB`/`halbT` sind die halbe Breite und Tiefe der begehbaren Fläche.
 * Auf einer Ecke gewinnt die Seite, über die man weiter hinausgedrückt hat.
 */
export function randSeite(x: number, z: number, halbB: number, halbT: number): Seite | null {
  const ueberX = Math.abs(x) - halbB, ueberZ = Math.abs(z) - halbT;
  if (ueberX <= 0 && ueberZ <= 0) return null;
  if (ueberZ >= ueberX) return z < 0 ? 'nord' : 'sued';
  return x > 0 ? 'ost' : 'west';
}

/** Die Nachbarregion hinter dieser Kante, sonst `null`. */
export const nachbarAn = (region: Pick<Region, 'nachbarn'>, seite: Seite | null): string | null =>
  (seite && region.nachbarn.find(n => n.seite === seite)?.region) ?? null;

/** Dieselbe Adresse, andere Region. Alle übrigen Schalter (`?weite=`, `?kampf=` …) bleiben. */
export function adresseFuer(region: string, suche: string): string {
  const p = new URLSearchParams(suche);
  if (region === START_REGION) p.delete('region'); else p.set('region', region);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** So weit innerhalb der Kante kommt man an — weit genug, dass der Randhinweis nicht sofort wieder anschlägt. */
export const ANKUNFT_ABSTAND = 25;

/**
 * Wo man nach dem Übergang steht: an der Kante zur Herkunftsregion, in ihrer Mitte. Kennt die Region
 * die Herkunft nicht (alter Stand, Messadresse), ist es die Regionsmitte wie vor ADR-0014.
 */
export function ankunft(
  region: Pick<Region, 'nachbarn'>, herkunft: string, breite: number, tiefe: number,
): [number, number] {
  const seite = region.nachbarn.find(n => n.region === herkunft)?.seite;
  const b = breite / 2 - ANKUNFT_ABSTAND, t = tiefe / 2 - ANKUNFT_ABSTAND;
  switch (seite) {
    case 'nord': return [0, -t];
    case 'sued': return [0, t];
    case 'ost': return [b, 0];
    case 'west': return [-b, 0];
    default: return [0, 0];
  }
}
