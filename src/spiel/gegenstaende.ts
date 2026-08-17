/**
 * BRACHLAND — Gegenstände anwenden
 *
 * Die Wirkung eines Gegenstands steht als Daten im Inhalt, die Ausführung hier. Beide
 * Seiten kennen die Engine nicht mehr als nötig: Ein Gegenstand verändert einen
 * `Kaempfer`, mehr nicht.
 *
 * Reine Funktion mit Rückmeldetext — dieselbe Stelle bedient Kampf und Beutel
 * außerhalb, damit ein Sud draußen nicht anders wirkt als drinnen.
 */
import { REGELN, reinige, type Kaempfer } from '../engine/battle.js';
import type { Gegenstand, NarbenArt } from '../data/schema.js';

/** Was eine Narbe im Klartext bedeutet. Die Engine kennt keine Texte. */
export const NARBEN_TEXT: Record<NarbenArt, string> = {
  krit: 'trifft genauer ins Mark',
  resistenz: 'nimmt Elementnachteile weniger übel',
  panzer: 'hält mehr aus',
};

export interface Anwendung {
  /** Hat der Gegenstand etwas bewirkt? Wenn nein, wird er nicht verbraucht. */
  gewirkt: boolean;
  meldung: string;
  /** Nur bei Fanghilfen gesetzt: Zuschlag auf die Fangchance. */
  fangBonus?: number;
}

export function wendeAn(
  g: Gegenstand, ziel: Kaempfer,
  /** Narbe für die Reinigung. Hängt an der Herkunft, die der `Kaempfer` nicht kennt. */
  narbe?: { art: NarbenArt; wert: number },
): Anwendung {
  const w = g.wirkung;
  switch (w.art) {
    case 'heilung': {
      if (ziel.kp <= 0) return { gewirkt: false, meldung: `${ziel.name} ist ausgefallen — das hilft hier nicht.` };
      if (ziel.kp >= ziel.maxKp) return { gewirkt: false, meldung: `${ziel.name} ist unversehrt.` };
      const vorher = ziel.kp;
      ziel.kp = Math.min(ziel.maxKp, ziel.kp + Math.round(ziel.maxKp * w.anteil));
      return { gewirkt: true, meldung: `${ziel.name} erholt sich um ${ziel.kp - vorher} KP.` };
    }
    case 'wiederbelebung': {
      if (ziel.kp > 0) return { gewirkt: false, meldung: `${ziel.name} steht noch.` };
      ziel.kp = Math.max(1, Math.round(ziel.maxKp * w.anteil));
      ziel.fokus = REGELN.FOKUS_START;
      return { gewirkt: true, meldung: `${ziel.name} kommt wieder auf die Beine.` };
    }
    case 'reinigung': {
      if (ziel.zustand !== 'befallen') return { gewirkt: false, meldung: `${ziel.name} ist rein.` };
      /**
       * Reinigen führt **zurück**, es macht nicht rein.
       *
       * Vorher setzte das hier `zustand = 'rein'` — der Befall verschwand, und mit
       * ihm jede Spur. Nach der Creature Design Bible ist der Zustand danach
       * `rueckgefuehrt`: gereinigt, mit permanenter Narbe. Damit ist Reinigen keine
       * Reparatur mehr, sondern eine Entscheidung, die etwas einbringt — und der
       * einzige Weg zum vierten Zustand.
       *
       * Die Narbe hängt an der Herkunft, die ein `Kaempfer` nicht kennt. Ohne
       * Angabe bleibt es beim alten Verhalten, damit ein Aufrufer ohne Inhaltszugriff
       * nicht stillschweigend eine falsche Narbe verteilt.
       */
      if (!narbe) {
        ziel.zustand = 'rein';
        return { gewirkt: true, meldung: `Der Befall weicht von ${ziel.name}.` };
      }
      reinige(ziel, narbe);
      return {
        gewirkt: true,
        meldung: `${ziel.name} ist zurückgeführt. Es bleibt eine Narbe: ${NARBEN_TEXT[narbe.art]}.`,
      };
    }
    case 'fokus': {
      if (ziel.fokus >= REGELN.FOKUS_MAX) return { gewirkt: false, meldung: `${ziel.name} ist gesammelt.` };
      ziel.fokus = Math.min(REGELN.FOKUS_MAX, ziel.fokus + w.punkte);
      return { gewirkt: true, meldung: `${ziel.name} sammelt sich.` };
    }
    case 'fanghilfe':
      return { gewirkt: true, meldung: `${g.name} ausgelegt.`, fangBonus: w.bonus };
  }
}

/** Ist der Gegenstand auf dieses Ziel überhaupt sinnvoll anwendbar? */
export function wirktAuf(g: Gegenstand, ziel: Kaempfer): boolean {
  switch (g.wirkung.art) {
    case 'heilung': return ziel.kp > 0 && ziel.kp < ziel.maxKp;
    case 'wiederbelebung': return ziel.kp <= 0;
    case 'reinigung': return ziel.zustand === 'befallen';
    case 'fokus': return ziel.kp > 0 && ziel.fokus < REGELN.FOKUS_MAX;
    case 'fanghilfe': return true;
  }
}

/**
 * Beute nach einem Sieg.
 *
 * Je Gegenstand ein eigener Wurf gegen seine `beuteChance`, aber **höchstens einer**
 * je Kampf. Mehrere Funde auf einmal entwerten den einzelnen; und ein Beutel, der
 * schneller wächst, als man ihn leert, ist kein Vorrat, sondern Ballast.
 */
export function beute(
  alle: Gegenstand[], wurf: () => number, gluecksfaktor = 1,
): Gegenstand | null {
  const gemischt = [...alle].filter(g => g.beuteChance > 0)
    .sort((a, b) => a.beuteChance - b.beuteChance);
  for (const g of gemischt) if (wurf() < g.beuteChance * gluecksfaktor) return g;
  return null;
}
