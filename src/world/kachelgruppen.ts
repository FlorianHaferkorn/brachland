/** D311: Puffer unveränderter räumlicher Kachelgruppen beim Nachladen behalten. */
import { BufferAttribute, BufferGeometry } from 'three';
import { mergeAttributes, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  const arbeit = bereiteKachelpuffer(alt, sammlung);
  for (let schritt = arbeit.next(); ; schritt = arbeit.next()) {
    if (schritt.done) return schritt.value;
  }
}

/** Indizierte Kacheln ohne Morph-Ziele. Typ und Reihenfolge bleiben wie bei Three. */
function* fuegeIndizierteKacheln(quellen: BufferGeometry[]): Generator<void, BufferGeometry | null> {
  const namen = Object.keys(quellen[0].attributes);
  const kompatibel = quellen.every(g => g.index && g.hasAttribute('position')
    && !g.morphTargetsRelative && Object.keys(g.morphAttributes).length === 0
    && Object.keys(g.attributes).length === namen.length && namen.every(n => g.hasAttribute(n)));
  if (!kompatibel) return mergeGeometries(quellen, false);

  const ecken = quellen.reduce((anzahl, g) => anzahl + g.attributes.position.count, 0);
  const anzahl = quellen.reduce((summe, g) => summe + g.index!.count, 0);
  const indizes = ecken > 65535 ? new Uint32Array(anzahl) : new Uint16Array(anzahl);
  let start = 0, offset = 0, maximum = 0;
  for (const g of quellen) {
    const index = g.index!;
    for (let i = 0; i < index.count; i++) {
      const wert = offset + index.getX(i);
      indizes[start++] = wert;
      if (wert > maximum) maximum = wert;
    }
    offset += g.attributes.position.count;
    yield;
  }
  const geometrie = new BufferGeometry();
  geometrie.setIndex(new BufferAttribute(indizes instanceof Uint32Array && maximum < 65535
    ? new Uint16Array(indizes) : indizes, 1));
  for (const name of namen) {
    const attribut = mergeAttributes(quellen.map(g => g.attributes[name] as BufferAttribute));
    if (!attribut) return null;
    geometrie.setAttribute(name, attribut);
    yield;
  }
  return geometrie;
}

/** Unterbricht nur nach einer tatsächlichen Pufferkopie. Alte Puffer bleiben bis zur Freigabe nutzbar. */
export function* bereiteKachelpuffer(alt: Kachelpuffer, sammlung: Kachelsammlung,
  vorladen?: (geometrie: BufferGeometry) => boolean, kopienVerteilen = false): Generator<void, Kachelpuffer> {
  const neu: Kachelpuffer = new Map();
  for (const [schluessel, gruppe] of sammlung) {
    const quellen = gruppe.sort((a, b) => a.reihe - b.reihe || a.spalte - b.spalte).map(q => q.geometrie);
    const vorher = alt.get(schluessel);
    if (vorher && vorher.quellen.length === quellen.length && quellen.every((g, i) => vorher.quellen[i] === g)) {
      neu.set(schluessel, vorher);
      continue;
    }
    const geometrie = kopienVerteilen && quellen[0].index
      ? yield* fuegeIndizierteKacheln(quellen) : mergeGeometries(quellen, false);
    if (geometrie) neu.set(schluessel, { quellen, geometrie });
    yield;
    if (kopienVerteilen && geometrie) {
      geometrie.computeBoundingSphere();
      yield;
    }
    if (geometrie && vorladen?.(geometrie)) yield;
  }
  return neu;
}

export function geometrienAusKachelpuffern(puffer: Kachelpuffer): BufferGeometry[] {
  return Array.from(puffer.values(), g => g.geometrie);
}
