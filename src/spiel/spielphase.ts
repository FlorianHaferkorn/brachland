/**
 * BRACHLAND — Spielphasen, echte Pause, Browser-Härtung (D415, Doc §8.5/§8.6; A-29 (1): echte Pause in
 * jedem Menü, D399)
 *
 * **Eine** Stelle entscheidet, ob die Welt läuft. Heute verteilt sich das auf rund zehn Wahrheitswerte in
 * `main.tsx` (`imKampf`, `menueOffen`, `ortOffen` …); dieses Modul ist die Regel, nach der sie
 * zusammengezogen werden — renderfrei, ohne React, mit Tests (`tests/spielphase.test.ts`).
 *
 * Phasen: `laedt` → `spielt` ⇄ `pausiert` / `menue`. Eine Pause hat **Gründe** (Spieler, Tab verborgen,
 * Grafikkontext verloren, Gamepad getrennt, Zeiger gelöst); sie endet erst, wenn kein Grund mehr übrig ist
 * **und** der Spieler fortsetzt — wer in den Tab zurückkommt, findet das Spiel angehalten vor, nicht
 * mitten in einem Schlag (Doc §8.6). Ein offenes Menü pausiert ebenso (A-29 (1)).
 *
 * Verdrahtet ist bisher nur, was ohne Pausenbildschirm sicher ist (siehe `main.tsx`): Sichern bei
 * `visibilitychange → hidden`/`pagehide` (`sollSichern`) und die Meldung beim Kontextverlust. Die Pause
 * selbst braucht einen Bildschirm mit „Fortsetzen“ — sonst stünde das Spiel nach jedem Tab-Wechsel still,
 * ohne dass man es weiterlaufen lassen könnte. Umsetzungsliste im Doc §9.1.
 */

export type Phase = 'laedt' | 'spielt' | 'pausiert' | 'menue';
export type Pausengrund = 'spieler' | 'verborgen' | 'kontext' | 'gamepad' | 'zeiger';

export interface PhasenZustand {
  phase: Phase;
  /** Offene Gründe einer Pause. Leer in `spielt`. */
  gruende: Pausengrund[];
  /** Was der Spieler erfahren soll (Kontextverlust, Gamepad getrennt); `null` = nichts. */
  meldung: string | null;
}

export type Ereignis =
  | { art: 'geladen' }
  | { art: 'menue'; offen: boolean }
  | { art: 'pause' }
  | { art: 'fortsetzen' }
  | { art: 'verborgen' }
  | { art: 'sichtbar' }
  | { art: 'kontextVerloren' }
  | { art: 'kontextZurueck' }
  | { art: 'gamepadGetrennt' }
  | { art: 'zeigerGeloest' };

export const START: PhasenZustand = { phase: 'laedt', gruende: [], meldung: null };

export const MELDUNG_KONTEXT = 'Die Grafikkarte hat das Bild verloren. Das Spiel versucht es wiederherzustellen — gelingt das nicht, bitte die Seite neu laden; der Stand ist gesichert.';
export const MELDUNG_KONTEXT_ZURUECK = 'Das Bild ist wieder da.';
export const MELDUNG_GAMEPAD = 'Das Gamepad ist getrennt — das Spiel wartet.';

const mit = (g: Pausengrund[], x: Pausengrund) => (g.includes(x) ? g : [...g, x]);
const ohne = (g: Pausengrund[], x: Pausengrund) => g.filter(y => y !== x);

export function naechste(z: PhasenZustand, e: Ereignis): PhasenZustand {
  switch (e.art) {
    case 'geladen':
      if (z.phase !== 'laedt') return z;
      return z.gruende.length ? { ...z, phase: 'pausiert' } : { ...z, phase: 'spielt' };
    case 'menue':
      if (z.phase === 'laedt') return z;
      if (e.offen) return { ...z, phase: 'menue' };
      if (z.phase !== 'menue') return z;
      return { ...z, phase: z.gruende.length ? 'pausiert' : 'spielt' };
    case 'pause':
      return z.phase === 'spielt' ? { ...z, phase: 'pausiert', gruende: mit(z.gruende, 'spieler') } : z;
    case 'fortsetzen': {
      // Fortsetzen nimmt die Gründe, die der Spieler selbst aufheben kann. Kontextverlust bleibt.
      const rest = z.gruende.filter(g => g === 'kontext');
      if (z.phase !== 'pausiert') return z;
      return { ...z, gruende: rest, phase: rest.length ? 'pausiert' : 'spielt', meldung: rest.length ? z.meldung : null };
    }
    case 'verborgen':
      return pausiere(z, 'verborgen', null);
    case 'sichtbar':
      // Bleibt pausiert: Wer zurückkommt, setzt selbst fort. Der Grund wechselt auf „spieler“.
      if (!z.gruende.includes('verborgen')) return z;
      return { ...z, gruende: mit(ohne(z.gruende, 'verborgen'), 'spieler') };
    case 'kontextVerloren':
      return pausiere(z, 'kontext', MELDUNG_KONTEXT);
    case 'kontextZurueck':
      if (!z.gruende.includes('kontext')) return z;
      return { ...z, gruende: mit(ohne(z.gruende, 'kontext'), 'spieler'), meldung: MELDUNG_KONTEXT_ZURUECK };
    case 'gamepadGetrennt':
      return pausiere(z, 'gamepad', MELDUNG_GAMEPAD);
    case 'zeigerGeloest':
      return pausiere(z, 'zeiger', null);
  }
}

function pausiere(z: PhasenZustand, grund: Pausengrund, meldung: string | null): PhasenZustand {
  const gruende = mit(z.gruende, grund);
  // Im Laden und im Menü bleibt die Phase; der Grund wird gemerkt und wirkt danach.
  const phase: Phase = z.phase === 'spielt' ? 'pausiert' : z.phase;
  return { ...z, phase, gruende, meldung: meldung ?? z.meldung };
}

/** Läuft die Simulation (Tageslauf, Kampf, Kreaturen, Kälteuhr)? Nur in `spielt`. */
export const simulationLaeuft = (z: PhasenZustand) => z.phase === 'spielt';
/** Gilt Spieleingabe? Nur in `spielt` — im Menü gehört die Tastatur dem Menü. */
export const eingabeGilt = (z: PhasenZustand) => z.phase === 'spielt';
/** Soll der Ton schweigen? Verborgen nur, wenn die Einstellung `stumm-im-hintergrund` an ist. */
export const tonStumm = (z: PhasenZustand, stummImHintergrund: boolean) =>
  z.gruende.includes('verborgen') ? stummImHintergrund : false;

/**
 * Soll bei diesem Ereignis gesichert werden? Verborgen und `pagehide` sind die letzte Gelegenheit vor
 * dem Schliessen (Doc §7.1). **Nie im Kampf:** Wer den Tab im Kampf schliesst, steht beim Laden am
 * letzten Punkt davor (Doc §7.1) — sonst wäre das Schliessen ein Ausweg aus einem verlorenen Kampf mit
 * gesicherten Treffern.
 */
export function sollSichern(ereignis: 'verborgen' | 'pagehide' | 'rast' | 'zeit', imKampf: boolean, laedt = false): boolean {
  if (laedt) return false;
  if (ereignis === 'rast') return true;
  return !imKampf;
}
