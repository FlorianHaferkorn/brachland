/**
 * BRACHLAND — Terrain aus Weltdaten
 *
 * Baut aus Heightmap + Biom-Raster eine three.js-Geometrie. Bewusst ohne Texturen:
 * Vertex-Farben plus Flat-Shading tragen den Low-Poly-Stil, sparen Ladezeit und
 * kommen ohne zusätzliche Dateien im Offline-Cache aus.
 *
 * Weltkoordinaten: X = Ost, Y = Höhe, Z = Süd. Ursprung in der Mitte des Ausschnitts.
 */
import * as THREE from 'three';
import type { Weltdaten, Biom } from './osm.js';

/** Meter je Breitengrad; für Längengrad mit cos(lat) skaliert. */
const METER_JE_GRAD = 111_320;

/** Maximale Länge eines Wege-Teilstücks in Metern, bevor neu aufs Gelände gelegt wird. */
export const WEG_TEILUNG = 4;

export const MASSSTAB = {
  /**
   * 1 Spieleinheit = 1 realer Meter.
   *
   * Die frühere Stauchung 1:4 war ein Fehler: Sie macht den Spieler 0,45 Einheiten
   * hoch und zwingt entweder zu winzigen Zahlen (schlecht für Kollision und Physik)
   * oder zu einer Bewegungsgeschwindigkeit, die gegenüber Bäumen und Häusern
   * viermal zu schnell wirkt. Größenverhältnisse waren der Grund für 3D — die
   * gibt man dafür nicht auf.
   *
   * Der Preis: 4 km Region sind zu Fuß ~13 Minuten im Laufen. Das wird nicht über
   * Stauchung gelöst, sondern über Traversal (Reitkreatur, Pfade, Schnellreise zu
   * geheilten Orten) — also über Spielinhalt statt über verzerrte Maßstäbe.
   */
  stauchung: 1,
  /** Höhenüberhöhung. Über ~1,5 wirkt es falsch, wenn man die Gegend kennt. */
  ueberhoehung: 1.15,
} as const;

/** Reale Maße als eine Quelle — verhindert, dass Größen auseinanderlaufen. */
export const GROESSE = {
  spieler: 1.8,
  kameraHoehe: 3.4,      // über dem Spielerfuß
  kameraAbstand: 6.0,    // hinter dem Spieler
  kameraBlickHoehe: 1.5, // Blickpunkt etwa auf Brusthöhe
} as const;

/** Gedämpfte Naturtöne + eine Signalfarbe — siehe Art Direction. */
export const BIOM_FARBE: Record<Biom, THREE.ColorRepresentation> = {
  fels:      '#6b6f72',
  wald:      '#2c4232',
  gebuesch:  '#4a5940',
  wiese:     '#5f6f4c',
  acker:     '#78714f',
  wasser:    '#33555f',
  siedlung:  '#5c5850',
  industrie: '#5a4a44',
  ruine:     '#514c47',
  unbekannt: '#4d5750',
};

export interface TerrainErgebnis {
  geometrie: THREE.BufferGeometry;
  breiteMeter: number;
  tiefeMeter: number;
  /** Höhe an Weltposition — für Spielerbewegung und Objektplatzierung. */
  hoeheAn: (x: number, z: number) => number;
  /** Biom an Weltposition — für Encounter-Auswahl. */
  biomAn: (x: number, z: number) => Biom;
  weltZuRaster: (x: number, z: number) => [number, number];
  rasterZuWelt: (i: number, j: number) => [number, number];
}

export function baueTerrain(welt: Weltdaten): TerrainErgebnis {
  const [sued, west, nord, ost] = welt.bbox;
  const n = welt.aufloesung;
  const mittelLat = (sued + nord) / 2;

  const breiteMeter = (ost - west) * METER_JE_GRAD * Math.cos(mittelLat * Math.PI / 180) / MASSSTAB.stauchung;
  const tiefeMeter  = (nord - sued) * METER_JE_GRAD / MASSSTAB.stauchung;

  // Lücken im DEM auffüllen, sonst reißt die Geometrie Löcher
  const gueltig = welt.hoehen.flat().filter(h => !Number.isNaN(h));
  const mittel = gueltig.reduce((a, b) => a + b, 0) / Math.max(1, gueltig.length);
  const h = welt.hoehen.map(z => z.map(x => (Number.isNaN(x) ? mittel : x)));

  const rasterZuWelt = (i: number, j: number): [number, number] => [
    (j / (n - 1) - 0.5) * breiteMeter,
    (i / (n - 1) - 0.5) * tiefeMeter,
  ];
  const weltZuRaster = (x: number, z: number): [number, number] => [
    Math.max(0, Math.min(n - 1, Math.round((z / tiefeMeter + 0.5) * (n - 1)))),
    Math.max(0, Math.min(n - 1, Math.round((x / breiteMeter + 0.5) * (n - 1)))),
  ];

  const hoeheRoh = (i: number, j: number) =>
    (h[Math.max(0, Math.min(n - 1, i))][Math.max(0, Math.min(n - 1, j))] - welt.hoeheMin)
    * MASSSTAB.ueberhoehung / MASSSTAB.stauchung;

  // Nicht-indizierte Geometrie: jedes Dreieck bekommt eigene Vertices, damit
  // Flat-Shading und harte Biom-Kanten funktionieren (kein Farbverlauf über die Naht).
  const positionen: number[] = [];
  const farben: number[] = [];
  const farbe = new THREE.Color();

  const dreieck = (a: [number, number], b: [number, number], c: [number, number]) => {
    for (const [i, j] of [a, b, c]) {
      const [x, z] = rasterZuWelt(i, j);
      positionen.push(x, hoeheRoh(i, j), z);
    }
    // Farbe aus dem häufigsten Biom der drei Ecken — kein Mischen, sonst Matsch
    const kandidaten = [a, b, c].map(([i, j]) => welt.biome[i][j]);
    const zaehler: Partial<Record<Biom, number>> = {};
    for (const k of kandidaten) zaehler[k] = (zaehler[k] ?? 0) + 1;
    const gewinner = (Object.entries(zaehler).sort((x, y) => y[1]! - x[1]!)[0][0]) as Biom;
    farbe.set(BIOM_FARBE[gewinner]);
    // leichte Streuung je Dreieck, damit Flächen nicht wie Plastik wirken
    const jitter = 0.94 + ((a[0] * 73 + a[1] * 149) % 13) / 100;
    for (let k = 0; k < 3; k++) farben.push(farbe.r * jitter, farbe.g * jitter, farbe.b * jitter);
  };

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      dreieck([i, j], [i + 1, j], [i, j + 1]);
      dreieck([i + 1, j], [i + 1, j + 1], [i, j + 1]);
    }
  }

  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  geometrie.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  geometrie.computeVertexNormals();
  geometrie.computeBoundingBox();

  const hoeheAn = (x: number, z: number) => {
    const [i, j] = weltZuRaster(x, z);
    return hoeheRoh(i, j);
  };
  const biomAn = (x: number, z: number) => {
    const [i, j] = weltZuRaster(x, z);
    return welt.biome[i][j];
  };

  return { geometrie, breiteMeter, tiefeMeter, hoeheAn, biomAn, weltZuRaster, rasterZuWelt };
}

/** Gewässer als eigene Ebenen — Flüsse und Bäche aus den OSM-Linien. */
/** Wie hoch die Wasserfläche über dem Gelände liegt. */
const WASSER_UEBER_GRUND = 0.06;

export function baueGewaesser(welt: Weltdaten, terrain: TerrainErgebnis): THREE.BufferGeometry | null {
  const [sued, west, nord, ost] = welt.bbox;
  const positionen: number[] = [];
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * terrain.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * terrain.tiefeMeter,
  ];

  const uvs: number[] = [];

  for (const linie of welt.linien) {
    const halbe = linie.breite / (2 * MASSSTAB.stauchung);
    let laengs = 0;
    for (let k = 0; k < linie.punkte.length - 1; k++) {
      const [ax, az] = zuWelt(...linie.punkte[k]);
      const [bx, bz] = zuWelt(...linie.punkte[k + 1]);
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * halbe, nz = (dx / len) * halbe;

      // In Teilstücke zerlegen und je Stück die Höhe neu abfragen.
      //
      // OSM-Stützpunkte liegen oft dutzende Meter auseinander. Ein Band, das nur an
      // den Enden aufs Gelände gelegt wird, schneidet dazwischen durch Kuppen und
      // schwebt über Senken — gemessen bis 3 m, obwohl beide Enden richtig sitzen.
      const teile = Math.max(1, Math.ceil(len / WEG_TEILUNG));
      for (let s = 0; s < teile; s++) {
        const t1 = s / teile, t2 = (s + 1) / teile;
        const x1 = ax + dx * t1, z1 = az + dz * t1;
        const x2 = ax + dx * t2, z2 = az + dz * t2;
        // Nur knapp über dem Gelände: Bei 30 cm stand das Band als Platte in der
        // Landschaft. Die weichen Ränder macht jetzt das Material, nicht die Höhe.
        const y1 = terrain.hoeheAn(x1, z1) + WASSER_UEBER_GRUND;
        const y2 = terrain.hoeheAn(x2, z2) + WASSER_UEBER_GRUND;
        const v1 = laengs + len * t1, v2 = laengs + len * t2;
        positionen.push(
          x1 - nx, y1, z1 - nz,  x1 + nx, y1, z1 + nz,  x2 - nx, y2, z2 - nz,
          x1 + nx, y1, z1 + nz,  x2 + nx, y2, z2 + nz,  x2 - nx, y2, z2 - nz,
        );
        // u = quer, -1 am linken Ufer bis +1 am rechten. v = Meter flussabwärts.
        uvs.push(-1, v1,  1, v1,  -1, v2,   1, v1,  1, v2,  -1, v2);
      }
      laengs += len;
    }
  }
  if (!positionen.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * Wege und Straßen als flache Bänder auf dem Terrain. Strukturieren die Landschaft
 * stark — ohne sie wirkt selbst gutes Gelände wie unbewohnte Wildnis.
 */
export function baueWege(welt: Weltdaten, terrain: TerrainErgebnis): THREE.BufferGeometry | null {
  const [sued, west, nord, ost] = welt.bbox;
  const positionen: number[] = [];
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * terrain.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * terrain.tiefeMeter,
  ];
  const uvs: number[] = [];

  for (const weg of welt.wege) {
    const halbe = weg.breite / (2 * MASSSTAB.stauchung);
    let laengs = 0;
    for (let k = 0; k < weg.punkte.length - 1; k++) {
      const [ax, az] = zuWelt(...weg.punkte[k]);
      const [bx, bz] = zuWelt(...weg.punkte[k + 1]);
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * halbe, nz = (dx / len) * halbe;

      const teile = Math.max(1, Math.ceil(len / WEG_TEILUNG));
      for (let t = 0; t < teile; t++) {
        const t1 = t / teile, t2 = (t + 1) / teile;
        const x1 = ax + dx * t1, z1 = az + dz * t1;
        const x2 = ax + dx * t2, z2 = az + dz * t2;
        // knapp über dem Boden, damit nichts durch das Terrain blitzt
        const y1 = terrain.hoeheAn(x1, z1) + 0.12;
        const y2 = terrain.hoeheAn(x2, z2) + 0.12;
        const v1 = laengs + len * t1, v2 = laengs + len * t2;
        positionen.push(
          x1 - nx, y1, z1 - nz,  x1 + nx, y1, z1 + nz,  x2 - nx, y2, z2 - nz,
          x1 + nx, y1, z1 + nz,  x2 + nx, y2, z2 + nz,  x2 - nx, y2, z2 - nz,
        );
        uvs.push(-1, v1,  1, v1,  -1, v2,   1, v1,  1, v2,  -1, v2);
      }
      laengs += len;
    }
  }
  if (!positionen.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * Gebäude aus OSM-Grundrissen. Höhe aus `building:levels` (3 m je Ebene), plus
 * einfaches Satteldach — ohne Dach wirkt jede Siedlung wie ein Industriegebiet.
 */
export function baueGebaeude(welt: Weltdaten, terrain: TerrainErgebnis): THREE.BufferGeometry | null {
  const [sued, west, nord, ost] = welt.bbox;
  const positionen: number[] = [];
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * terrain.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * terrain.tiefeMeter,
  ];
  const METER_JE_EBENE = 3;

  for (const g of welt.gebaeude) {
    const p = g.punkte.map(([lat, lon]) => zuWelt(lat, lon));
    if (p.length < 3) continue;
    const h = (g.ebenen * METER_JE_EBENE) / MASSSTAB.stauchung;
    const boden = Math.min(...p.map(([x, z]) => terrain.hoeheAn(x, z)));
    // Wände
    for (let k = 0; k < p.length - 1; k++) {
      const [x1, z1] = p[k], [x2, z2] = p[k + 1];
      positionen.push(
        x1, boden, z1,  x2, boden, z2,  x1, boden + h, z1,
        x2, boden, z2,  x2, boden + h, z2,  x1, boden + h, z1,
      );
    }
    // Dach: Firstlinie über der längsten Achse, Neigung nach Gebäudegröße
    const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const laengsX = (maxX - minX) >= (maxZ - minZ);
    const firstH = boden + h + Math.min(maxX - minX, maxZ - minZ) * 0.35;
    const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2;
    if (laengsX) {
      positionen.push(
        minX, boden + h, minZ,  maxX, boden + h, minZ,  minX, firstH, mz,
        maxX, boden + h, minZ,  maxX, firstH, mz,       minX, firstH, mz,
        minX, boden + h, maxZ,  minX, firstH, mz,       maxX, boden + h, maxZ,
        maxX, boden + h, maxZ,  minX, firstH, mz,       maxX, firstH, mz,
      );
    } else {
      positionen.push(
        minX, boden + h, minZ,  mx, firstH, minZ,       minX, boden + h, maxZ,
        minX, boden + h, maxZ,  mx, firstH, minZ,       mx, firstH, maxZ,
        maxX, boden + h, minZ,  maxX, boden + h, maxZ,  mx, firstH, minZ,
        maxX, boden + h, maxZ,  mx, firstH, maxZ,       mx, firstH, minZ,
      );
    }
  }
  if (!positionen.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  geo.computeVertexNormals();
  return geo;
}
