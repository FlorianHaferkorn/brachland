/** D311: Puffer unveränderter räumlicher Kachelgruppen beim Nachladen behalten. */
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Kachel } from './lod.js';

type Quelle = { reihe: number; spalte: number; geometrie: BufferGeometry };
export type Kachelsammlung = Map<string, Quelle[]>;
export type Kachelpuffer = Map<string, { quellen: BufferGeometry[]; geometrie: BufferGeometry }>;

export function sammleKachel(sammlung: Kachelsammlung, kachel: Kachel, geometrie: BufferGeometry, art: string): void {
  // Vier 64-m-Kacheln je Achse halten den Upload klein und die Aufrufzahl begrenzt.
  const schluessel = `${art}:${Math.floor(kachel.ix / 4)}:${Math.floor(kachel.iz / 4)}`;
  const quelle = { reihe: kachel.iz, spalte: kachel.ix, geometrie };
  const gruppe = sammlung.get(schluessel);
  if (gruppe) gruppe.push(quelle);
  else sammlung.set(schluessel, [quelle]);
}

/** Auch die Reihenfolge der Quellen bleibt bei einer anderen Spielerposition stabil. */
export function aktualisiereKachelpuffer(alt: Kachelpuffer, sammlung: Kachelsammlung): Kachelpuffer {
  const neu: Kachelpuffer = new Map();
  for (const [schluessel, gruppe] of sammlung) {
    const quellen = gruppe.sort((a, b) => a.reihe - b.reihe || a.spalte - b.spalte).map(q => q.geometrie);
    const vorher = alt.get(schluessel);
    if (vorher && vorher.quellen.length === quellen.length && quellen.every((g, i) => vorher.quellen[i] === g)) {
      neu.set(schluessel, vorher);
      continue;
    }
    const geometrie = mergeGeometries(quellen, false);
    if (geometrie) neu.set(schluessel, { quellen, geometrie });
  }
  return neu;
}

export function geometrienAusKachelpuffern(puffer: Kachelpuffer): BufferGeometry[] {
  return Array.from(puffer.values(), g => g.geometrie);
}
