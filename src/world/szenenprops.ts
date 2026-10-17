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
import type { HoehenFeld } from './lod.js';
import { gesperrt } from './bauwerke.js';
import { verteileProps, type PropInstanz } from './props.js';

/** Seed 1 wie die Szene; Höhe aus dem Feld, Bauwerke freigehalten, Fuss auf dem Feld. */
export function propsWieSzene(welt: Weltdaten, terrain: TerrainErgebnis, feld: HoehenFeld): PropInstanz[] {
  return verteileProps(welt, { ...terrain, hoeheAn: feld.hoehe }, 1)
    // Freihaltung der Bauwerke (ADR-0006): Die Blender-Szene bringt ihren eigenen Wald mit.
    .filter(p => !gesperrt(p.position[0], p.position[2], 'props'))
    .map(p => ({ ...p, position: [p.position[0], feld.hoehe(p.position[0], p.position[2]), p.position[2]] }) as PropInstanz);
}
