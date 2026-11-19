/** D322: Verwitterung aus Gebrauch, Bauform, Gelände und einem ortsfesten Seed. */
export interface Baualterung {
  feuchte: number;
  abnutzung: number;
  dachschaden: number;
  lage: number;
}

export function bestimmeBaualterung(
  stufe: number, relief: number, spannweite: number, nutzbau: boolean, zufall: () => number,
): Baualterung {
  const hang = Math.min(1, Math.max(0, relief) / Math.max(2, spannweite * .28));
  const feuchte = Math.min(1, .16 + .37 * hang + .32 * zufall() + .09 * stufe);
  const abnutzung = Math.min(1, .16 + .30 * stufe + .22 * zufall());
  const lage = zufall();
  // Ungepflegte Nutzbauten können an der Traufe stärker nachgeben als ein Wohnhaus.
  const dachschaden = stufe === 2 ? (.21 + .70 * feuchte) * (nutzbau ? 1 : .69) * (.57 + .43 * zufall()) : 0;
  return { feuchte, abnutzung, dachschaden, lage };
}

/** Zwei Werte mit je sechs Bits im Nachkommaanteil des vorhandenen Zustandsattributs. */
export function packeBaualterung(alterung: Baualterung): number {
  return 8 + (Math.round(alterung.feuchte * 63) * 64 + Math.round(alterung.abnutzung * 63)) / 4096;
}
