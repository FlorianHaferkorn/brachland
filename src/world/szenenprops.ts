/**
 * BRACHLAND — Die Props, wie die Szene sie stellt (D232)
 *
 * Eine Stelle für Szene **und** Werkzeuge. Bis D231 rief jedes Werkzeug `verteileProps` selbst auf,
 * meist mit `terrain.hoeheAn` statt des Höhenfelds mit Mikrorelief (`feld.hoehe`) und ohne die
 * Freihaltung der Bauwerke. Der Hangfilter entschied dann an anderen Stellen, die Zufallsfolge lief
 * auseinander — `dichtecheck`, `propcheck` und Messkameras rechneten mit einer anderen Welt als der,
 * die man spielt (gefunden an der Findling-Kamera, D231).
 */
import type { Weltdaten } from './osm.js';
import type { TerrainErgebnis } from './terrain.js';
import { hoeheAufFlaeche, type HoehenFeld } from './lod.js';
import { gesperrt } from './bauwerke.js';
import { verteileProps, type PropInstanz } from './props.js';
import { HOF_SILHOUETTE_AN, MILBINGERSUBSTANZ_AN } from './echt.js';
import { bestimmeHof } from './hofplatz.js';
import { staffeleHofBaeume } from './hofgruenwahl.js';
import { milbingerGartenprops } from './milbingersubstanz.js';

/** Seed 1 wie die Szene; Höhe aus dem Feld, Bauwerke freigehalten, Fuss auf dem Feld. */
export function propsWieSzene(
  welt: Weltdaten, terrain: TerrainErgebnis, feld: HoehenFeld, freihalten?: (x: number, z: number) => boolean,
  lod2?: readonly (Weltdaten['gebaeude'][number]['lod2'] | null)[],
): PropInstanz[] {
  const props = verteileProps(welt, { ...terrain, hoeheAn: feld.hoehe }, 1)
    // Freihaltung der Bauwerke (ADR-0006): Die Blender-Szene bringt ihren eigenen Wald mit.
    .filter(p => !freihalten?.(p.position[0], p.position[2]) && !(feld.trittweg && feld.trittweg.deckung(p.position[0], p.position[2]) > .25) && !gesperrt(p.position[0], p.position[2], 'props'))
    .map(p => ({ ...p, position: [p.position[0], feld.hoehe(p.position[0], p.position[2]), p.position[2]] }) as PropInstanz);
  if (HOF_SILHOUETTE_AN) {
    const hof = bestimmeHof(welt, terrain);
    if (hof) staffeleHofBaeume(props, hof.mitte);
  }
  if (MILBINGERSUBSTANZ_AN && freihalten) {
    props.push(...milbingerGartenprops(welt, (x, z) => hoeheAufFlaeche(feld, x, z), freihalten, lod2));
  }
  return props;
}
