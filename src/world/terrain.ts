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
  // Waldboden war `#2c4232` und damit auf denselben Helligkeitswert wie die
  // Fichtennadel (`#334a33`) gesetzt — gemessener Kontrast 1,00:1 in allen vier
  // Stimmungen. Beschatteter Wald war deshalb nicht nur dunkel, sondern **eine
  // einzige Fläche**: Boden und Krone ließen sich nicht trennen. Nadelstreu ist
  // in Wirklichkeit heller und wärmer als das Kronendach, weil sie das
  // Chlorophyll nicht mehr hat. `npm run licht`
  wald:      '#55613f',
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

/**
 * Höhenquelle für alles, was auf dem Gelände **aufsitzt** — Wasserbänder, Wege,
 * Hauswände.
 *
 * Warum ein eigener Typ und nicht einfach `TerrainErgebnis`? Weil die Szene dort
 * bisher ein zurechtgebasteltes `{...terrain, hoeheAn: feld.hoehe}` durchgereicht
 * hat und die Werkzeuge das rohe `terrain`. Zwei Aufrufer, zwei Höhen, und die
 * Messung prüfte die falsche davon (G-73). Ein Typ, den nur `aufsatzboden()`
 * erfüllt, zwingt beide auf denselben Weg.
 */
export interface Aufsatzboden {
  breiteMeter: number;
  tiefeMeter: number;
  /** Höhe der Oberkante — stetige Funktion, feinste Auflösung. */
  hoeheAn: (x: number, z: number) => number;
  /**
   * Tiefste Höhe, die die **gezeichnete** Fläche hier über alle LOD-Stufen annehmen
   * kann.
   *
   * Das Gelände wird in der Ferne auf 32-m-Vertices ausgedünnt und schneidet dann
   * durch jede Mulde. Für Bänder ist das seit D73 kein Thema mehr — die werden je
   * Kachel auf ihrer eigenen Stufe gebaut. Ein Haus dagegen ist ein Körper und
   * wird einmal gebaut; die Differenz zu `hoeheAn` sagt ihm, wie tief sein
   * Fundament reichen muss, damit unter der Wand auch aus 800 m keine Lücke
   * klafft.
   */
  tiefsteFlaeche: (x: number, z: number) => number;
}

/**
 * Wie tief ein Fundament höchstens unter den Sockel reicht.
 *
 * Ein Haus, dessen Wand 15 m in den Berg gebaut wird, kostet Dreiecke für einen
 * Keller, den niemand sieht. Zwei Meter fünfzig decken jede Lücke, die auf einer
 * Entfernung auffällt, an der man Häuser überhaupt einzeln wahrnimmt.
 */
export const FUNDAMENT_MAX = 2.5;

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

/**
 * Wege, Gewässer und Wasserfälle stehen **nicht mehr hier**.
 *
 * Sie sind nach `baender.ts` gewandert und werden dort je Kachel gebaut, auf der
 * LOD-Stufe, die an dieser Stelle auch gezeichnet wird. Ein Band für die ganze
 * Region muss sich für eine Höhe entscheiden; das Gelände hat aber fünf. Die
 * Böschung, die hier eine Woche lang stand, hat das zugedeckt statt behoben und
 * 112.000 Dreiecke auf ungecullten Meshes gekostet (D73).
 *
 * Gebäude bleiben hier: Sie sind Körper, keine Auflagen, und ihre Höhe hängt
 * nicht davon ab, wie fein das Netz unter ihnen ist.
 */


/**
 * Gebäude aus OSM-Grundrissen. Höhe aus `building:levels` (3 m je Ebene), plus
 * einfaches Satteldach — ohne Dach wirkt jede Siedlung wie ein Industriegebiet.
 */
export function baueGebaeude(welt: Weltdaten, terrain: Aufsatzboden): THREE.BufferGeometry | null {
  const [sued, west, nord, ost] = welt.bbox;
  const positionen: number[] = [];
  const farben: number[] = [];
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * terrain.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * terrain.tiefeMeter,
  ];
  const METER_JE_EBENE = 3;

  /**
   * Farben eines Alpenhauses.
   *
   * Drei Rollen, nicht mehr: verputzte Wand, dunkles Holz für Dach und Balkon,
   * fast schwarze Fenster. Alles daraus abgeleitet — das ist dasselbe enge
   * Vokabular wie beim Himmel.
   */
  const WAND = new THREE.Color('#6d675d');
  const HOLZ = new THREE.Color('#3b3229');
  const DACH = new THREE.Color('#4a4038');
  const FENSTER = new THREE.Color('#11171a');

  /** Ein Dreieck mit Farbe. */
  const tri = (
    a: [number, number, number], b: [number, number, number], c: [number, number, number],
    f: THREE.Color,
  ) => {
    positionen.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) farben.push(f.r, f.g, f.b);
  };

  /** Ein Viereck als zwei Dreiecke, gegen den Uhrzeigersinn. */
  const quad = (
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number], f: THREE.Color,
  ) => { tri(a, b, c, f); tri(a, c, d, f); };

  for (const g of welt.gebaeude) {
    const p = g.punkte.map(([lat, lon]) => zuWelt(lat, lon));
    if (p.length < 3) continue;
    const h = (g.ebenen * METER_JE_EBENE) / MASSSTAB.stauchung;

    /**
     * Sockel auf den tiefsten Punkt der **Wandlinie**, nicht der Ecken.
     *
     * Der Unterschied ist keine Feinheit: Bei 301 von 2.009 Häusern liegt das
     * Gelände zwischen zwei Ecken tiefer als an beiden Ecken, im Extrem 2,23 m
     * (`npm run aufsatz`). Genau dort steht die Wand auf nichts, und man sieht
     * unter dem Haus hindurch. Abgetastet wird alle 1,5 m — feiner als das
     * Mikrorelief Wellen schlägt.
     */
    let boden = Infinity, unterkante = Infinity;
    for (let k = 0; k < p.length - 1; k++) {
      const [ax, az] = p[k], [bx, bz] = p[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
      for (let i = 0; i <= n; i++) {
        const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
        boden = Math.min(boden, terrain.hoeheAn(x, z));
        unterkante = Math.min(unterkante, terrain.tiefsteFlaeche(x, z));
      }
    }
    if (!Number.isFinite(boden)) continue;
    // Fundament: so weit unter den Sockel, wie das gezeichnete Gelände in der
    // Ferne wegfallen kann. Deckelt bei FUNDAMENT_MAX — ein Haus braucht keinen
    // 15 m tiefen Keller, den ohnehin niemand sieht.
    const fuss = boden - Math.min(FUNDAMENT_MAX, Math.max(0, boden - unterkante));

    /**
     * Orientierte Hülle statt achsparalleler.
     *
     * Bisher folgten die Wände dem Grundriss, Dach und Balkon aber der
     * achsparallelen Bounding Box. Nur 9 % der Grundrisse liegen achsnah, die
     * mittlere Drehung beträgt 27° — die Hülle ist im Median **1,9-fach** so groß
     * wie das Haus, im Extremfall 4-fach. Dach und Haus waren buchstäblich zwei
     * verschiedene Körper: Der Deckel stand über, der First zeigte in die falsche
     * Richtung, und an den Ecken klaffte es.
     *
     * Die Achse kommt aus der längsten Kante. Bei einem rechteckigen Grundriss ist
     * das exakt die Firstrichtung, bei einem verwinkelten die dominante — beides
     * besser als Nord-Süd per Zufall.
     */
    let achse = 0, laengste = 0;
    for (let k = 0; k < p.length - 1; k++) {
      const dx = p[k + 1][0] - p[k][0], dz = p[k + 1][1] - p[k][1];
      const l = Math.hypot(dx, dz);
      if (l > laengste) { laengste = l; achse = Math.atan2(dz, dx); }
    }
    let cos = Math.cos(achse), sin = Math.sin(achse);
    const lokal = (x: number, z: number): [number, number] => [x * cos + z * sin, -x * sin + z * cos];
    let lok = p.map(([x, z]) => lokal(x, z));
    let minU = Math.min(...lok.map(q => q[0])), maxU = Math.max(...lok.map(q => q[0]));
    let minV = Math.min(...lok.map(q => q[1])), maxV = Math.max(...lok.map(q => q[1]));
    // u soll die lange Achse sein — sonst läuft der First über die schmale Seite.
    if (maxV - minV > maxU - minU) {
      achse += Math.PI / 2;
      cos = Math.cos(achse); sin = Math.sin(achse);
      lok = p.map(([x, z]) => lokal(x, z));
      minU = Math.min(...lok.map(q => q[0])); maxU = Math.max(...lok.map(q => q[0]));
      minV = Math.min(...lok.map(q => q[1])); maxV = Math.max(...lok.map(q => q[1]));
    }
    /** Punkt im Hüllensystem zurück nach Welt, mit Höhe. */
    const welt3 = (u: number, y: number, v: number): [number, number, number] =>
      [u * cos - v * sin, y, u * sin + v * cos];

    const breite = maxU - minU, tiefe = maxV - minV;
    const klein = Math.min(breite, tiefe);
    if (klein < 1.5) continue;

    // Wände
    for (let k = 0; k < p.length - 1; k++) {
      const [x1, z1] = p[k], [x2, z2] = p[k + 1];
      quad([x1, fuss, z1], [x2, fuss, z2], [x2, boden + h, z2], [x1, boden + h, z1], WAND);

      /**
       * Fenster als aufgesetzte Flächen, nicht als Löcher in der Wand.
       *
       * Ein Loch bräuchte eine Triangulierung mit Aussparung — bei 2.033 Grundrissen
       * die teuerste Art, ein Rechteck dunkel zu färben. Aufgesetzt liegen sie 4 cm
       * vor der Wand; auf jede Entfernung, auf der man Fenster überhaupt sieht, ist
       * der Unterschied unsichtbar. Sie sind der Grund, warum ein Haus als Haus
       * gelesen wird und nicht als Quader.
       */
      const laenge = Math.hypot(x2 - x1, z2 - z1);
      if (laenge < 2.2) continue;
      const nx = (z2 - z1) / laenge, nz = -(x2 - x1) / laenge;   // Wandnormale
      const anzahl = Math.max(1, Math.floor(laenge / 3.2));
      const breiteF = 0.9, hoeheF = 1.15;
      for (let ebene = 0; ebene < g.ebenen; ebene++) {
        const yUnten = boden + ebene * METER_JE_EBENE + 1.05;
        if (yUnten + hoeheF > boden + h - 0.25) continue;
        for (let i = 0; i < anzahl; i++) {
          const t = (i + 0.5) / anzahl;
          const cx = x1 + (x2 - x1) * t, cz = z1 + (z2 - z1) * t;
          const ex = (x2 - x1) / laenge * breiteF / 2, ez = (z2 - z1) / laenge * breiteF / 2;
          const o = 0.04;
          quad(
            [cx - ex + nx * o, yUnten, cz - ez + nz * o],
            [cx + ex + nx * o, yUnten, cz + ez + nz * o],
            [cx + ex + nx * o, yUnten + hoeheF, cz + ez + nz * o],
            [cx - ex + nx * o, yUnten + hoeheF, cz - ez + nz * o],
            FENSTER,
          );
        }
      }
    }

    /**
     * Dach mit Überstand.
     *
     * Der Überstand ist das Merkmal, an dem man ein Alpenhaus erkennt — bis zu
     * anderthalb Meter weit, damit der Schnee vom Balkon bleibt. Ohne ihn sitzt das
     * Dach bündig auf dem Quader, und genau das sah aus wie ein Karton mit Deckel.
     */
    const ueber = Math.min(1.4, klein * 0.16);
    const traufe = boden + h;
    const firstH = traufe + klein * 0.42;
    const aU0 = minU - ueber, aU1 = maxU + ueber;
    const aV0 = minV - ueber, aV1 = maxV + ueber;
    const mv = (minV + maxV) / 2;

    // First läuft über u, die lange Achse. Die Fallunterscheidung von früher ist
    // weg — die Drehung erledigt, was vorher zwei Zweige tun mussten.
    quad(welt3(aU0, traufe, aV0), welt3(aU1, traufe, aV0),
         welt3(aU1, firstH, mv), welt3(aU0, firstH, mv), DACH);
    quad(welt3(aU1, traufe, aV1), welt3(aU0, traufe, aV1),
         welt3(aU0, firstH, mv), welt3(aU1, firstH, mv), DACH);
    // Giebeldreiecke schließen die Stirnseiten — sonst schaut man ins Dach hinein.
    tri(welt3(minU, traufe, minV), welt3(minU, traufe, maxV), welt3(minU, firstH, mv), WAND);
    tri(welt3(maxU, traufe, maxV), welt3(maxU, traufe, minV), welt3(maxU, firstH, mv), WAND);

    /**
     * Balkon unter der Traufe der Längsseite.
     *
     * Nur für Häuser ab zwei Ebenen und ab 6 m Länge — ein Balkon an einer Garage
     * wäre komischer als gar keiner. Zwei Flächen: Boden und Brüstung.
     */
    if (g.ebenen >= 2 && Math.max(breite, tiefe) >= 6) {
      const y = boden + (g.ebenen - 1) * METER_JE_EBENE + 0.6;
      const tiefeB = 1.1;
      const v0 = maxV, v1 = maxV + tiefeB;
      quad(welt3(minU, y, v0), welt3(maxU, y, v0),
           welt3(maxU, y, v1), welt3(minU, y, v1), HOLZ);
      quad(welt3(minU, y, v1), welt3(maxU, y, v1),
           welt3(maxU, y + 0.95, v1), welt3(minU, y + 0.95, v1), HOLZ);
    }
  }

  if (!positionen.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  geo.computeVertexNormals();
  return geo;
}
