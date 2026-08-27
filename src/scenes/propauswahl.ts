/**
 * BRACHLAND — welcher Prop-Chunk in welcher Liste landet
 *
 * Zwei Listen teilen sich alle sichtbaren Chunks: die **Nahliste** mit einem
 * `InstancedMesh` je Chunk, und das **Bündel**, in dem alle Attrappen einer Art
 * in einem einzigen Aufruf stecken (G-111 — 175 Draw Calls kosten auf dem
 * Zielgerät 2 ms, die 50.000 Dreiecke daneben fast nichts).
 *
 * ## Warum das eine eigene Datei ist
 *
 * Weil hier genau ein Fehler möglich ist, den man im Bild nicht sieht: dass ein
 * Chunk in **keiner** der beiden Listen landet. Die Listen werden verschieden
 * oft neu bestimmt — die Nahliste alle 8 m, das Bündel alle 60 m —, und wer die
 * Grenze zwischen ihnen in beiden Fällen an der aktuellen Position festmacht,
 * bekommt ein wanderndes Loch: Chunks, die die 110-m-Grenze nach aussen
 * überqueren, fallen aus der Nahliste und sind bis zu 60 m lang noch nicht im
 * Bündel. Umgekehrt wären sie doppelt da.
 *
 * Die Lösung ist ein **gemeinsamer Anker**: Die Zugehörigkeit entscheidet der
 * Punkt, an dem das Bündel zuletzt gebaut wurde. Beide Listen wechseln damit im
 * selben Durchlauf, und dazwischen ist die Zuordnung fest.
 *
 * Als reine Funktion, damit `tests/propauswahl.test.ts` einen ganzen Lauf
 * durchsimulieren und nachweisen kann, dass kein Chunk verschwindet — im
 * Rendering wäre das ein Baum, der für ein paar Schritte weg ist, und darauf
 * fällt niemand rechtzeitig herein.
 */
import type { PropArt, PropChunk } from '../world/props.js';
import { ATTRAPPE_AB, MITTEL_AB, FERN_NEUBEWERTUNG } from './sichtweiten.js';

export type PropStufe = 'nah' | 'mittel' | 'fern';

/**
 * In der **Mittelstufe** fallen die Varianten zusammen.
 *
 * `chunkeProps` schlüsselt nach (Art, Variante, Kachel). Das ist in der Nahstufe
 * richtig — eine Fichte neben der Figur, die aussieht wie die daneben, fällt
 * sofort auf. Zwischen 45 und 110 m ist eine Fichte im Bild rund 15 px hoch, und
 * dort kostet die Variante nur eines: einen eigenen Draw Call je Variante und
 * Kachel.
 *
 * Gemessen an vier Orten (27.08.2026): Von den montierten Nahmeshes sind
 * **86 % Mittelstufe** — 84 von 98, 123 von 123, 171 von 199, 75 von 91. Legt
 * man sie je (Art, Kachel) zusammen, bleiben **30, 36, 48, 20**.
 *
 * Der Unterschied zu der bei D99 verworfenen Bündelung ist die **Kachel**: Sie
 * bleibt erhalten. Die Hüllkugel behält ihre 52 m, das Frustum schneidet weiter
 * wie bisher — es fällt nur die Variantenachse weg. Genau deshalb wirkt es hier
 * und dort nicht.
 *
 * Was bleibt: Farbe (`propTon` je Instanz aus deren **eigener** Variante),
 * Drehung und Größe. Was wegfällt: die Form. Ab 110 m ist es ohnehin dieselbe
 * Attrappe für alle.
 */
const MITTEL_VARIANTE = 0;

export interface Auswahl {
  /** Chunks mit eigenem Mesh, je nach Abstand in voller oder mittlerer Auflösung. */
  nah: { c: PropChunk; stufe: PropStufe }[];
  /** Attrappen, nach Art gebündelt. Nur befüllt, wenn `bauBuendel` gesetzt ist. */
  buendel: Map<PropArt, PropChunk[]>;
}

/**
 * Chunks auf die beiden Listen verteilen.
 *
 * @param p       aktuelle Kameraposition (x, z)
 * @param anker   Position, an der das Bündel zuletzt gebaut wurde (x, z)
 * @param bauBuendel  ob das Bündel in diesem Durchlauf neu befüllt wird
 */
export function waehleProps(
  chunks: readonly PropChunk[], p: readonly [number, number],
  anker: readonly [number, number], bauBuendel: boolean,
): Auswahl {
  const nah: { c: PropChunk; stufe: PropStufe }[] = [];
  const buendel = new Map<PropArt, PropChunk[]>();

  for (const c of chunks) {
    const vomAnker = Math.hypot(anker[0] - c.mitte[0], anker[1] - c.mitte[1]);
    if (vomAnker > ATTRAPPE_AB) {
      // Sichtweite um die Ankerstrecke erweitert: Was in den nächsten 60 m in
      // Reichweite gerät, ist schon drin, statt später hineinzupoppen.
      if (bauBuendel && vomAnker - c.radius <= c.sichtweite + FERN_NEUBEWERTUNG) {
        let ziel = buendel.get(c.art);
        if (!ziel) { ziel = []; buendel.set(c.art, ziel); }
        ziel.push(c);
      }
      continue;
    }
    const mitte = Math.hypot(p[0] - c.mitte[0], p[1] - c.mitte[1]);
    // Sichtbarkeit über den **nächsten Rand**: Ein Chunk, von dem eine Ecke in
    // Reichweite ragt, muss gezeichnet werden.
    if (mitte - c.radius > c.sichtweite) continue;
    /**
     * Nah gegen Mittel über die **Mitte**, nicht über den Rand.
     *
     * Vorher stand hier `mitte - radius`. Bei 120-m-Chunks sind das 90 m Radius,
     * das Nahfeld reichte also bis 165 m statt bis 75 — und weil ein Chunk nur
     * ganz oder gar nicht umschaltet, wurden rund tausend Fichten in voller
     * Auflösung gezeichnet: gemessen 537.000 Dreiecke, wo 200.000 erwartet
     * waren. Über die Mitte gerechnet hebt der Fehler sich auf.
     */
    nah.push({ c, stufe: mitte > MITTEL_AB ? 'mittel' : 'nah' });
  }
  return { nah: legeMittelZusammen(nah), buendel };
}

/**
 * Mittelstufen-Chunks derselben Art und Kachel zu einem zusammenfassen.
 *
 * Die Nahstufe bleibt unangetastet. Warum überhaupt, steht bei
 * `MITTEL_VARIANTE`.
 *
 * Zwei Dinge, auf die der Test achtet, weil sie im Bild nicht auffallen würden:
 * Es darf keine Instanz verlorengehen und keine doppelt auftauchen. Ein
 * verschwundener Grasbüschel unter 3.000 sieht aus wie nichts.
 */
function legeMittelZusammen(
  eintraege: { c: PropChunk; stufe: PropStufe }[],
): { c: PropChunk; stufe: PropStufe }[] {
  const heraus: { c: PropChunk; stufe: PropStufe }[] = [];
  const zusammen = new Map<string, PropChunk>();
  for (const e of eintraege) {
    if (e.stufe !== 'mittel') { heraus.push(e); continue; }
    const c = e.c;
    const schluessel = `${c.art}|${c.mitte[0]}|${c.mitte[1]}`;
    const da = zusammen.get(schluessel);
    if (da) {
      // Neues Array, nicht `push` auf das des ersten Chunks — der liegt in der
      // Liste, aus der bei jedem Schritt neu ausgewählt wird, und würde sonst
      // von Bild zu Bild weiterwachsen.
      da.instanzen = da.instanzen.concat(c.instanzen);
      continue;
    }
    const neu: PropChunk = { ...c, variante: MITTEL_VARIANTE, instanzen: c.instanzen.slice() };
    zusammen.set(schluessel, neu);
    heraus.push({ c: neu, stufe: 'mittel' });
  }
  return heraus;
}
