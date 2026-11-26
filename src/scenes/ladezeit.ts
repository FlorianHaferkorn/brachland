/**
 * BRACHLAND — Ladezeit (D146, nach G-134)
 *
 * Wann standen Gelände und Bänder (Wege, Wasser, Häuser) zum ersten Mal
 * **vollständig**? Das ist der Moment, in dem ein Durchlauf von `LodTerrain`
 * bzw. `LodBaender` sein Kachelbudget nicht ausgeschöpft hat — vorher fehlt
 * am Rand noch etwas, und ein Bildschirmfoto misst einen halben Bau.
 *
 * G-134 hat gezeigt, dass diese Zahl fehlte: Der Dorf-Fall stand nach 16 s mal
 * bei 275.000, mal bei 930.000 Dreiecken, und nichts im HUD sagte, dass die
 * Szene noch lud. Jetzt steht die Ladezeit neben Bildrate und Aufrufen — auch
 * am Gerät, wo sie die eine Zahl ist, die nur das Gerät liefert.
 *
 * Gemessen ab `performance.timeOrigin` (Beginn der Navigation), in Sekunden.
 */
import { ORTSPARAMETER } from '../spiel/zielort.js';

export const ORTSVORLAUF_AN = ORTSPARAMETER.get('ortstakt') === '1' && ORTSPARAMETER.get('ortsvorlauf') !== '0';
const fertig: Record<'terrain' | 'baender' | 'ortsvorlauf', number | null> = { terrain: null, baender: null, ortsvorlauf: null };

/** Ein Teil der Szene ist zum ersten Mal vollständig gebaut. Spätere Meldungen ändern nichts. */
export function meldeFertig(teil: keyof typeof fertig): void {
  if (fertig[teil] === null) fertig[teil] = performance.now();
}

/** Gelände und Aufsätze sind für alle Blickrichtungen gebaut. */
export function gelaendeGeladen(): boolean {
  return fertig.terrain !== null && fertig.baender !== null;
}

/** Sekunden bis zum vollständigen Aufbau einschließlich des örtlichen Materialvorlaufs. */
export function ladezeit(): number | null {
  const { terrain, baender, ortsvorlauf } = fertig;
  if (terrain === null || baender === null || (ORTSVORLAUF_AN && ortsvorlauf === null)) return null;
  return Math.max(terrain, baender, ortsvorlauf ?? 0) / 1000;
}
