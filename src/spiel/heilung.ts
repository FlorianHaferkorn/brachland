/**
 * BRACHLAND — Heilung einer Region (D240)
 *
 * Story-Bibel §6: Heilung ist ein Prozess, kein Knopf — **besiegen → umschreiben →
 * Wandel**. Besiegen steht im Spielstand (`regenten`). Umschreiben heisst: die drei
 * Reinkultur-Komponenten des Regenten (`regent.reinkulturen`) am Regentenort einsetzen.
 * „Ohne vollständigen Satz keine Heilung“ — deshalb alle drei oder keine.
 *
 * Reines Modul ohne three.js und React (`tests/heilung.test.ts`).
 */

/** Was die Regel vom Spielstand braucht — bewusst klein, wie `Taten`. */
export interface Heilstand {
  regenten: readonly string[];
  geheilt: readonly string[];
  beutel: Readonly<Record<string, number>>;
}

/** Was die Regel vom Regenten braucht. */
export interface Heilziel {
  id: string;
  reinkulturen: readonly string[];
}

export type Heillage = 'unbesiegt' | 'unvollstaendig' | 'bereit' | 'geheilt';

/** Welche Komponenten noch fehlen, in der Reihenfolge des Regenten. */
export function fehlende(r: Heilziel, s: Heilstand): string[] {
  return r.reinkulturen.filter(id => (s.beutel[id] ?? 0) < 1);
}

export function heillage(r: Heilziel, s: Heilstand): Heillage {
  if (s.geheilt.includes(r.id)) return 'geheilt';
  if (!s.regenten.includes(r.id)) return 'unbesiegt';
  return fehlende(r, s).length ? 'unvollstaendig' : 'bereit';
}

/**
 * Setzt die Komponenten ein: je eine verbraucht, Regent in `geheilt`. Liefert `null`,
 * wenn die Lage nicht `bereit` ist — dann bleibt alles, wie es war.
 */
export function heile(r: Heilziel, s: Heilstand): { beutel: Record<string, number>; geheilt: string[] } | null {
  if (heillage(r, s) !== 'bereit') return null;
  const beutel = { ...s.beutel };
  for (const id of r.reinkulturen) {
    beutel[id] -= 1;
    if (beutel[id] <= 0) delete beutel[id];
  }
  return { beutel, geheilt: [...s.geheilt, r.id] };
}

/**
 * Zustand eines Wildlings aus einem Vorkommen (D241). Vor der Heilung ist ein fester Anteil
 * `befall` befallen — welcher, entscheidet ein Hash der Vorkommen-Id, nicht der Zufall: Dasselbe
 * Tier ist bei jeder Begegnung dasselbe, und ein Neuladen würfelt nichts neu. Nach der Heilung
 * ist jedes Vorkommen rein.
 */
export function wildZustand(vorkommen: string, befall: number, geheilt: boolean): 'rein' | 'befallen' {
  if (geheilt || befall <= 0) return 'rein';
  let h = 2166136261;
  for (let i = 0; i < vorkommen.length; i++) { h ^= vorkommen.charCodeAt(i); h = Math.imul(h, 16777619); }
  // Nachmischen (fmix32): FNV allein streut fortlaufende Ids schief (0,35 statt 0,30 gemessen).
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296 < befall ? 'befallen' : 'rein';
}
