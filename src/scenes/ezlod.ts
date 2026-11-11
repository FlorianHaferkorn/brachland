/** Reine Gewichtung fuer unterbrochene EZ-Baum-LOD-Uebergaenge. */
export type EzStufe = 'nah' | 'mittel' | 'fern';
export type EzGewichte = readonly [number, number, number];
export const EZ_STUFEN: readonly EzStufe[] = ['nah', 'mittel', 'fern'];
export const EZ_BLEND_DAUER = 0.8;
export type EzVerlauf = { beginn: number; start: EzGewichte; ziel: EzStufe };
export type EzIntervall = readonly [number, number, number, number];

/** Ermittelt die unmittelbar sichtbaren Anteile, auch bei unterbrochener Blende. */
export function ezGewichte(verlauf: EzVerlauf, zeit: number): EzGewichte {
  const t = Math.max(0, Math.min(1, (zeit - verlauf.beginn) / EZ_BLEND_DAUER));
  return [0, 1, 2].map(i => verlauf.start[i] * (1 - t) + (EZ_STUFEN[i] === verlauf.ziel ? t : 0)) as unknown as EzGewichte;
}

/** Unterbrechung friert alle aktuellen Anteile ein, bevor das neue Ziel beginnt. */
export function ezWechsel(vorher: EzStufe, ziel: EzStufe, zeit: number, laufend?: EzVerlauf): EzVerlauf {
  const start: EzGewichte = laufend ? ezGewichte(laufend, zeit)
    : [+(vorher === 'nah'), +(vorher === 'mittel'), +(vorher === 'fern')];
  return { beginn: zeit, start, ziel };
}

/** Komplementaere Bereiche auf derselben Dither-Skala; Ordnung bleibt konstant. */
export function ezIntervall(v: EzVerlauf, stufe: EzStufe): EzIntervall {
  const i = EZ_STUFEN.indexOf(stufe), z = EZ_STUFEN.indexOf(v.ziel);
  let unten = 0;
  for (let k = 0; k < i; k++) unten += v.start[k];
  return [unten, unten + v.start[i], +(i > z), +(i >= z)];
}
