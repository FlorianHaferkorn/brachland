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
