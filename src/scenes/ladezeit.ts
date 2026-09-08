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
const fertig: Record<'terrain' | 'baender', number | null> = { terrain: null, baender: null };

/** Ein Teil der Szene ist zum ersten Mal vollständig gebaut. Spätere Meldungen ändern nichts. */
export function meldeFertig(teil: 'terrain' | 'baender'): void {
  if (fertig[teil] === null) fertig[teil] = performance.now();
}

/** Sekunden bis beide Teile standen, oder null solange eines fehlt. */
export function ladezeit(): number | null {
  return fertig.terrain !== null && fertig.baender !== null
    ? Math.max(fertig.terrain, fertig.baender) / 1000
    : null;
}
