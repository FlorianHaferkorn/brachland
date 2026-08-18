/**
 * BRACHLAND — Props und Vegetation
 *
 * Streut Bäume, Findlinge und Büsche über das Terrain. Der wirksamste Hebel für
 * die Landschaftsqualität — ein Terrain-Mesh allein sieht nie gut aus, egal wie fein.
 *
 * Deterministisch über einen Seed: dieselbe Region sieht bei jedem Laden gleich aus,
 * ohne dass Positionen gespeichert werden müssen. Wichtig für die Offline-PWA —
 * ~40.000 Props als JSON wären mehrere Megabyte, der Seed ist eine Zahl.
 */
import * as THREE from 'three';
import type { Weltdaten, Biom } from './osm.js';
import type { TerrainErgebnis } from './terrain.js';
import { MASSSTAB } from './terrain.js';

export type PropArt = 'nadelbaum' | 'laubbaum' | 'busch' | 'findling' | 'grasbuschel' | 'totholz'
                    | 'blume' | 'pilz';

/**
 * Props je Hektar und Biom.
 *
 * Die Ausgangswerte (Wald: 18 Nadelbäume/ha) waren eine Parklandschaft — ein
 * bewirtschafteter Fichtenbestand trägt 400 bis 1000 Stämme je Hektar. Voll
 * realistisch geht nicht: Bei 420 m Sichtweite wären das über zwei Millionen
 * Dreiecke gegen ein Handybudget von 400.000.
 *
 * Diese Werte sind das, was das Budget hergibt — rund fünffach dichter als vorher
 * und damit als Wald lesbar, aber weiter licht. Der nächste Hebel wären
 * Fernattrappen statt voller Modelle (Ledger G-15), nicht noch mehr Dichte.
 */
const DICHTE: Record<Biom, Partial<Record<PropArt, number>>> = {
  wald:      { nadelbaum: 95, laubbaum: 32, busch: 26, totholz: 8, grasbuschel: 30, pilz: 14, blume: 4 },
  gebuesch:  { busch: 55, nadelbaum: 6, findling: 5, grasbuschel: 34, blume: 9 },
  wiese:     { grasbuschel: 40, busch: 3, laubbaum: 1.2, blume: 22 },
  acker:     { grasbuschel: 8, blume: 2 },
  fels:      { findling: 18, busch: 4, nadelbaum: 1.6, grasbuschel: 6 },
  wasser:    {},
  siedlung:  { laubbaum: 6, busch: 7, grasbuschel: 12, blume: 6 },
  industrie: { busch: 4, totholz: 3, grasbuschel: 9 },
  ruine:     { busch: 9, totholz: 5, findling: 5, grasbuschel: 14, blume: 3 },
  unbekannt: { grasbuschel: 10 },
};

/**
 * Sichtweite je Art. Kleinzeug jenseits davon wird gar nicht erst gezeichnet —
 * bei Nebel ab 420 m sieht man es ohnehin nicht, es kostet aber volle Dreiecke.
 */
export const SICHTWEITE: Record<PropArt, number> = {
  nadelbaum: 420, laubbaum: 420, findling: 300,
  busch: 180, totholz: 160, grasbuschel: 90,
  // Eine Blume ist 25 cm hoch und ein Pilz 15 — jenseits von 45 m sind sie
  // weniger als ein Pixel und kosten trotzdem einen ganzen Draw Call je Chunk.
  blume: 55, pilz: 45,
};

/** Ab dieser Neigung wächst nichts mehr — verhindert Bäume an Felswänden. */
const MAX_NEIGUNG_GRAD: Partial<Record<PropArt, number>> = {
  nadelbaum: 38, laubbaum: 32, busch: 45, totholz: 35, grasbuschel: 40, findling: 60,
  blume: 35, pilz: 30,
};

export interface PropInstanz {
  art: PropArt;
  /** Index in VARIANTEN[art] — Abwechslung ohne zusätzliche Daten. */
  variante: number;
  position: [number, number, number];
  drehung: number;
  skalierung: number;
}

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Steht dieser Punkt in einem Gebäude?
 *
 * Die Prop-Verteilung kannte Grundrisse nicht: Gemessen standen **2.416 von
 * 172.220 Props in einem Haus** (1,4 %), darunter 96 Laubbäume und 28 Fichten.
 * Ein Grasbüschel im Wohnzimmer sieht man nicht, einen Baum durch das Dach schon.
 *
 * Ein Raster über die Grundriss-Hüllen macht aus 172.000 × 2.033 Vergleichen einen
 * Durchlauf; erst wenn die Hülle passt, wird das Polygon geprüft.
 */
function hausTest(
  welt: Weltdaten, terrain: TerrainErgebnis,
): (x: number, z: number) => boolean {
  const [sued, west, nord, ost] = welt.bbox;
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * terrain.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * terrain.tiefeMeter,
  ];
  /** Abstand zur Wand, den ein Prop mindestens hält. */
  const RAND = 0.7;
  const RASTER = 32;
  const huellen = welt.gebaeude.map(g => {
    const p = g.punkte.map(([lat, lon]) => zuWelt(lat, lon));
    const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    return { p, minX: Math.min(...xs) - RAND, maxX: Math.max(...xs) + RAND,
             minZ: Math.min(...zs) - RAND, maxZ: Math.max(...zs) + RAND };
  });
  const eimer = new Map<string, number[]>();
  huellen.forEach((h, i) => {
    for (let cx = Math.floor(h.minX / RASTER); cx <= Math.floor(h.maxX / RASTER); cx++)
      for (let cz = Math.floor(h.minZ / RASTER); cz <= Math.floor(h.maxZ / RASTER); cz++) {
        const k = `${cx}:${cz}`;
        const l = eimer.get(k); if (l) l.push(i); else eimer.set(k, [i]);
      }
  });
  return (x, z) => {
    const kandidaten = eimer.get(`${Math.floor(x / RASTER)}:${Math.floor(z / RASTER)}`);
    if (!kandidaten) return false;
    for (const i of kandidaten) {
      const h = huellen[i];
      if (x < h.minX || x > h.maxX || z < h.minZ || z > h.maxZ) continue;
      // Strahlverfahren gegen den Grundriss selbst — die Hülle ist nur der Filter.
      let drin = false;
      const p = h.p;
      for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
        const [xa, za] = p[a], [xb, zb] = p[b];
        if ((za > z) !== (zb > z) && x < ((xb - xa) * (z - za)) / (zb - za) + xa) drin = !drin;
      }
      if (drin) return true;
    }
    return false;
  };
}

export function verteileProps(
  welt: Weltdaten, terrain: TerrainErgebnis, seed = 1,
): PropInstanz[] {
  const zufall = mulberry(seed);
  const n = welt.aufloesung;
  const zellBreite = terrain.breiteMeter / (n - 1);
  const zellTiefe = terrain.tiefeMeter / (n - 1);
  const hektarJeZelle = (zellBreite * zellTiefe * MASSSTAB.stauchung ** 2) / 10_000;
  const imHaus = hausTest(welt, terrain);

  const props: PropInstanz[] = [];

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const biom = welt.biome[i][j];
      const dichte = DICHTE[biom];
      if (!dichte) continue;

      // Neigung der Zelle in Grad — Props auf Steilhängen sehen falsch aus
      const [x0, z0] = terrain.rasterZuWelt(i, j);
      const hMitte = terrain.hoeheAn(x0, z0);
      const dh = Math.max(
        Math.abs(terrain.hoeheAn(x0 + zellBreite, z0) - hMitte),
        Math.abs(terrain.hoeheAn(x0, z0 + zellTiefe) - hMitte),
      );
      const neigung = Math.atan(dh / (zellBreite || 1)) * 180 / Math.PI;

      for (const [art, jeHektar] of Object.entries(dichte) as [PropArt, number][]) {
        if (neigung > (MAX_NEIGUNG_GRAD[art] ?? 90)) continue;
        const erwartet = jeHektar * hektarJeZelle;
        // Nachkommaanteil als Wahrscheinlichkeit — sonst verschwinden seltene Props ganz
        const anzahl = Math.floor(erwartet) + (zufall() < erwartet % 1 ? 1 : 0);
        for (let k = 0; k < anzahl; k++) {
          const x = x0 + zufall() * zellBreite;
          const z = z0 + zufall() * zellTiefe;
          // Gemessen standen 2.416 Props in einem Grundriss, darunter 124 Bäume —
          // die wuchsen durch die Hauswand. Die Verteilung kannte Gebäude nicht.
          if (imHaus(x, z)) continue;
          props.push({
            art,
            variante: Math.floor(zufall() * variantenZahl(art)),
            position: [x, terrain.hoeheAn(x, z), z],
            drehung: zufall() * Math.PI * 2,
            skalierung: 0.75 + zufall() * 0.6,
          });
        }
      }
    }
  }
  return props;
}

// ------------------------------------------------------ Modelle statt Primitive
/**
 * Echte Modelle aus dem Kenney Nature Kit (CC0), umgefärbt über `npm run props:bau`.
 *
 * **Die Höhe steht hier, nicht in einer Normierung.** Vorher zog die Szene jedes
 * Modell auf eine feste Zielhöhe je Art — alle 44.968 Grasbüschel wurden damit auf
 * exakt 0,35 m gestreckt, egal ob das Quellmodell ein Halm oder eine Staude war.
 * Genau die Vielfalt, die im Kit steckt, hat die Normierung wieder herausgerechnet.
 *
 * Die Kenney-Palette wird **nicht** übernommen. Sie ist bewusst bunt (Gras
 * `#73eddd` Minze, Rinde `#f2be9e` Pfirsich) und steht quer zu einer Art Direction
 * aus gedämpften Alpentönen. `propbau.ts` ersetzt sie durch `KENNEY_FARBE` und
 * backt das Ergebnis als Vertexfarbe ein — ein Material für alle Props.
 */
export interface Variante {
  /** Dateiname unter `public/props`, ohne Endung. */
  datei: string;
  /** Quellmodell im Kenney Nature Kit. */
  quelle: string;
  /** Reale Höhe in Metern. */
  hoehe: number;
}

export const VARIANTEN: Record<PropArt, Variante[]> = {
  // Bäume sind prozedural (D40) — die Liste bleibt leer, damit nichts geladen wird,
  // was danach weggeworfen wird. Vorher lagen acht ungenutzte Baum-GLB im
  // Offline-Cache und wurden bei jedem Start vorgeladen. Ihre Vielfalt steht in
  // PROZEDURALE_VARIANTEN, nicht hier.
  nadelbaum: [],
  laubbaum: [],
  busch: [
    { datei: 'busch_klein',    quelle: 'plant_bushSmall',          hoehe: 0.9 },
    { datei: 'busch_dreieck',  quelle: 'plant_bushTriangle',       hoehe: 1.2 },
    { datei: 'busch_mittel',   quelle: 'plant_bush',               hoehe: 1.5 },
    { datei: 'busch_dicht',    quelle: 'plant_bushDetailed',       hoehe: 1.8 },
    { datei: 'busch_breit',    quelle: 'plant_bushLargeTriangle',  hoehe: 2.1 },
    { datei: 'busch_gross',    quelle: 'plant_bushLarge',          hoehe: 2.4 },
  ],
  grasbuschel: [
    { datei: 'gras_matte',     quelle: 'plant_flatShort',   hoehe: 0.18 },
    { datei: 'gras_kurz',      quelle: 'grass',             hoehe: 0.24 },
    { datei: 'gras_halme',     quelle: 'grass_leafs',       hoehe: 0.34 },
    { datei: 'gras_hoch',      quelle: 'grass_large',       hoehe: 0.48 },
    { datei: 'gras_blatt',     quelle: 'grass_leafsLarge',  hoehe: 0.62 },
    { datei: 'gras_staude',    quelle: 'plant_flatTall',    hoehe: 0.85 },
  ],
  findling: [
    { datei: 'findling_flach', quelle: 'rock_smallFlatB',  hoehe: 0.45 },
    { datei: 'findling_klein', quelle: 'rock_smallA',      hoehe: 0.7 },
    { datei: 'findling_kant',  quelle: 'stone_smallD',     hoehe: 0.9 },
    { datei: 'findling_hoch',  quelle: 'rock_tallC',       hoehe: 1.7 },
    { datei: 'findling_block', quelle: 'stone_tallF',      hoehe: 2.2 },
    { datei: 'findling_gross', quelle: 'rock_largeB',      hoehe: 3.0 },
  ],
  totholz: [
    { datei: 'totholz_stamm',  quelle: 'log',                  hoehe: 0.5 },
    { datei: 'totholz_dick',   quelle: 'log_large',            hoehe: 0.8 },
    { datei: 'totholz_stapel', quelle: 'log_stack',            hoehe: 0.7 },
    { datei: 'totholz_stumpf', quelle: 'stump_round',          hoehe: 0.6 },
    { datei: 'totholz_wurzel', quelle: 'stump_old',            hoehe: 1.0 },
    { datei: 'totholz_kante',  quelle: 'stump_squareDetailed', hoehe: 0.75 },
  ],
  blume: [
    { datei: 'blume_gelb',     quelle: 'flower_yellowB', hoehe: 0.26 },
    { datei: 'blume_gelb2',    quelle: 'flower_yellowC', hoehe: 0.3 },
    { datei: 'blume_rot',      quelle: 'flower_redA',    hoehe: 0.24 },
    { datei: 'blume_rot2',     quelle: 'flower_redC',    hoehe: 0.28 },
    { datei: 'blume_violett',  quelle: 'flower_purpleA', hoehe: 0.22 },
    { datei: 'blume_violett2', quelle: 'flower_purpleB', hoehe: 0.32 },
  ],
  pilz: [
    { datei: 'pilz_rot',       quelle: 'mushroom_red',       hoehe: 0.16 },
    { datei: 'pilz_rot_hoch',  quelle: 'mushroom_redTall',   hoehe: 0.26 },
    { datei: 'pilz_rot_gruppe',quelle: 'mushroom_redGroup',  hoehe: 0.2 },
    { datei: 'pilz_hell',      quelle: 'mushroom_tan',       hoehe: 0.15 },
    { datei: 'pilz_hell_hoch', quelle: 'mushroom_tanTall',   hoehe: 0.24 },
    { datei: 'pilz_hell_grupp',quelle: 'mushroom_tanGroup',  hoehe: 0.19 },
  ],
};

/**
 * Kenney-Materialname → Farbe dieser Art Direction.
 *
 * Die Namen sind die Rollen, die Kenney im ganzen Kit durchhält (`grass` in 129
 * Modellen, `dirt` in 98, `stone` in 89). Damit reicht eine Tabelle für alle 329
 * Modelle, und ein neu hinzugenommenes Modell ist automatisch richtig gefärbt.
 *
 * Die Töne stammen aus `BIOM_FARBE` und `BAUM` — dieselbe Palette, aus der auch
 * Gelände und Bäume kommen. Ein Busch, der aus einer zweiten Palette stammt, fällt
 * sofort als Fremdkörper auf, und genau das war der Zustand vorher.
 */
export const KENNEY_FARBE: Record<string, string> = {
  grass:        '#4a5940',
  leafsGreen:   '#55703a',
  leafsDark:    '#3c5439',
  leafsFall:    '#7a6634',
  woodBark:     '#4f4436',
  woodBarkDark: '#40372c',
  wood:         '#6b5c46',
  woodDark:     '#4a4034',
  woodBirch:    '#8a8375',
  woodInner:    '#6d6250',
  dirt:         '#6b6144',
  dirtDark:     '#544c37',
  stone:        '#6b6f72',
  stoneDark:    '#565a5d',
  water:        '#33555f',
  corn:         '#9a8b4a',
  colorRed:     '#8c4a42',
  colorRedDark: '#6f3a34',
  colorYellow:  '#b09a4e',
  colorPurple:  '#6b5f7a',
  colorWhite:   '#c9c6bd',
  colorTan:     '#a8926a',
  _defaultMat:  '#6b6659',
};

/**
 * Wie viele Formen eine prozedurale Art kennt.
 *
 * `baueBaum` benutzt die Variantennummer als Seed für Höhe, Astwinkel und
 * Laubdichte — ohne sie ist jede Fichte im Œntal dieselbe Fichte. Als die
 * GLB-Liste für Bäume auf leer ging, fiel genau das still weg: Die Zahl der
 * Prop-Chunks halbierte sich, was nach Ersparnis aussah und in Wahrheit ein
 * geklonter Wald war.
 */
export const PROZEDURALE_VARIANTEN: Partial<Record<PropArt, number>> = {
  nadelbaum: 4, laubbaum: 4,
};

/** Wie viele Varianten eine Art hat — Datei oder Rechenvorschrift. */
export const variantenZahl = (art: PropArt): number =>
  VARIANTEN[art].length || PROZEDURALE_VARIANTEN[art] || 1;

/** Reale Zielhöhe je Art in Metern — nur noch für die Fernattrappe. */
export const ZIELHOEHE: Record<PropArt, number> = {
  nadelbaum: 22, laubbaum: 14, busch: 1.6, findling: 1.1, totholz: 0.9,
  grasbuschel: 0.35, blume: 0.26, pilz: 0.18,
};

export const propPfad = (datei: string) => `/props/${datei}.glb`;

/**
 * Fernattrappe: dasselbe Primitiv wie der Rückfall, aber auf die reale Zielhöhe
 * normiert und mit Vertex-Farbe versehen, damit alle Arten sich ein Material teilen.
 *
 * Der Grund ist Budget, nicht Faulheit. Gemessen (16.08.2026):
 *
 * ```
 *   Art          GLB   Primitiv   Faktor
 *   nadelbaum    146          9    16,2x
 *   laubbaum     191         20     9,5x
 *   totholz      160         11    14,1x
 *   grasbuschel  109          6    17,2x
 * ```
 *
 * Mit voller Modellqualität bis zur Sichtweite kostet der dichteste Standort
 * 1,4 Mio Dreiecke gegen ein Handybudget von 400.000. Auf Entfernung, im Nebel und
 * als Silhouette ist der Unterschied zwischen Kenney-Fichte und Kegel ohnehin
 * marginal — die Art Direction lebt von Umrissen (ADR-0002).
 */
export function attrappeGeometrie(art: PropArt): THREE.BufferGeometry {
  const g = propGeometrie(art);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const hoehe = bb.max.y - bb.min.y || 1;
  const faktor = ZIELHOEHE[art] / hoehe;
  g.translate(0, -bb.min.y, 0);
  g.scale(faktor, faktor, faktor);

  const farbe = new THREE.Color(PROP_FARBE[art]);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i*3] = farbe.r; col[i*3+1] = farbe.g; col[i*3+2] = farbe.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Rückfall auf Primitive, solange ein Modell nicht geladen ist — die Szene soll
 * nicht leer bleiben, wenn eine Datei fehlt.
 */
export function propGeometrie(art: PropArt): THREE.BufferGeometry {
  switch (art) {
    case 'nadelbaum': {
      const g = new THREE.ConeGeometry(1.1, 5.5, 6);
      g.translate(0, 2.75, 0);
      return g;
    }
    case 'laubbaum': {
      const g = new THREE.IcosahedronGeometry(1.8, 0);
      g.scale(1, 1.25, 1);
      g.translate(0, 3.2, 0);
      return g;
    }
    case 'busch': {
      const g = new THREE.IcosahedronGeometry(0.75, 0);
      g.scale(1.25, 0.85, 1.25);
      g.translate(0, 0.6, 0);
      return g;
    }
    case 'findling': {
      const g = new THREE.DodecahedronGeometry(0.9, 0);
      g.scale(1.3, 0.75, 1.1);
      g.translate(0, 0.35, 0);
      return g;
    }
    case 'totholz': {
      const g = new THREE.CylinderGeometry(0.14, 0.2, 3.4, 5);
      g.rotateZ(Math.PI * 0.42);
      g.translate(0, 0.35, 0);
      return g;
    }
    case 'grasbuschel': {
      const g = new THREE.ConeGeometry(0.3, 0.9, 4);
      g.translate(0, 0.45, 0);
      return g;
    }
    case 'blume': {
      const g = new THREE.ConeGeometry(0.06, 0.26, 4);
      g.translate(0, 0.13, 0);
      return g;
    }
    case 'pilz': {
      const g = new THREE.CylinderGeometry(0.09, 0.03, 0.16, 5);
      g.translate(0, 0.08, 0);
      return g;
    }
  }
}

export const PROP_FARBE: Record<PropArt, THREE.ColorRepresentation> = {
  // Muss zu `BAUM` in baum.ts passen: Die Attrappe uebernimmt ab 75 m, und wenn sie
  // dunkler ist als der Baum davor, sieht man die Umschaltung als Farbsprung.
  nadelbaum:   '#3a5138',
  laubbaum:    '#5c774a',
  busch:       '#3f4f33',
  findling:    '#6e7276',
  totholz:     '#4a4239',
  grasbuschel: '#5c6b45',
  blume:       '#7d7a4e',
  pilz:        '#6b5f52',
};

/**
 * Props in ein Raster einteilen. InstancedMesh zeichnet immer ALLE Instanzen —
 * ohne Chunks gibt es kein Entfernungs-Culling, und 80.000 Grasbüschel am anderen
 * Ende der Karte kosten dieselbe Zeit wie die vor der Nase.
 */
export interface PropChunk {
  art: PropArt;
  variante: number;
  mitte: [number, number];
  radius: number;
  sichtweite: number;
  instanzen: PropInstanz[];
}

/**
 * Kantenlänge eines Chunks in Metern.
 *
 * 120 m waren zu grob, seit die Detailstufe je Chunk entschieden wird: Die Bänder
 * (voll bis 45 m, mittel bis 110 m) fielen **zwischen** das Raster, weil die nächsten
 * Chunkmitten 120 m auseinanderliegen. Das Ergebnis war eine Entscheidung mit zwei
 * Zuständen, obwohl drei gebaut waren — gemessen unveränderte 465.000 Dreiecke.
 *
 * 70 m ist der Kompromiss: fein genug, dass alle drei Bänder vorkommen, grob genug,
 * dass die Zahl der Draw Calls nicht davonläuft.
 */
const CHUNK_METER = 70;

export function chunkeProps(
  props: PropInstanz[], chunkGroesse = CHUNK_METER,
): PropChunk[] {
  const buckets = new Map<string, PropInstanz[]>();
  for (const p of props) {
    const cx = Math.floor(p.position[0] / chunkGroesse);
    const cz = Math.floor(p.position[2] / chunkGroesse);
    const key = `${p.art}|${p.variante}|${cx}|${cz}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  const chunks: PropChunk[] = [];
  for (const [key, instanzen] of buckets) {
    const [art, variante, cx, cz] = key.split('|');
    chunks.push({
      art: art as PropArt,
      variante: Number(variante),
      mitte: [(Number(cx) + 0.5) * chunkGroesse, (Number(cz) + 0.5) * chunkGroesse],
      radius: chunkGroesse * 0.75,
      sichtweite: SICHTWEITE[art as PropArt],
      instanzen,
    });
  }
  return chunks;
}

/** Für die Anzeige: wie viele Instanzen je Art. */
export function zaehleProps(props: PropInstanz[]): Record<string, number> {
  const z: Record<string, number> = {};
  for (const p of props) z[p.art] = (z[p.art] ?? 0) + 1;
  return z;
}
