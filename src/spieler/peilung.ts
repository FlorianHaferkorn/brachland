/**
 * BRACHLAND — Peilung
 *
 * Eine Funktion, ein Vorzeichen, und genau daran ist es schiefgegangen: Die
 * Witterungsanzeige zeigte beim Drehen in die falsche Richtung, und zwar doppelt so
 * schnell verkehrt. Bei Blickrichtung 0 stimmte sie — deshalb fiel es beim ersten
 * Hinsehen nicht auf.
 *
 * Deshalb liegt die Rechnung hier statt in der Szene: Sie ist rein, prüfbar und
 * hat einen Test. Eine Geometrie-Formel mitten in einer Renderkomponente ist genau
 * so lange richtig, wie niemand sie anfasst.
 */

/**
 * Richtung zu einem Punkt, relativ zur Blickrichtung.
 *
 * Rückgabe in Radiant, normiert auf −π…π: **0 heißt geradeaus, positiv rechts.**
 *
 * Herleitung — die Blickrichtung ist `(-sin g, -cos g)`, rechts davon liegt
 * `(cos g, -sin g)`. Projiziert man den Vektor zum Ziel auf beide Achsen und setzt
 * das in `atan2` ein, kürzt sich alles zu `atan2(dx, -dz) + g`.
 */
export function peilung(
  vonX: number, vonZ: number, zuX: number, zuZ: number, gier: number,
): number {
  const w = Math.atan2(zuX - vonX, -(zuZ - vonZ)) + gier;
  // Auf −π…π bringen, sonst dreht der Pfeil bei mehrfacher Umdrehung Schleifen.
  return Math.atan2(Math.sin(w), Math.cos(w));
}
