/** Ortsfeste Auswahl der Hofvegetation; Zufallsstrom, Positionen und Instanzreferenzen bleiben erhalten. */
import type { PropInstanz } from './props.js';
import { HOF_UNIFORM } from './hofplatz.js';

export const HOF_BAUM_RADIUS = 180;
export const HOF_BUSCH_RADIUS = 100;
/** Gegen Rundung beim Addieren/Subtrahieren der Weltkoordinaten; deutlich unter einem Millimeter. */
const GRENZ_TOLERANZ = 1e-7;

export interface HofBaumAuswahl {
  lokaleBaeume: PropInstanz[];
  rest: PropInstanz[];
}

/** Vor dem Chunking trennen, damit kein Instanzmesh lokale und nicht ersetzte Bäume vermischt. */
export function teileHofBaeume(props: readonly PropInstanz[], mitte: readonly [number, number] | null,
  radius = HOF_BAUM_RADIUS): HofBaumAuswahl {
  const lokaleBaeume: PropInstanz[] = [], rest: PropInstanz[] = [];
  if (!mitte || !mitte.every(Number.isFinite) || !Number.isFinite(radius) || radius < 0) {
    return { lokaleBaeume, rest: [...props] };
  }
  const radius2 = (radius + GRENZ_TOLERANZ) ** 2;
  for (const prop of props) {
    const baum = prop.art === 'nadelbaum' || prop.art === 'laubbaum';
    const drin = baum && (prop.position[0] - mitte[0]) ** 2 + (prop.position[2] - mitte[1]) ** 2 <= radius2;
    (drin ? lokaleBaeume : rest).push(prop);
  }
  return { lokaleBaeume, rest };
}

/** Grobfilter für Strauch-Chunks: ihr Hüllkreis schneidet den festen Hofkreis, unabhängig von der Kamera. */
export function istHofBusch(mitte: readonly [number, number], radius = 0): boolean {
  if (HOF_UNIFORM.bereit.value <= 0 || !mitte.every(Number.isFinite) || !Number.isFinite(radius) || radius < 0) return false;
  const dx = mitte[0] - HOF_UNIFORM.mitte.value.x, dz = mitte[1] - HOF_UNIFORM.mitte.value.y;
  return dx * dx + dz * dz <= (HOF_BUSCH_RADIUS + radius + GRENZ_TOLERANZ) ** 2;
}
