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
  fels:      '#81868a',
  // Waldboden war `#37513e` und damit auf denselben Helligkeitswert wie die
  // Fichtennadel (`#3f5a3f`) gesetzt — gemessener Kontrast 1,00:1 in allen vier
  // Stimmungen. Beschatteter Wald war deshalb nicht nur dunkel, sondern **eine
  // einzige Fläche**: Boden und Krone ließen sich nicht trennen. Nadelstreu ist
  // in Wirklichkeit heller und wärmer als das Kronendach, weil sie das
  // Chlorophyll nicht mehr hat. `npm run licht`
  wald:      '#67754d',
  gebuesch:  '#5a6c4e',
  wiese:     '#73865d',
  acker:     '#918860',
  wasser:    '#33555f',
  siedlung:  '#706b61',
  industrie: '#6d5a53',
  ruine:     '#625d57',
  unbekannt: '#5e6a61',
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
 * Die orientierte Hülle eines Grundrisses.
 *
 * Achse ist die **längste Kante**; ist der Grundriss quer dazu ausgedehnter, wird
 * um 90° gedreht, damit `u` immer die lange Seite ist. Exportiert, weil Dach,
 * Balkon und Garten dieselbe Achse brauchen — zwei Berechnungen davon wären zwei
 * Häuser, die nicht zueinander passen.
 */
export interface Huelle {
  achse: number; cos: number; sin: number;
  minU: number; maxU: number; minV: number; maxV: number;
  /** Punkt im Hüllensystem zurück nach Welt. */
  welt: (u: number, v: number) => [number, number];
}

export function orientierteHuelle(p: readonly [number, number][]): Huelle {
  let achse = 0, laengste = 0;
  for (let k = 0; k < p.length - 1; k++) {
    const dx = p[k + 1][0] - p[k][0], dz = p[k + 1][1] - p[k][1];
    const l = Math.hypot(dx, dz);
    if (l > laengste) { laengste = l; achse = Math.atan2(dz, dx); }
  }
  const messen = (a: number) => {
    const c = Math.cos(a), si = Math.sin(a);
    const us = p.map(([x, z]) => x * c + z * si);
    const vs = p.map(([x, z]) => -x * si + z * c);
    return { c, si, minU: Math.min(...us), maxU: Math.max(...us),
             minV: Math.min(...vs), maxV: Math.max(...vs) };
  };
  let m = messen(achse);
  if (m.maxV - m.minV > m.maxU - m.minU) { achse += Math.PI / 2; m = messen(achse); }
  return {
    achse, cos: m.c, sin: m.si,
    minU: m.minU, maxU: m.maxU, minV: m.minV, maxV: m.maxV,
    welt: (u, v) => [u * m.c - v * m.si, u * m.si + v * m.c],
  };
}

/**
 * Gebäude aus OSM-Grundrissen. Höhe aus `building:levels` (3 m je Ebene), plus
 * einfaches Satteldach — ohne Dach wirkt jede Siedlung wie ein Industriegebiet.
 */
export function baueGebaeude(
  welt: Weltdaten, terrain: Aufsatzboden,
  /**
   * Welche Gebäude gebaut werden. Ohne Angabe alle — die Szene reicht die einer
   * Kachel durch, damit Häuser wie das Gelände nach Entfernung wegfallen. Vorher
   * lagen 214.000 Dreiecke in einem Mesh, das gezeichnet wurde, sobald ein Zipfel
   * der Region im Bild war.
   */
  auswahl: readonly Weltdaten['gebaeude'][number][] = welt.gebaeude,
): THREE.BufferGeometry | null {
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
   * Fünf Rollen: verputzte Wand, Bretterschalung, Dachhaut, Kanten und
   * Zimmermannsholz, fast schwarze Fenster. Es waren vier — `HOLZ` (#3b3229) ist
   * weggefallen, weil es in derselben Rolle wie `TUER` stand und für eine ganze
   * Wandfläche zu dunkel war, siehe `SCHALUNG`.
   */
  const WAND = new THREE.Color('#7d776b');
  /**
   * Bretterschalung des Obergeschosses — **nicht** dasselbe Holz wie Dach und
   * Balkon.
   *
   * Der erste Anlauf nahm dafür `HOLZ`. Nebeneinander gerendert sah das Haus
   * dann verrußt aus: Ein ganzes Geschoss in `#3b3229` liest sich als schwarze
   * Fläche, nicht als Holz, und es stand zu nah am Dachton (`#4a4038`) — Dach
   * und Wand verschmolzen zu einem dunklen Klumpen. Verwitterte Lärchenschalung
   * ist ein warmes Mittelbraun; sie muss heller sein als das Dach, sonst hat das
   * Haus keine Waagerechte mehr.
   */
  const SCHALUNG = new THREE.Color('#90704f');
  const DACH = new THREE.Color('#564a41');
  const FENSTER = new THREE.Color('#11171a');
  /** Sockel: nasser Kalkputz oder Bruchstein, dunkler als die Wand darüber. */
  const SOCKEL = new THREE.Color('#666055');
  /** Gesims und Türblatt: dasselbe Holz wie Dach und Balkon. */
  const TUER = new THREE.Color('#332b22');
  /**
   * Kaminschaft: heller Kalkputz.
   *
   * Bis zum 27.08.2026 stand der Schornstein in `SOCKEL` (#585349), einen Hauch
   * neben dem Dachton (#4a4038). Auf der Dachfläche war er dadurch unsichtbar
   * und nur dort zu erkennen, wo er zufällig gegen den Himmel stand. Ein Kamin
   * ist im Bestand fast immer verputzt und damit das **hellste** Teil des
   * Daches — der Kontrast ist hier kein Effekt, sondern die Wirklichkeit.
   */
  const KAMIN = new THREE.Color('#b0a596');

  /**
   * Kontaktabdunklung je Ecke — das gebackene AO des Hausgenerators (Phase 1).
   *
   * Kein Strahlenwurf: Der Generator **weiss**, wo Kontakt ist. Zwei Baender,
   * beide aus der Stilreferenz abgelesen (G-126): am **Boden** wird jede Wand
   * ueber die unterste Handbreit dunkler — das ist der Schatten, der ein Haus
   * auf dem Gelaende stehen laesst statt darauf zu schweben —, und **unter der
   * Traufe** noch einmal, weil der Ueberstand die Wand beschattet. Beides sind
   * Faktoren auf der Vertexfarbe, also null Laufzeitkosten und ein Draw Call
   * wie bisher. `aoBoden`/`aoTraufe` setzt die Schleife je Gebaeude.
   */
  let aoBoden = -Infinity, aoTraufe = -Infinity;
  const ao = (v: [number, number, number]): number => {
    let f = 1;
    const ueber = v[1] - aoBoden;
    if (ueber < 0.9) f *= 0.68 + 0.32 * Math.max(0, ueber) / 0.9;
    const unter = aoTraufe - v[1];
    if (unter >= -0.02 && unter < 0.75) f *= 0.76 + 0.24 * unter / 0.75;
    return f;
  };

  /** Ein Dreieck mit Farbe. */
  const tri = (
    a: [number, number, number], b: [number, number, number], c: [number, number, number],
    f: THREE.Color,
  ) => {
    positionen.push(...a, ...b, ...c);
    for (const v of [a, b, c]) { const k = ao(v); farben.push(f.r * k, f.g * k, f.b * k); }
  };

  /** Ein Viereck als zwei Dreiecke, gegen den Uhrzeigersinn. */
  const quad = (
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number], f: THREE.Color,
  ) => { tri(a, b, c, f); tri(a, c, d, f); };

  for (const g of auswahl) {
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
    // Vor der ersten Wand setzen — die Wände kommen vor dem Dach.
    aoBoden = boden; aoTraufe = boden + h;
    // Fundament: so weit unter den Sockel, wie das gezeichnete Gelände in der
    // Ferne wegfallen kann. Deckelt bei FUNDAMENT_MAX — ein Haus braucht keinen
    // 15 m tiefen Keller, den ohnehin niemand sieht.
    const fuss = boden - Math.min(FUNDAMENT_MAX, Math.max(0, boden - unterkante));

    /**
     * Orientierte Hülle statt achsparalleler.
     *
     * Bisher folgten die Wände dem Grundriss, Dach und Balkon aber der
     * achsparallelen Bounding Box. Nur 9 % der Grundrisse liegen achsnah, die
     * mittlere Drehung beträgt 27° — die Hülle war im Median **1,9-fach** so groß
     * wie das Haus, im Extremfall 4-fach. Dach und Haus waren buchstäblich zwei
     * verschiedene Körper: Der Deckel stand über, der First zeigte in die falsche
     * Richtung, und an den Ecken klaffte es (G-71).
     */
    const hu = orientierteHuelle(p);
    const { minU, maxU, minV, maxV } = hu;
    /** Punkt im Hüllensystem zurück nach Welt, mit Höhe. */
    const welt3 = (u: number, y: number, v: number): [number, number, number] => {
      const [x, z] = hu.welt(u, v);
      return [x, y, z];
    };

    const breite = maxU - minU, tiefe = maxV - minV;
    const klein = Math.min(breite, tiefe);
    if (klein < 1.5) continue;

    /**
     * Wo die Haustür sitzt: an der längsten Wand, mittig.
     *
     * Kein Zufall und keine Heuristik über den nächsten Weg — die längste Wand ist
     * bei einem Alpenhaus die Traufseite, und dort liegt der Eingang. Eine Garage
     * bekommt statt der Tür ein Tor: 2,6 m breit, weil ein 1,05 m breiter Eingang
     * an einer Garage sofort als Fehler auffällt.
     */
    let tuerWand = 0, tuerLang = 0;
    for (let k = 0; k < p.length - 1; k++) {
      const l = Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);
      if (l > tuerLang) { tuerLang = l; tuerWand = k; }
    }
    const garage = g.art === 'garage' || g.art === 'carport';
    const tuerBreite = garage ? 2.6 : 1.05;
    const tuerHoehe = garage ? 2.3 : 2.1;

    /**
     * Ab welcher Höhe die Wand **Holz** ist.
     *
     * Der oberbayerische Baubestand ist zweiteilig: gemauerter, verputzter Sockel
     * und Wohngeschoss, darüber Bretterschalung und ein hölzerner Giebel. Bis
     * heute war jede Wand von unten bis oben derselbe Putzton — und damit war
     * jedes Haus ein Quader in einer Farbe, egal wie viele Bänder darauf lagen.
     *
     * Das kostet **null zusätzliche Dreiecke**: Die Wand wird ohnehin gezeichnet,
     * sie wird nur an einer Kante geteilt. Von allen Änderungen an dieser Datei
     * ist es die billigste und die sichtbarste (G-104).
     *
     * Nur ab zwei Ebenen und nicht an Garagen — ein Holzobergeschoss auf einem
     * Flachbau ist kein Alpenhaus, sondern ein Fehler.
     */
    const holzAb = g.ebenen >= 2 && !garage
      ? boden + (g.ebenen - 1) * METER_JE_EBENE
      : Infinity;

    // Wände
    for (let k = 0; k < p.length - 1; k++) {
      const [x1, z1] = p[k], [x2, z2] = p[k + 1];
      const oben = boden + h;
      if (holzAb < oben && holzAb > fuss) {
        quad([x1, fuss, z1], [x2, fuss, z2], [x2, holzAb, z2], [x1, holzAb, z1], WAND);
        quad([x1, holzAb, z1], [x2, holzAb, z2], [x2, oben, z2], [x1, oben, z1], SCHALUNG);
      } else {
        quad([x1, fuss, z1], [x2, fuss, z2], [x2, oben, z2], [x1, oben, z1], WAND);
      }

      const wandLaenge = Math.hypot(x2 - x1, z2 - z1);
      if (wandLaenge < 0.5) continue;
      const wx = (z2 - z1) / wandLaenge, wz = -(x2 - x1) / wandLaenge;   // Wandnormale

      /**
       * Sockel und Gesimse — die zwei waagerechten Linien, an denen man ein Haus
       * als Haus liest.
       *
       * Ohne sie ist eine Wand eine Fläche von der Traufe bis zum Boden, und ein
       * zweistöckiges Haus unterscheidet sich von einem einstöckigen nur durch die
       * Zahl der Fensterreihen. 1.820 der 2.033 Gebäude haben zwei Ebenen — die
       * Geschossteilung ist damit das häufigste Merkmal der Region und war das
       * einzige, das gar nicht gezeigt wurde.
       *
       * Beides sind aufgesetzte Bänder wie die Fenster, keine Rücksprünge in der
       * Wand: zwei Dreiecke statt einer Triangulierung mit Aussparung.
       */
      const band = (yUnten: number, hoch: number, vor: number, farbe: THREE.Color) => {
        quad(
          [x1 + wx * vor, yUnten, z1 + wz * vor],
          [x2 + wx * vor, yUnten, z2 + wz * vor],
          [x2 + wx * vor, yUnten + hoch, z2 + wz * vor],
          [x1 + wx * vor, yUnten + hoch, z1 + wz * vor],
          farbe,
        );
      };
      if (wandLaenge >= 2.5) {
        band(boden, 0.34, 0.05, SOCKEL);
        for (let e = 1; e < g.ebenen; e++) band(boden + e * METER_JE_EBENE - 0.07, 0.14, 0.07, DACH);
      }

      // Haustür
      if (k === tuerWand && wandLaenge >= tuerBreite + 0.6) {
        const t = 0.5;
        const cx = x1 + (x2 - x1) * t, cz = z1 + (z2 - z1) * t;
        const ex = (x2 - x1) / wandLaenge * tuerBreite / 2;
        const ez = (z2 - z1) / wandLaenge * tuerBreite / 2;
        const o = 0.06, y0 = boden + 0.02, y1 = boden + Math.min(tuerHoehe, h - 0.3);
        quad(
          [cx - ex + wx * o, y0, cz - ez + wz * o],
          [cx + ex + wx * o, y0, cz + ez + wz * o],
          [cx + ex + wx * o, y1, cz + ez + wz * o],
          [cx - ex + wx * o, y1, cz - ez + wz * o],
          TUER,
        );
        // Türstock: ein schmaler heller Rahmen, damit die Tür nicht als Loch liest.
        const r = 0.09;
        quad(
          [cx - ex - ex * 0.14 + wx * (o - 0.02), y0, cz - ez - ez * 0.14 + wz * (o - 0.02)],
          [cx + ex + ex * 0.14 + wx * (o - 0.02), y0, cz + ez + ez * 0.14 + wz * (o - 0.02)],
          [cx + ex + ex * 0.14 + wx * (o - 0.02), y1 + r, cz + ez + ez * 0.14 + wz * (o - 0.02)],
          [cx - ex - ex * 0.14 + wx * (o - 0.02), y1 + r, cz - ez - ez * 0.14 + wz * (o - 0.02)],
          SOCKEL,
        );
      }

      /**
       * Fenster als aufgesetzte Flächen, nicht als Löcher in der Wand.
       *
       * Ein Loch bräuchte eine Triangulierung mit Aussparung — bei 2.033 Grundrissen
       * die teuerste Art, ein Rechteck dunkel zu färben. Aufgesetzt liegen sie 4 cm
       * vor der Wand; auf jede Entfernung, auf der man Fenster überhaupt sieht, ist
       * der Unterschied unsichtbar. Sie sind der Grund, warum ein Haus als Haus
       * gelesen wird und nicht als Quader.
       */
      const laenge = wandLaenge;
      if (laenge < 2.2) continue;
      const nx = wx, nz = wz;
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
          /**
           * Laibung zuerst, Scheibe darüber.
           *
           * Ohne den hellen Rahmen ist ein Fenster ein schwarzer Fleck auf einer
           * Wand — die Tür hatte ihren Stock seit G-80, die Fenster nicht. Zwei
           * Dreiecke je Fenster, und ein Fenster ist das häufigste Bauteil am
           * ganzen Haus: bei 8 bis 20 Stück kostet es 16 bis 40 Dreiecke und
           * verändert die Wand vollständig.
           */
          const r = 0.11;
          const rx = (x2 - x1) / laenge * (breiteF / 2 + r);
          const rz = (z2 - z1) / laenge * (breiteF / 2 + r);
          quad(
            [cx - rx + nx * (o - 0.015), yUnten - r, cz - rz + nz * (o - 0.015)],
            [cx + rx + nx * (o - 0.015), yUnten - r, cz + rz + nz * (o - 0.015)],
            [cx + rx + nx * (o - 0.015), yUnten + hoeheF + r, cz + rz + nz * (o - 0.015)],
            [cx - rx + nx * (o - 0.015), yUnten + hoeheF + r, cz - rz + nz * (o - 0.015)],
            SOCKEL,
          );
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
    /**
     * Dachneigung nach Spannweite — nicht ein fester Faktor.
     *
     * `klein * 0.42` sind 40° Neigung. Für ein Bauernhaus mit 12 m Spannweite ist
     * das genau richtig; für eine Werkshalle mit 54 m ergibt es **22,7 m First
     * über 6 m Wand** — ein Dach, das dreimal so hoch ist wie das Gebäude
     * darunter. Im Spiel war das ein schwarzer Keil in der Landschaft, und Flo
     * hat am 26.08.2026 genau danach gefragt. Gemessen über die Region: 851 von
     * 2.033 Gebäuden über 5 m First, 151 über 8 m, **30 über 12 m**.
     *
     * Echte Dächer machen es anders herum: Je größer die Spannweite, desto
     * flacher die Neigung. Oberbayerischer Bestand — Bauernhaus 38–45° bei 12–18 m,
     * Werkshalle 8–15° bei 30–60 m. Genau das steht hier: bis 14 m bleibt es bei
     * 0,42 (40°), ab 34 m 0,11 (12°), dazwischen linear. Der Median der Region
     * (4,6 m First bei 11 m Spannweite) ändert sich dadurch nicht.
     */
    const neigungsFaktor = klein <= 14 ? 0.42
      : klein >= 34 ? 0.11
      : 0.42 + (0.11 - 0.42) * (klein - 14) / 20;
    const firstH = traufe + klein * neigungsFaktor;
    const aU0 = minU - ueber, aU1 = maxU + ueber;
    const aV0 = minV - ueber, aV1 = maxV + ueber;
    const mv = (minV + maxV) / 2;

    /**
     * Das Dach ist ein **Körper**, keine Fläche.
     *
     * Bis heute waren es zwei Vierecke ohne Dicke: An der Traufe endete das Haus
     * an einer Papierkante, von unten sah man auf die Rückseite eines Dreiecks,
     * und der Ortgang — die Schrägkante über dem Giebel, an der man ein Alpendach
     * von jedem anderen unterscheidet — existierte nicht. Sechs Dreiecke für die
     * Oberseite, sechs für die Untersicht, acht für die Kanten: **20 Dreiecke**,
     * und das Dach hört auf, ein Deckel zu sein.
     *
     * `dick` steht senkrecht, nicht rechtwinklig zur Dachfläche. Der Unterschied
     * ist bei 30° Neigung 4 cm und niemandem sichtbar; rechtwinklig gerechnet
     * bräuchte es die Dachnormale an vier Stellen.
     */
    const dick = 0.22;
    const dachHaut = (versatz: number, farbe: THREE.Color) => {
      quad(welt3(aU0, traufe + versatz, aV0), welt3(aU1, traufe + versatz, aV0),
           welt3(aU1, firstH + versatz, mv), welt3(aU0, firstH + versatz, mv), farbe);
      quad(welt3(aU1, traufe + versatz, aV1), welt3(aU0, traufe + versatz, aV1),
           welt3(aU0, firstH + versatz, mv), welt3(aU1, firstH + versatz, mv), farbe);
    };
    // First läuft über u, die lange Achse. Die Fallunterscheidung von früher ist
    // weg — die Drehung erledigt, was vorher zwei Zweige tun mussten.
    dachHaut(dick, DACH);
    // Untersicht: dieselbe Fläche tiefer, dunkler. Wer unter dem Überstand steht,
    // sieht sonst durch das Dach hindurch.
    dachHaut(0, TUER);
    // Traufkanten — die beiden waagerechten Stirnflächen.
    quad(welt3(aU0, traufe, aV0), welt3(aU1, traufe, aV0),
         welt3(aU1, traufe + dick, aV0), welt3(aU0, traufe + dick, aV0), TUER);
    quad(welt3(aU1, traufe, aV1), welt3(aU0, traufe, aV1),
         welt3(aU0, traufe + dick, aV1), welt3(aU1, traufe + dick, aV1), TUER);
    // Ortgang — die vier schrägen Kanten über den Giebeln.
    for (const u of [aU0, aU1]) {
      for (const v of [aV0, aV1]) {
        quad(welt3(u, traufe, v), welt3(u, traufe + dick, v),
             welt3(u, firstH + dick, mv), welt3(u, firstH, mv), TUER);
      }
    }
    /**
     * Giebelfelder — **je Grundrisskante eine**, nicht zwei feste an den Enden.
     *
     * ## Das Loch, das hier war
     *
     * Bis zum 26.08.2026 standen hier genau zwei Dreiecke, an `minU` und `maxU`.
     * Das stimmt für ein Rechteck und für nichts sonst. Die Wände enden alle auf
     * **Traufhöhe**; das Dach steigt von der Traufe zum First. Jede Kante, die
     * weder auf einer Traufseite noch an einem Hüllenende liegt — also jede Kante
     * eines L-, T- oder Winkelgrundrisses —, endete damit unter einem Dach, das
     * dort schon höher war. Dazwischen war **nichts**. Von aussen sah man in den
     * Dachraum, von innen durch das Haus. Bei 2.033 Gebäuden mit im Mittel mehr
     * als vier Ecken ist das keine Ausnahme, sondern der Normalfall.
     *
     * ## Was jetzt passiert
     *
     * Über **jeder** Kante des Grundrisses steht ein Feld von der Traufe bis zur
     * Dachunterseite an genau dieser Stelle. `dachY(v)` ist die Umkehrung
     * derselben Formel, aus der `dachHaut` die Fläche baut — beide können also
     * nicht auseinanderlaufen. An den Traufseiten wird das Feld von selbst
     * flach (dort ist `dachY` gleich der Traufe) und kostet nichts; an den
     * Hüllenenden ergibt es das Giebeldreieck, das vorher von Hand dastand.
     *
     * Kosten: zwei Dreiecke je Kante statt zwei je Haus. Bei sechs Ecken sind das
     * 12 statt 2 — gegen 222 Dreiecke im Median (D84) ein Zuschlag von 4 %.
     */
    const dachY = (v: number) => {
      const halb = mv - aV0;
      if (halb <= 0) return traufe;
      return firstH - (firstH - traufe) * Math.min(1, Math.abs(v - mv) / halb);
    };
    // Holz, wenn das Haus ein Holzobergeschoss trägt: Der Giebel ist im Bestand
    // fast immer verschalt, auch wenn das Geschoss darunter verputzt ist.
    const giebel = Number.isFinite(holzAb) ? SCHALUNG : WAND;
    for (let k = 0; k < p.length - 1; k++) {
      // `p` liegt bereits in Weltmetern — es wird oben einmal aus lat/lon gerechnet.
      const [ax, az] = p[k];
      const [bx, bz] = p[k + 1];
      // In Hüllenkoordinaten, weil nur `v` über die Dachhöhe entscheidet.
      const vA = -ax * hu.sin + az * hu.cos;
      const vB = -bx * hu.sin + bz * hu.cos;
      const yA = dachY(vA), yB = dachY(vB);
      if (yA - traufe < 0.02 && yB - traufe < 0.02) continue;   // liegt an der Traufe
      quad([ax, traufe, az], [bx, traufe, bz], [bx, yB, bz], [ax, yA, az], giebel);
    }

    /**
     * Schornstein — ein Körper mit Kopf, kein Pfosten.
     *
     * Ein Dach ohne Schornstein liest sich als Modell, eines mit als Haus. Er
     * steht auf einem Drittel der Firstlänge, leicht neben dem First — mittig
     * auf dem First sähe er nach Symmetrieübung aus.
     *
     * ## Was am 27.08.2026 daran falsch war
     *
     * Drei Sachen, und keine davon war die Höhe:
     *
     * 1. **Fester Querschnitt.** 0,84 x 0,84 m auf jedem Haus. Gemessen über
     *    1.805 Gebäude: Schlankheit h/b im Median 1,67, an der Halle mit 21,6 m
     *    Spannweite 2,13. Das ist für sich genommen keine Stange — aber neben
     *    einem 22 m breiten Dach ist ein 84-cm-Klotz ein Streichholz, und neben
     *    einem 6-m-Schuppen ein Turm. Echte Kamine wachsen mit dem Haus.
     * 2. **Kein Kopf.** Ein Kamin ohne überstehende Abdeckplatte ist eine
     *    Säule. Die Platte ist das eine Bauteil, an dem man ihn auf 60 m noch
     *    als Kamin liest — sie bricht die senkrechte Silhouette.
     * 3. **Farbe fast wie das Dach.** `SOCKEL` (#585349) neben `DACH` (#4a4038):
     *    Der Schornstein verschwand in der Dachfläche und war nur dort zu
     *    sehen, wo er gegen den Himmel stand. Verputzte Kamine sind hell.
     *
     * ## Und ein echtes Loch
     *
     * Der Fuß hing an `klein / 2`, die Dachfläche seit D94 an
     * `tiefe / 2 + ueber`. Seit die Neigung von der Spannweite abhängt, laufen
     * die beiden auseinander: Bei **405 von 1.805 Gebäuden** stand der Fuß bis
     * zu 9 cm **über** der Dachunterseite, und unter dem Schornstein war ein
     * Schlitz ins Dach. Der Fuß kommt jetzt aus `dachY` selbst — derselben
     * Funktion, aus der die Haut gebaut wird —, genommen an der firstfernen
     * Kante des Querschnitts, also der tiefsten Stelle unter dem Kamin.
     *
     * Kosten: 18 statt 10 Dreiecke, bei 222 im Median (D84) ein Zuschlag von
     * 3,6 %.
     *
     * Nicht an Garagen und nicht an Bauten unter 4 m Breite: Ein Schornstein auf
     * einem Carport ist schlimmer als keiner.
     */
    if (!garage && klein >= 4 && breite >= 5) {
      // Querschnitt nach Spannweite: 0,60 m am Schuppen, 1,10 m an der Halle.
      // Oberbayerischer Bestand liegt zwischen 0,5 und 1,1 m.
      const sb = Math.min(0.55, Math.max(0.30, klein * 0.035));
      const su = minU + breite * 0.32;
      // Abstand vom First: ein Zehntel der Spannweite, aber nie so wenig, dass
      // der Querschnitt über den First greift.
      const sv = mv - Math.max(sb + 0.25, klein * 0.10);
      // Fuß aus derselben Formel wie die Dachhaut, an der firstfernen Kante.
      const fussY = dachY(sv - sb) - 0.15;
      // Kopf: über den First, und der Überstand wächst mit dem Haus mit.
      const kopfY = firstH + 0.55 + Math.min(0.9, klein * 0.030);
      const schaft: [number, number][] = [
        [su - sb, sv - sb], [su + sb, sv - sb], [su + sb, sv + sb], [su - sb, sv + sb],
      ];
      for (let i = 0; i < 4; i++) {
        const [u1, v1] = schaft[i], [u2, v2] = schaft[(i + 1) % 4];
        quad(welt3(u1, fussY, v1), welt3(u2, fussY, v2),
             welt3(u2, kopfY, v2), welt3(u1, kopfY, v1), KAMIN);
      }
      // Abdeckplatte: 11 cm Überstand, 12 cm dick, dunkel gegen den hellen
      // Schaft. Vier Stirnflächen und ein Deckel.
      const kb = sb + 0.11, deckelY = kopfY + 0.12;
      const platte: [number, number][] = [
        [su - kb, sv - kb], [su + kb, sv - kb], [su + kb, sv + kb], [su - kb, sv + kb],
      ];
      for (let i = 0; i < 4; i++) {
        const [u1, v1] = platte[i], [u2, v2] = platte[(i + 1) % 4];
        quad(welt3(u1, kopfY, v1), welt3(u2, kopfY, v2),
             welt3(u2, deckelY, v2), welt3(u1, deckelY, v1), TUER);
      }
      quad(welt3(platte[0][0], deckelY, platte[0][1]), welt3(platte[1][0], deckelY, platte[1][1]),
           welt3(platte[2][0], deckelY, platte[2][1]), welt3(platte[3][0], deckelY, platte[3][1]), TUER);
    }

    /**
     * Balkon unter der Traufe — an einer **echten Wand**, nicht an der Hülle.
     *
     * Nur für Häuser ab zwei Ebenen und ab 6 m Länge; ein Balkon an einer Garage
     * wäre komischer als gar keiner.
     *
     * Ein oberbayerischer Balkon ist ein **Brettbalkon**: senkrechte Bretter mit
     * Lücke, oben ein vorstehender Handlauf, unten eine Fußleiste. Diese drei
     * Teile machen ihn von weitem erkennbar (D84).
     *
     * ## Drei Fehler, die am 26.08.2026 herausgekommen sind
     *
     * Alle drei fielen erst auf, als echte Grundrisse gerendert wurden statt eines
     * Rechtecks — und alle drei sind derselbe Denkfehler: mit der **Hülle**
     * gerechnet, wo die **Wand** gemeint war.
     *
     * **1. Der Balkon spannte von `minU` bis `maxU` bei `v = maxV`.** Das ist die
     * Kante der orientierten Hülle, nicht eine Wand. Bei jedem Grundriss, der kein
     * Rechteck ist, hing er über weite Strecken **frei in der Luft**, ohne Haus
     * dahinter. Jetzt wird die Wand gesucht, an die er gehört: die längste Kante,
     * die annähernd längs der Firstachse läuft und deren Aussenseite nach +V zeigt
     * — geprüft mit einem Punkt 0,4 m davor gegen den Grundriss, nicht geraten.
     *
     * **2. Die Stützen waren 2,2 m lang.** Eine feste Länge, unabhängig davon, wo
     * der Boden liegt: An einem Haus mit drei Ebenen endeten sie 4 m über dem
     * Gelände und hingen als Striche in der Luft. Jetzt gehen sie bis `boden`.
     *
     * **3. Er war tiefer als der Dachüberstand.** Der Überstand ist
     * `min(1.4, klein * 0.16)`, an einem 7-m-Haus also 1,12 m; der Balkon maß
     * 1,1 m plus 0,06 m Handlauf. Er stand damit im Regen, obwohl der Kommentar
     * über dem Dach ausdrücklich sagt, der Überstand sei dafür da, den Schnee vom
     * Balkon zu halten. Jetzt wird die Tiefe auf den Überstand begrenzt, und wo
     * weniger als 0,5 m bleiben, gibt es keinen Balkon.
     */
    if (g.ebenen >= 2 && Math.max(breite, tiefe) >= 6) {
      /** Liegt der Punkt im Grundriss? Der Ring ist geschlossen (letzter = erster). */
      const imGrundriss = (x: number, z: number) => {
        let drin = false;
        for (let i = 0, j = p.length - 2; i < p.length - 1; j = i++) {
          const [xi, zi] = p[i], [xj, zj] = p[j];
          if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) drin = !drin;
        }
        return drin;
      };

      let bU0 = 0, bU1 = 0, bV = 0, beste = 0;
      for (let k = 0; k < p.length - 1; k++) {
        const [ax, az] = p[k], [bx, bz] = p[k + 1];
        const uA = ax * hu.cos + az * hu.sin, vA = -ax * hu.sin + az * hu.cos;
        const uB = bx * hu.cos + bz * hu.sin, vB = -bx * hu.sin + bz * hu.cos;
        const laenge = Math.abs(uB - uA);
        // Nur Kanten, die annähernd längs der Firstachse laufen — an einer
        // Giebelwand hängt kein Brettbalkon.
        if (laenge < 6 || Math.abs(vB - vA) > laenge * 0.3) continue;
        // Zeigt +V hier nach aussen? Ein Punkt 0,4 m davor darf nicht im Haus liegen.
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        if (imGrundriss(mx - 0.4 * hu.sin, mz + 0.4 * hu.cos)) continue;
        if (laenge <= beste) continue;
        beste = laenge;
        bU0 = Math.min(uA, uB) + 0.3; bU1 = Math.max(uA, uB) - 0.3;
        bV = (vA + vB) / 2;
      }

      const platz = maxV + ueber - 0.15 - bV;
      const tiefeB = Math.min(1.1, platz);
      if (beste > 0 && tiefeB >= 0.5) {
        const y = boden + (g.ebenen - 1) * METER_JE_EBENE + 0.6;
        const bruest = 0.95;
        const v0 = bV, v1 = bV + tiefeB;
        // Boden
        quad(welt3(bU0, y, v0), welt3(bU1, y, v0),
             welt3(bU1, y, v1), welt3(bU0, y, v1), SCHALUNG);
        // Fußleiste und Handlauf — die zwei Waagerechten.
        quad(welt3(bU0, y + 0.04, v1), welt3(bU1, y + 0.04, v1),
             welt3(bU1, y + 0.22, v1), welt3(bU0, y + 0.22, v1), SCHALUNG);
        quad(welt3(bU0, y + bruest - 0.13, v1 + 0.06), welt3(bU1, y + bruest - 0.13, v1 + 0.06),
             welt3(bU1, y + bruest, v1 + 0.06), welt3(bU0, y + bruest, v1 + 0.06), TUER);
        // Bretter dazwischen. Alle 0,42 m, gedeckelt bei 16: An einem 14-m-Haus
        // wären es sonst 33, und ab etwa 20 sieht man den Unterschied nicht mehr.
        const bretter = Math.min(16, Math.max(3, Math.round((bU1 - bU0) / 0.42)));
        const bb = (bU1 - bU0) / bretter * 0.55;
        for (let i = 0; i < bretter; i++) {
          const cu = bU0 + (bU1 - bU0) * (i + 0.5) / bretter;
          quad(welt3(cu - bb / 2, y + 0.2, v1 + 0.01), welt3(cu + bb / 2, y + 0.2, v1 + 0.01),
               welt3(cu + bb / 2, y + bruest - 0.12, v1 + 0.01),
               welt3(cu - bb / 2, y + bruest - 0.12, v1 + 0.01), SCHALUNG);
        }
        // Zwei Stützen bis zum Boden — ohne sie schwebt der Balkon, mit fester
        // Länge hängen sie in der Luft.
        for (const u of [bU0 + 0.35, bU1 - 0.35]) {
          quad(welt3(u - 0.07, boden, v1 - 0.12), welt3(u + 0.07, boden, v1 - 0.12),
               welt3(u + 0.07, y, v1 - 0.12), welt3(u - 0.07, y, v1 - 0.12), TUER);
        }
      }
    }
  }

  if (!positionen.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  geo.computeVertexNormals();
  return geo;
}
