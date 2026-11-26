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
import { bereiteHofholzVor, verfeinereHofbaumaterial } from './hausmaterial.js';
import { efeuKartenMaterial, efeuKartenTiefe, kachelGeometrie, kartenMatrizen, type EfeuKarte } from './efeukarten.js';
import { EFEUKARTEN_AN } from './echt.js';
import { mulberry } from './props.js';
import type { Hofbau } from '../data/schema.js';
import daten from '../../content/hofbauten.json';
import type { Weltdaten } from './osm.js';
import type { HoehenFeld } from './lod.js';
import { orientierteHuelle, type Aufsatzboden } from './terrain.js';

export interface HofbauLage {
  modell: string;
  /** Wohngiebel-Mitte am Boden, Weltmeter. */
  ort: [number, number, number];
  /** Drehung um y (Bogenmass). */
  drehung: number;
  querSpiegeln: boolean;
  efeuecke?: Hofbau['efeuecke'];
  saat: number;
  /** Gemessene Grundrissmasse, zum Abgleich mit dem Modell. */
  laenge: number; breite: number;
}

/** Gebäude-Indizes einer Region, die ein Hof-Modell ersetzt. */
export function ersetzteGebaeude(region: string): Set<number> {
  return new Set(daten.hofbauten.filter(h => h.region === region).map(h => h.gebaeude));
}

/** Lage je Hofbau aus dem Grundriss: u = Firstrichtung, Ursprung am Wohngiebel, Terrassenhöhe nach hausframe.py vor der Einebnung. */
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
    let hl = orientierteHuelle(p);
    // Die Ringreihenfolge kann den Wirtschaftsgiebel an minU setzen.
    // Die Ortsangabe wählt nur das Ende der tatsächlich vermessenen Achse.
    if (h.firstrichtungGrad !== undefined && Math.cos(hl.achse - THREE.MathUtils.degToRad(h.firstrichtungGrad)) < 0)
      hl = orientierteHuelle(p, hl.achse + Math.PI);
    const mitteV = (hl.minV + hl.maxV) / 2;
    const [x, z] = hl.welt(hl.minU, mitteV);
    const [mx, mz] = hl.welt((hl.minU + hl.maxU) / 2, mitteV);
    const terrasse = THREE.MathUtils.lerp(boden.hoeheAn(mx, mz), boden.hoeheAn(x, z), .35);
    // Blender +x → three +x, Blender +y → three −z; u liegt in (cos, sin) der xz-Ebene → Drehung −achse um y.
    lagen.push({ modell: h.modell, ort: [x, terrasse, z], drehung: -hl.achse, querSpiegeln: h.querSpiegeln === true,
      efeuecke: h.efeuecke, saat: h.saat, laenge: hl.maxU - hl.minU, breite: hl.maxV - hl.minV });
  }
  return lagen;
}

/** Bringt den Modellhof und das Gelände auf dasselbe Planum. Der Saatboden
 * schließt wie in der Blender-Szene 4 cm unter dem Hausnull an. */
export function mitHofterrassen(feld: HoehenFeld, lagen: readonly HofbauLage[]): HoehenFeld {
  if (!lagen.length) return feld;
  const terrassen = lagen.map(({ ort: [x, y, z], drehung, laenge, breite }) => {
    const c = Math.cos(drehung), s = -Math.sin(drehung);
    const l = laenge / 2, b = breite / 2;
    return { x: x + l * c, z: z + l * s, y: y - .04, c, s, l, b,
      randX: l * Math.abs(c) + b * Math.abs(s) + 9, randZ: l * Math.abs(s) + b * Math.abs(c) + 9 };
  });
  return { ...feld, hoehe: (x, z) => {
    const grund = feld.hoehe(x, z);
    for (const t of terrassen) {
      const dx = x - t.x, dz = z - t.z;
      if (Math.abs(dx) >= t.randX || Math.abs(dz) >= t.randZ) continue;
      const u = Math.max(0, Math.abs(dx * t.c + dz * t.s) - t.l);
      const v = Math.max(0, Math.abs(dz * t.c - dx * t.s) - t.b);
      const abstand = Math.hypot(u, v);
      if (abstand < 9) return THREE.MathUtils.lerp(t.y, grund, THREE.MathUtils.smoothstep(abstand, .8, 9));
    }
    return grund;
  } };
}

/** Lokale Meter im exportierten Hof. Der Efeu wurzelt an beiden Wänden,
 * greift um den Laubenrand und folgt dem Eckpfosten bis unter die Traufe. */
export function hofEfeukarten(ecke: NonNullable<Hofbau['efeuecke']>, saat: number): EfeuKarte[] {
  const karten: EfeuKarte[] = [];
  const zufall = mulberry(saat);
  const { halbeBreite, laubentiefe, laubenboden, bruestung, traufe } = ecke;
  for (const giebel of [true, false]) {
    const normal: [number, number] = giebel ? [-1, 0] : [0, 1];
    const karte = (entlang: number, hoehe: number, vor: number) => {
      const sprung = .04 + zufall() * .06;
      const ort: [number, number, number] = giebel
        ? [-vor - sprung, hoehe, halbeBreite - entlang]
        : [entlang, hoehe, halbeBreite + vor + sprung];
      karten.push({ ort, normal, saat: Math.floor(zufall() * 0x7fffffff),
        groesse: .62 + zufall() * .34, vorstand: .1 + zufall() * .15 });
    };
    for (let y = .24; y < laubenboden; y += .35) {
      const breite = .45 + 2.7 * (y / laubenboden) ** .8;
      for (let u = .05; u < breite; u += .38)
        karte(u + (zufall() - .5) * .24, y + (zufall() - .5) * .21, 0);
    }
    // Hängende Triebe mit unabhängig auslaufenden Spitzen an der Brüstung.
    for (let u = -laubentiefe; u < 3.15; u += .31) {
      const tiefe = (1 - (u + laubentiefe) / (3.15 + laubentiefe)) * (1 + zufall() * 1.3);
      for (let h = 0; h < tiefe; h += .33)
        karte(u + .1 * Math.sin(h * 4 + u), laubenboden + bruestung - h, laubentiefe);
    }
    for (let y = laubenboden + bruestung; y < traufe - .3; y += .26)
      karte(-laubentiefe + zufall() * .23, y, laubentiefe);
  }
  return karten;
}

/** Lädt die Modelle in `ziel`; Rückgabe räumt auf. */
export function ladeHofbauten(lagen: readonly HofbauLage[], ziel: THREE.Group): () => void {
  let frei = false;
  const geladen: THREE.Object3D[] = [];
  const lader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for (const l of lagen) {
    void lader.loadAsync(`/bauten/${l.modell}.glb`).then(({ scene }) => {
      if (frei) return;
      bereiteHofholzVor(scene);
      scene.position.set(...l.ort);
      scene.rotation.y = l.drehung;
      if (l.querSpiegeln) scene.scale.z *= -1;
      const materialien = new Set<THREE.Material>();
      scene.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.castShadow = true; o.receiveShadow = true;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materialien.add(m);
      });
      for (const m of materialien) if (m instanceof THREE.MeshStandardMaterial) verfeinereHofbaumaterial(m);
      if (EFEUKARTEN_AN && l.efeuecke) {
        const lagen = kartenMatrizen(hofEfeukarten(l.efeuecke, l.saat));
        lagen.forEach((matrizen, i) => {
          if (!matrizen.length) return;
          const efeu = new THREE.InstancedMesh(kachelGeometrie(i), efeuKartenMaterial(), matrizen.length);
          matrizen.forEach((matrix, j) => efeu.setMatrixAt(j, matrix));
          efeu.castShadow = true; efeu.receiveShadow = true;
          efeu.customDepthMaterial = efeuKartenTiefe();
          scene.add(efeu);
        });
      }
      ziel.add(scene); geladen.push(scene);
    }).catch((f: unknown) => { if (!frei) console.warn(`Hofbau ${l.modell} fehlt.`, f); });
  }
  return () => {
    frei = true;
    for (const o of geladen) {
      o.removeFromParent();
      o.traverse(teil => {
        if (teil instanceof THREE.Mesh) teil.geometry.dispose();
        if (teil instanceof THREE.InstancedMesh) teil.dispose();
      });
    }
  };
}
