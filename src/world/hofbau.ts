/**
 * BRACHLAND — Höfe aus dem Hof-Baukasten im Spiel (D363).
 *
 * `tools/hofbaukasten.py` (D360) erzeugt einen Einfirsthof als GLB: First entlang Blender +x (0…Länge), Breite ±B/2,
 * Boden z = 0, Wohngiebel bei x = 0. `content/hofbauten.json` sagt, welches OSM-Gebäude einer Region er ersetzt. Hier:
 * Lage aus dem Grundriss (orientierte Hülle wie beim erzeugten Haus), Modell laden, das erzeugte Haus entfällt.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import daten from '../../content/hofbauten.json';
import type { Weltdaten } from './osm.js';
import { orientierteHuelle, type Aufsatzboden } from './terrain.js';

export interface HofbauLage {
  modell: string;
  /** Wohngiebel-Mitte am Boden, Weltmeter. */
  ort: [number, number, number];
  /** Drehung um y (Bogenmass). */
  drehung: number;
  /** Gemessene Grundrissmasse, zum Abgleich mit dem Modell. */
  laenge: number; breite: number;
}

/** Gebäude-Indizes einer Region, die ein Hof-Modell ersetzt. */
export function ersetzteGebaeude(region: string): Set<number> {
  return new Set(daten.hofbauten.filter(h => h.region === region).map(h => h.gebaeude));
}

/** Lage je Hofbau aus dem Grundriss: u = Firstrichtung, Ursprung an der Giebelseite minU, Höhe = tiefste Ecke. */
export function hofbauLagen(region: string, welt: Weltdaten, boden: Aufsatzboden): HofbauLage[] {
  const [sued, west, nord, ost] = welt.bbox;
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * boden.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * boden.tiefeMeter,
  ];
  const lagen: HofbauLage[] = [];
  for (const h of daten.hofbauten) {
    if (h.region !== region) continue;
    const g = welt.gebaeude[h.gebaeude];
    if (!g) continue;
    const p = g.punkte.map(([lat, lon]) => zuWelt(lat, lon));
    const hl = orientierteHuelle(p);
    const mitteV = (hl.minV + hl.maxV) / 2;
    const [x, z] = hl.welt(hl.minU, mitteV);
    // Tiefste Ecke: das Modell hat einen Sockel, der darf nicht in der Luft hängen.
    const ecken = [[hl.minU, hl.minV], [hl.maxU, hl.minV], [hl.minU, hl.maxV], [hl.maxU, hl.maxV]]
      .map(([u, v]) => hl.welt(u, v)).map(([a, b]) => boden.hoeheAn(a, b));
    // Blender +x → three +x, Blender +y → three −z; u liegt in (cos, sin) der xz-Ebene → Drehung −achse um y.
    lagen.push({ modell: h.modell, ort: [x, Math.min(...ecken), z], drehung: -hl.achse,
      laenge: hl.maxU - hl.minU, breite: hl.maxV - hl.minV });
  }
  return lagen;
}

/** Lädt die Modelle in `ziel`; Rückgabe räumt auf. */
export function ladeHofbauten(lagen: readonly HofbauLage[], ziel: THREE.Group): () => void {
  let frei = false;
  const geladen: THREE.Object3D[] = [];
  const lader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for (const l of lagen) {
    void lader.loadAsync(`/bauten/${l.modell}.glb`).then(({ scene }) => {
      if (frei) return;
      scene.position.set(...l.ort);
      scene.rotation.y = l.drehung;
      scene.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      ziel.add(scene); geladen.push(scene);
    }).catch((f: unknown) => { if (!frei) console.warn(`Hofbau ${l.modell} fehlt.`, f); });
  }
  return () => {
    frei = true;
    for (const o of geladen) {
      o.removeFromParent();
      o.traverse(m => { const mesh = m as THREE.Mesh; if (mesh.isMesh) { mesh.geometry.dispose(); } });
    }
  };
}
