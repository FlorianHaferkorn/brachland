/**
 * BRACHLAND — welcher Prop-Chunk in welcher Liste landet
 *
 * Zwei Listen teilen sich alle sichtbaren Chunks: die **Nahliste** mit einem
 * `InstancedMesh` je Chunk, und das **Bündel**, in dem entfernte Props je Art
 * stecken, Baeume seit D157 zusaetzlich je Formvariante (G-111 — 175 Draw Calls kosten auf dem
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
import type { PropArt, PropChunk, PropInstanz } from '../world/props.js';
import { ATTRAPPE_AB, MITTEL_AB, FERN_NEUBEWERTUNG, PROP_NEUBEWERTUNG } from './sichtweiten.js';

export type PropStufe = 'nah' | 'mittel' | 'fern';

/**
 * In der **Mittelstufe** fallen die Varianten kleiner Props zusammen; Baeume behalten sie (D157).
 *
 * `chunkeProps` schlüsselt nach (Art, Variante, Kachel). Seit D157 bleiben Baeume
 * ausgenommen: ihre Formvariante muss ueber die Stufen gleich bleiben. Kleine
 * Props sparen weiterhin einen Draw Call je Variante und Kachel.
 *
 * Historische Messung vor der Baumausnahme an vier Orten (27.08.2026): Von den montierten Nahmeshes sind
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
 * Attrappe für alle kleinen Props. Fuer Baeume gilt diese Formvereinfachung nicht.
 */
const MITTEL_VARIANTE = 0;

/**
 * Arten, deren Stufenwechsel man sieht. Ein Grasbüschel, das 30 m entfernt von
 * der Nah- auf die Mittelstufe springt, fällt niemandem auf; eine 18 m hohe
 * Fichte schon. Die Liste entscheidet, wo die Teilung auf der Schwelle ihren
 * Aufruf wert ist (D162) — dieselben zwei Arten, die auch `legeMittelZusammen`
 * seit D157 von der Variantenzusammenlegung ausnimmt.
 */
const BAUM: ReadonlySet<PropArt> = new Set<PropArt>(['nadelbaum', 'laubbaum']);

export interface Auswahl {
  /** Chunks mit eigenem Mesh, je nach Abstand in voller oder mittlerer Auflösung. */
  nah: { c: PropChunk; stufe: PropStufe }[];
  /** Attrappen, nach Art gebündelt. Nur befüllt, wenn `bauBuendel` gesetzt ist. */
  buendel: Map<PropArt, PropChunk[]>;
}

/**
 * Welche der zwei verschieden getakteten Listen neu gebaut werden muss.
 * Ein neuer Fernanker erzwingt die Nahliste mit: Er verschiebt ihre gemeinsame
 * Grenze, auch wenn die letzte Nahbewertung weniger als 8 m zurueckliegt.
 */
export function propListenNeu(nahAbstand: number, fernAbstand: number): { nah: boolean; fern: boolean } {
  const fern = !(fernAbstand < FERN_NEUBEWERTUNG);
  return { nah: fern || !(nahAbstand < PROP_NEUBEWERTUNG), fern };
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
    /**
     * **Nur der Chunk auf der Schwelle wird je Baum entschieden** (D162).
     *
     * Die Entscheidung über die Mitte ist im Mittel richtig und am Rand falsch:
     * Ein Chunk ist 70 m breit, sein Radius also 52,5 m. Kippt er bei 46 m
     * Mittenabstand geschlossen auf `mittel`, wechseln damit auch die Bäume an
     * seinem vorderen Rand die Silhouette — und die stehen dann keine 46 m
     * entfernt, sondern wenige Meter vor der Kamera. Gemessen an vier
     * Waldstandorten trugen **5,7 bis 9,6 %** der Bäume innerhalb von 260 m die
     * falsche Stufe, und der nächste zu grob gezeichnete stand bei **16,9 m**.
     * Genau das sieht man als Sprung, wenn der Chunk beim Weitergehen umklappt.
     *
     * **Der Ausweg ist nicht, überall je Instanz zu entscheiden.** Das kostet
     * einen Draw Call je Stufe und Chunk statt einen je Chunk, und gemessen war
     * das zu teuer: für **alle** Arten geteilt kamen an fünf Standorten 6, 31,
     * 26, 25 und 9 zusätzliche Einträge dazu — am Stauwehr 80 → 111, also +39 %.
     * Nach D100, wo um jeden Aufruf gerungen wurde, ist das der falsche Handel.
     *
     * Deshalb zwei Verengungen, beide gemessen:
     * - **Nur Bäume.** Gras, Büsche, Blumen, Totholz und Findlinge stellen die
     *   Masse der Chunks, und an ihnen sieht man den Stufenwechsel nicht. Damit
     *   fallen die Zusatzaufrufe auf 0, 18, 15, 16 und 2.
     * - **Nur der Ring, durch den die Schwelle wirklich läuft**
     *   (`|mitte − MITTEL_AB| < radius`) **und nur, wenn beide Seiten besetzt
     *   sind.** Alles andere behält seine eine Entscheidung und seinen einen
     *   Aufruf.
     *
     * Was damit **nicht** behoben ist und offen bleibt: Gras und Büsche tragen
     * weiter die Chunkstufe (der nächste zu grob gezeichnete Busch stand bei
     * 17 m), und dieselbe Bauart gilt an der Attrappengrenze, die zusätzlich
     * über den **Anker** entscheidet und damit noch gröber ist.
     */
    if (BAUM.has(c.art) && Math.abs(mitte - MITTEL_AB) < c.radius && c.instanzen.length > 0) {
      const nahe: PropInstanz[] = [], mittlere: PropInstanz[] = [];
      for (const i of c.instanzen) {
        const d = Math.hypot(p[0] - i.position[0], p[1] - i.position[2]);
        (d > MITTEL_AB ? mittlere : nahe).push(i);
      }
      // **Nur teilen, wenn wirklich beide Seiten besetzt sind.** Liegt alles auf
      // einer Seite — der häufigere Fall, auch im Schwellenring —, bleibt es bei
      // einem Eintrag und damit bei einem Aufruf, und das Chunk-Objekt wird nicht
      // einmal kopiert. Ein Eintrag mit leerer Instanzliste wäre ein Aufruf für
      // nichts, und ein Chunk, der dabei aus **beiden** Listen fällt, wäre der
      // Fehler, den der Lauf-Test oben seit G-111 sucht.
      if (nahe.length > 0 && mittlere.length > 0) {
        nah.push({ c: { ...c, instanzen: nahe }, stufe: 'nah' });
        nah.push({ c: { ...c, instanzen: mittlere }, stufe: 'mittel' });
      } else {
        nah.push({ c, stufe: mittlere.length > 0 ? 'mittel' : 'nah' });
      }
      continue;
    }
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
    // Baumvarianten behalten dieselbe Silhouette auf jeder Stufe (D157).
    if (e.stufe !== 'mittel' || e.c.art === 'nadelbaum' || e.c.art === 'laubbaum') { heraus.push(e); continue; }
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

/** Fernbaeume nach Variante buendeln: wenige Aufrufe, ohne beim LOD-Wechsel die Form zu tauschen. */
export function buendleFernProps(chunks: ReadonlyMap<PropArt, PropChunk[]>): {
  art: PropArt; variante: number; instanzen: PropInstanz[];
}[] {
  const gruppen = new Map<string, { art: PropArt; variante: number; instanzen: PropInstanz[] }>();
  for (const [art, teile] of chunks) {
    const baum = art === 'nadelbaum' || art === 'laubbaum';
    for (const c of teile) for (const p of c.instanzen) {
      const variante = baum ? p.variante : 0;
      const id = `${art}:${variante}`;
      let gruppe = gruppen.get(id);
      if (!gruppe) { gruppe = { art, variante, instanzen: [] }; gruppen.set(id, gruppe); }
      gruppe.instanzen.push(p);
    }
  }
  return [...gruppen.values()];
}
