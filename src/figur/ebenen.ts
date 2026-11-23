/**
 * BRACHLAND — Rigplan und Ebenen (D457), rein, ohne three.js.
 *
 * **Rigplan:** Welche Knochen eines Skeletts Becken, Wirbel, Hals, Kopf und Beine sind. Alles in `src/figur/`
 * arbeitet gegen diesen Plan, nicht gegen feste Namen — die Hauptfigur, Axtmann und Wegelagerer teilen
 * `RIG_MENSCH`; ein Vierbeiner bekommt einen Plan mit vier Beinen (D458) und nutzt dieselben Module.
 *
 * **Ebenen:** Der Oberkörper (Waffe) über dem Unterkörper (Gang). Der `AnimationMixer` von three.js kennt keine
 * Masken; die Trennung geschieht deshalb am Clip: Aus jedem Clip werden zwei Teilclips, einer mit den Spuren
 * des Oberkörpers, einer mit dem Rest. Hier wird nur über **Namen** entschieden, welcher Knochen wohin gehört —
 * das Schneiden der Clips macht `laufzeit.ts`.
 */

export interface BeinPlan {
  ober: string; unter: string; fuss: string;
  /** D458, Vierbeiner: zu welchem Gürtel das Bein gehört. Mit Paaren trägt jedes Paar seinen Gürtel (`vierbeiner.ts`). */
  paar?: 'vorn' | 'hinten';
  /**
   * D458: `fuss` ist kein Knochen der Datei, sondern ein Hilfspunkt an der Sohle am Ende von `unter` (Tierläufe
   * enden ohne Fussknochen); `laufzeit.ts` `fussKnoten` legt ihn an.
   */
  spitze?: boolean;
}

export interface Rigplan {
  becken: string;
  /** Von unten nach oben. */
  wirbel: readonly string[];
  hals: string;
  /** D458: Hals aus mehreren Wirbeln, von unten nach oben; ohne Angabe nur `hals`. */
  halsKette?: readonly string[];
  kopf: string;
  beine: readonly BeinPlan[];
  /** Ab diesem Knochen (einschliesslich, mit allen Nachfahren) beginnt der Oberkörper. */
  oberAb: string;
}

/** Universal Base Characters (Quaternius, `tools/heldbau.py`): Hauptfigur, Bewohner, menschliche Gegner. */
export const RIG_MENSCH: Rigplan = {
  becken: 'pelvis',
  wirbel: ['spine_01', 'spine_02', 'spine_03'],
  hals: 'neck_01',
  kopf: 'Head',
  beine: [
    { ober: 'thigh_l', unter: 'calf_l', fuss: 'foot_l' },
    { ober: 'thigh_r', unter: 'calf_r', fuss: 'foot_r' },
  ],
  oberAb: 'spine_01',
};

/** Alle Knochen ab `ab` abwärts im Baum (einschliesslich `ab`). `eltern`: Knochen → Elternknochen. */
export function nachfahren(eltern: ReadonlyMap<string, string | null>, ab: string): Set<string> {
  const aus = new Set<string>();
  if (!eltern.has(ab)) return aus;
  for (const name of eltern.keys()) {
    let k: string | null | undefined = name;
    for (let i = 0; k && i < 64; i++) {
      if (k === ab) { aus.add(name); break; }
      k = eltern.get(k);
    }
  }
  return aus;
}

/** Knochenname einer Spur: `spine_01.quaternion` → `spine_01` (three.js-Schreibweise `Name.eigenschaft`). */
export function spurKnochen(spur: string): string {
  const i = spur.lastIndexOf('.');
  return i < 0 ? spur : spur.slice(0, i);
}

/** Spuren eines Clips nach Ebene: Indizes der Oberkörper-Spuren und der übrigen. */
export function teileSpuren(spuren: readonly string[], ober: ReadonlySet<string>): { ober: number[]; unter: number[] } {
  const aus = { ober: [] as number[], unter: [] as number[] };
  spuren.forEach((s, i) => (ober.has(spurKnochen(s)) ? aus.ober : aus.unter).push(i));
  return aus;
}
