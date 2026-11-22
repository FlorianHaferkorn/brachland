/**
 * BRACHLAND — Kampfende: getötet oder gereinigt (D417)
 *
 * Seit D376 heisst `phase === 'gefallen'` „aus dem Kampf“; ob besiegt oder gereinigt, steht in
 * `Kaempfer.ausgang`. Bis D417 kannte die Szene nur „Sieg oder Niederlage“. Hier wird aus der Kampfwelt
 * ein **Bericht** je Gegner, den `main.tsx` in den Spielstand übersetzt (`spiel/begegnungen.ts`):
 * Getötete Tiere geben Material und zählen voll beim Zähler, Gereinigte geben Läuterung und zählen ¼
 * (D379, D404/D405/D406).
 *
 * Welche Kreatur hinter einer Gegnerart steht (`KREATUR_DER_ART`), ist dieselbe Zuordnung, mit der der
 * Kampfplatz das Modell lädt — die Aufträge zählen nach Kreatur (`reinige k7-wolf`), nicht nach Kampfwert.
 *
 * Renderfrei: `tests/markengriff.test.ts`.
 */
import type { Kampfwelt, Kaempfer } from './echtzeit.js';

/** Gegnerart des Echtzeitkampfs → Kreatur der Welt (`content/creatures/`). Menschen und Kapsel haben keine. */
export const KREATUR_DER_ART: Readonly<Record<string, string>> = {
  keiler: 'wurzelkeiler', grathorn: 'grathorn', wolf: 'k7-wolf', fuchs: 'spuerfuchs', gams: 'nebelgams',
};

/** Wie ein Gegner aus dem Kampf ging. `steht`: noch im Kampf, als er endete (Niederlage der Spielerin). */
export type GegnerAusgang = 'getoetet' | 'gereinigt' | 'steht';

export function ausgangVon(k: Kaempfer): GegnerAusgang {
  if (k.ausgang === 'gereinigt') return 'gereinigt';
  return k.phase === 'gefallen' ? 'getoetet' : 'steht';
}

export interface GegnerBericht {
  /** Id im Kampf (`wolf-2`). */
  id: string;
  /** Gegnerart (`wolf`), wie in der Aufstellung. */
  art: string;
  /** Kreatur der Welt (`k7-wolf`), bei Menschen die Art selbst. */
  kreatur: string;
  mensch: boolean;
  /** Platz in der Aufstellung, ab 1. */
  platz: number;
  ausgang: GegnerAusgang;
  x: number; z: number;
}

export interface Kampfbericht {
  sieg: boolean;
  gegner: GegnerBericht[];
  /** Ladung der Marke am Ende, `null` ohne Marke. */
  markenLadung: number | null;
}

/**
 * Bericht über eine Kampfwelt. `aufstellung[i]` ist die Art von `w.gegner[i]` (so baut `Kampfplatz` sie).
 * Sieg heisst: Die Spielerin steht, und kein Gegner steht mehr — gleich, ob getötet oder gereinigt.
 */
export function kampfbericht(w: Kampfwelt, aufstellung: readonly string[]): Kampfbericht {
  const gegner = w.gegner.map((g, i): GegnerBericht => {
    const art = aufstellung[i] ?? g.id.replace(/-\d+$/, '');
    return { id: g.id, art, kreatur: KREATUR_DER_ART[art] ?? art, mensch: !!g.werte.mensch, platz: i + 1,
             ausgang: ausgangVon(g), x: g.x, z: g.z };
  });
  return {
    sieg: w.spielerin.phase !== 'gefallen' && gegner.every(g => g.ausgang !== 'steht'),
    gegner,
    markenLadung: w.marke ? w.marke.ladung : null,
  };
}
