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
import { REGELN, type Kaempfer } from '../engine/battle.js';
import type { Gegenstand } from '../data/schema.js';

export interface Anwendung {
  /** Hat der Gegenstand etwas bewirkt? Wenn nein, wird er nicht verbraucht. */
  gewirkt: boolean;
  meldung: string;
  /** Nur bei Fanghilfen gesetzt: Zuschlag auf die Fangchance. */
  fangBonus?: number;
}

export function wendeAn(g: Gegenstand, ziel: Kaempfer): Anwendung {
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
      ziel.zustand = 'rein';
      return { gewirkt: true, meldung: `Der Befall weicht von ${ziel.name}.` };
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
