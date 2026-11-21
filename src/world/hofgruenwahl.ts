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

/** Die stehenden Laubbäume am Giebel und der Nadelbaumsaum liegen in verschiedenen Tiefen. */
export function staffeleHofBaeume(props: PropInstanz[], mitte: readonly [number, number]): void {
  for (const p of props) {
    const x = p.position[0] - mitte[0], z = p.position[2] - mitte[1];
    if (p.art === 'nadelbaum') {
      // Die kleineren Bäume am hinteren Rand füllen den Saum unter den größeren Kronen.
      const rand = Math.max(0, 1 - Math.hypot((x - 6) / 22, (z - 37) / 22));
      if (rand > 0) p.skalierung *= 1 + rand * Math.max(0, 1.18 - p.skalierung) * 0.96;
    } else if (p.art === 'laubbaum') {
      // Die Giebelgruppe breitet sich tiefer aus, der höchste Teil bleibt hinter dem Ortgang.
      const giebel = Math.max(0, 1 - Math.hypot((x + 25) / 17, (z + 11) / 14));
      if (giebel > 0) p.skalierung *= 1 - giebel * .10;
    }
  }
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

/** Rund um den Straßenausschnitt wechselt die Modellwahl allmählich, der Baumbestand bleibt vollständig. */
export function teileMilbingerBaeume(props: readonly PropInstanz[], rahmen: readonly [number, number, number, number]): HofBaumAuswahl {
  const lokaleBaeume: PropInstanz[] = [], rest: PropInstanz[] = [];
  const [x0, z0, x1, z1] = rahmen;
  for (const p of props) {
    if (p.art !== 'nadelbaum' && p.art !== 'laubbaum') { rest.push(p); continue; }
    const [x, , z] = p.position;
    const dx = Math.max(0, x0 - x, x - x1), dz = Math.max(0, z0 - z, z - z1);
    if (dx * dx + dz * dz >= 55 ** 2) { rest.push(p); continue; }
    const abstand = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, (abstand - 12) / 43));
    const saat = (Math.imul(Math.round(x * 100), 0x9e3779b1) ^ Math.imul(Math.round(z * 100), 0x85ebca77)) >>> 0;
    const zufall = ((saat ^ (saat >>> 16)) >>> 0) / 0x100000000;
    (zufall < 1 - t * t * (3 - 2 * t) ? lokaleBaeume : rest).push(p);
  }
  return { lokaleBaeume, rest };
}

/** Grobfilter für Strauch-Chunks: ihr Hüllkreis schneidet den festen Hofkreis, unabhängig von der Kamera. */
export function istHofBusch(mitte: readonly [number, number], radius = 0): boolean {
  if (HOF_UNIFORM.bereit.value <= 0 || !mitte.every(Number.isFinite) || !Number.isFinite(radius) || radius < 0) return false;
  const dx = mitte[0] - HOF_UNIFORM.mitte.value.x, dz = mitte[1] - HOF_UNIFORM.mitte.value.y;
  return dx * dx + dz * dz <= (HOF_BUSCH_RADIUS + radius + GRENZ_TOLERANZ) ** 2;
}
