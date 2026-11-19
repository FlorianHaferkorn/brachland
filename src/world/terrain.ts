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
import { imPolygon } from './osm.js';
import { PALETTE } from './palette.js';
import { BAUWELT_AN, LOD2_AN, FENSTERTIEFE_AN, HAUSFRONT_AN, HOF_LAUBEN_AN, HOF_BODEN_AN, HOF_VERFALL_AN, HOF_RANKE_AN, HOF_RUINE_AN, HOF_EINSTURZ_AN, HOF_ZIEL_AN, HOF_DACHBRUCH_AN, HOF_ZIELTREUE_AN, HOF_VERFALLVERLAUF_AN, HOF_ORTSALTERUNG_AN } from './echt.js';
import type { HausReferenz, HausQuad } from './hausbauteil.js';
import { baueHofsockel } from './hofsockel.js';
import { baueHoftrittplatten } from './hoftrittplatten.js';
import { baueHausbewuchs, baueRankenkurve } from './hausbewuchs.js';
import type { BlattKoordinaten, Rankenpunkt } from './hausbewuchs.js';
import { baueDachschindeln, baueSchalungsriss, baueTruemmerkeil, bruchKantenabtrag } from './hoftruemmer.js';
import { baueRuinenschutt } from './ruinenschutt.js';
import { baueBruchholz } from './bruchholz.js';
import { baueLaubenkasten } from './laubenkasten.js';
import { fassadenKasten, vereinfacheHauswand } from './hausbauteil.js';
import { gesperrt } from './bauwerke.js';
import { bestimmeBaualterung, packeBaualterung } from './baualterung.js';

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

/** Biomfarben — die Werte stehen in `palette.ts`, mit ihren Gründen. */
export const BIOM_FARBE: Record<Biom, THREE.ColorRepresentation> = PALETTE.biom;

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

export function orientierteHuelle(p: readonly [number, number][], achseVorgabe?: number): Huelle {
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
  // D290: Firstrichtung aus LoD2 vorgegeben — u liegt dann entlang des echten Firsts, auch quer zur langen Seite.
  if (achseVorgabe !== undefined) achse = achseVorgabe;
  let m = messen(achse);
  if (achseVorgabe === undefined && m.maxV - m.minV > m.maxU - m.minU) { achse += Math.PI / 2; m = messen(achse); }
  return {
    achse, cos: m.c, sin: m.si,
    minU: m.minU, maxU: m.maxU, minV: m.minV, maxV: m.maxV,
    welt: (u, v) => [u * m.c - v * m.si, u * m.si + v * m.c],
  };
}

/** OSM-`building`-Werte, die kein Wohnhaus sind — und deshalb keine Läden, Geranien, Vordächer bekommen. */
const NUTZBAU = new Set([
  'industrial', 'warehouse', 'commercial', 'retail', 'barn', 'farm_auxiliary', 'shed', 'hut',
  'roof', 'service', 'greenhouse', 'garages', 'garage', 'carport', 'silo', 'transformer_tower',
]);

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
  /**
   * D289 Verfallsstufen (Bauwelt D287): bewohnte Orte in Weltmetern (Dorf, Höfe, Zufluchten aus `content/orte`).
   * Im Umkreis von 150 m Stufe 0 (bewohnt, geflickt, Vorhänge, Licht), sonst 1 (verlassen) oder 2 (verfallen).
   */
  bewohnt: readonly (readonly [number, number])[] = [],
  referenz?: HausReferenz | readonly HausReferenz[],
): THREE.BufferGeometry | null {
  const [sued, west, nord, ost] = welt.bbox;
  const positionen: number[] = [];
  const farben: number[] = [];
  /**
   * Glut je Ecke (D134): 1 an einer Fensterscheibe, hinter der Licht brennt,
   * sonst 0. Das Hausmaterial hebt solche Ecken je Stimmung als Emissiv an —
   * nachts brennen Fenster, ohne dass eine zweite Geometrie oder ein zweiter
   * Draw Call entsteht. Welche Scheibe brennt, entscheidet ein Hash aus ihrer
   * Lage, nicht der Hauswuerfel: Der wuerde jede Bretterfarbe danach verschieben.
   */
  const glut: number[] = [];
  const rollen: number[] = [];
  const raumUv: number[] = [];
  let raumFenster: { x: number; z: number; dx: number; dz: number; unten: number; breite: number; hoehe: number; seed: number } | null = null;
  /** Verfallsstufe (0–2), Zielhaus (4), Ortsalterung (ab 8) und Höhe über dem lokalen Boden. */
  const zustand: number[] = [];
  let stufeJetzt = 0;
  let alterungJetzt = 0;
  let zielHausJetzt = false;
  let glutWert = 0;
  const glutHash = (x: number, y: number, z: number) => {
    const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return v - Math.floor(v);
  };
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
  const WAND = new THREE.Color(PALETTE.haus.wand);
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
  const SCHALUNG = new THREE.Color(PALETTE.haus.schalung);
  const DACH = new THREE.Color(PALETTE.haus.dach);
  const FENSTER = new THREE.Color(PALETTE.haus.fenster);
  /** Sockel: nasser Kalkputz oder Bruchstein, dunkler als die Wand darüber. */
  const SOCKEL = new THREE.Color(PALETTE.haus.sockel);
  /** Gesims und Türblatt: dasselbe Holz wie Dach und Balkon. */
  const TUER = new THREE.Color(PALETTE.haus.tuer);
  /**
   * Kaminschaft: heller Kalkputz.
   *
   * Bis zum 27.08.2026 stand der Schornstein in `SOCKEL` (#585349), einen Hauch
   * neben dem Dachton (#4a4038). Auf der Dachfläche war er dadurch unsichtbar
   * und nur dort zu erkennen, wo er zufällig gegen den Himmel stand. Ein Kamin
   * ist im Bestand fast immer verputzt und damit das **hellste** Teil des
   * Daches — der Kontrast ist hier kein Effekt, sondern die Wirklichkeit.
   */
  const KAMIN = new THREE.Color(PALETTE.haus.kamin);
  /**
   * Phase 2 (D119): Fensterläden, helle Rahmen und Bänke, Geranien mit
   * Kasten, Sparren- und Pfettenköpfe, Rinne, Brennholz. Alles aus der
   * Palette, keine Farbe entsteht hier — nur **Töne** derselben Farbe, für
   * Bretter und Dachreihen, als Faktor auf der Palettenfarbe.
   */
  const LADEN = new THREE.Color(PALETTE.haus.laden);
  const RAHMEN = new THREE.Color(PALETTE.haus.rahmen);
  const WANDRANKE = {
    blaetter: ['#354727', '#435632', '#4f6034', '#5c6e3e', '#667548'].map(ton => new THREE.Color(ton)),
    trieb: new THREE.Color('#554633'),
  };
  const GERANIE = new THREE.Color(PALETTE.haus.geranie);
  const KASTEN = new THREE.Color(PALETTE.haus.kasten);
  const BRENNHOLZ = new THREE.Color(PALETTE.haus.holz);
  const SPARREN = new THREE.Color(PALETTE.haus.sparren);
  const RINNE = new THREE.Color(PALETTE.haus.rinne);
  /**
   * Fünf Töne der Schalung, ±16 %. Ein Brett neben einem gleichfarbigen Brett
   * ist keins — erst der Tonwechsel macht aus der Fläche eine Schalung. Die
   * Spanne ist aus der Stilreferenz abgelesen: Dort liegen benachbarte
   * Bretter etwa 10–20 % auseinander, nie mehr, sonst liest es sich als
   * Streifenmuster.
   */
  const SCHALUNG_TOENE = [0.84, 0.92, 1, 1.08, 1.16].map(f => SCHALUNG.clone().multiplyScalar(f));
  const BRENNHOLZ_TOENE = [0.5, 0.72, 1].map(f => BRENNHOLZ.clone().multiplyScalar(f));
  /** Laub der Geranien zwischen den Blüten: Buschgrün der Attrappen, kein eigener Ton. */
  const LAUB = new THREE.Color(PALETTE.attrappe.busch);
  /** Ziegelreihen und First: dieselbe Dachfarbe, eine Kante heller. */
  const DACH_KANTE = DACH.clone().multiplyScalar(1.3);
  /** D289: Vorhang hinter der Scheibe — gebrochenes Leinen, dunkler als der Rahmen, damit er hinter Glas liegt. */
  const VORHANG = RAHMEN.clone().multiplyScalar(0.72);
  /**
   * D284: Materialrolle je Farbe für die Hausscans (`hausmaterial.ts`): 0 Putz, 1 Schalung, 2 Dach, 3 Sockel,
   * 4 = keine (Läden, Geranien … bleiben glatt), 5 = Glas (D285: spiegelt den Himmel statt schwarzem Loch). Zuordnung über die Farbobjekte selbst — alle Farben
   * des Generators stehen oben als Konstanten, Varianten (Schalungstöne, Dachkante) sind deren Klone.
   */
  const ROLLE = new Map<THREE.Color, number>([
    [WAND, 0], [KAMIN, 0], [SCHALUNG, 1], ...SCHALUNG_TOENE.map(c => [c, 1] as [THREE.Color, number]),
    [DACH, 2], [DACH_KANTE, 2], [SOCKEL, 3], [FENSTER, 5],
  ]);

  const REFERENZ_HOLZ = TUER.clone();
  ROLLE.set(REFERENZ_HOLZ, 1);
  const RUINEN_INNEN = TUER.clone().multiplyScalar(.42);
  const ALTE_SCHINDEL = new THREE.Color('#5c5850');
  ROLLE.set(ALTE_SCHINDEL, 2);
  const SCHINDELTOENE = HOF_ZIELTREUE_AN
    ? ['#695d51','#71675b','#766f62','#625c53','#81776b'].map(ton => new THREE.Color(ton)) : [];
  for (const ton of SCHINDELTOENE) ROLLE.set(ton, 2);
  const ALTES_BLECH = new THREE.Color('#51463c');

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
  let lokalerBodenkontakt = false;
  const kontaktBoden = (v: readonly number[]) => lokalerBodenkontakt ? terrain.hoeheAn(v[0], v[2]) : aoBoden;
  const ao = (v: [number, number, number]): number => {
    let f = 1;
    const ueber = v[1] - kontaktBoden(v);
    if (ueber < 0.9) f *= 0.68 + 0.32 * Math.max(0, ueber) / 0.9;
    const unter = aoTraufe - v[1];
    if (unter >= -0.02 && unter < 0.75) f *= 0.76 + 0.24 * unter / 0.75;
    return f;
  };

  /** Ein Dreieck mit Farbe. */
  const tri = (
    a: [number, number, number], b: [number, number, number], c: [number, number, number],
    f: THREE.Color, blatt?: BlattKoordinaten,
  ) => {
    positionen.push(...a, ...b, ...c);
    const toenung = zielHausJetzt ? (f === RAHMEN ? .69 : f === LADEN ? .80 : 1) : 1;
    for (const v of [a, b, c]) { const k = ao(v) * toenung; farben.push(f.r * k, f.g * k, f.b * k); }
    glut.push(glutWert, glutWert, glutWert);
    const r = blatt ? 7 : zielHausJetzt && (f === RAHMEN || f === LADEN) ? 6
      : zielHausJetzt && f === SPARREN ? 1 : ROLLE.get(f) ?? 4;
    rollen.push(r, r, r);
    // Blätter teilen den vorhandenen UV-Kanal mit den Raumkoordinaten der Fenster.
    if (blatt) for (const [u,v] of blatt) raumUv.push(u, v, 0);
    else if (HAUSFRONT_AN) for (const v of [a, b, c]) {
      if (f === FENSTER && raumFenster) {
        const q = raumFenster;
        raumUv.push(((v[0]-q.x)*q.dx+(v[2]-q.z)*q.dz)/q.breite+0.5, (v[1]-q.unten)/q.hoehe, q.seed);
      } else raumUv.push(0, 0, 0);
    }
    for (const v of [a, b, c]) zustand.push(alterungJetzt + stufeJetzt + (zielHausJetzt ? 4 : 0), v[1] - kontaktBoden(v));
  };

  /**
   * Ein Viereck als zwei Dreiecke. Die Punkte stehen **im Uhrzeigersinn, von
   * aussen gesehen** — so sind alle Aufrufe in diesem Generator geschrieben.
   *
   * ## Warum das hier ausdrücklich steht (G-128)
   *
   * Bis zum 07.09.2026 hiess der Kommentar „gegen den Uhrzeigersinn", und
   * `quad` hat die Punkte in dieser Reihenfolge an `tri` gereicht. Gemessen an
   * 291 Gebäuden: **70 % der Wanddreiecke zeigten mit der Normale ins Haus,
   * 100 % der Dachflächen nach unten.** Das Hausmaterial ist einseitig
   * (`FrontSide`), also wurden genau die Flächen weggeschnitten, die man sehen
   * soll — man sah die Innenseite der Rückwände, und Fenster, Sockel und Tür
   * lagen dahinter. Aufgefallen ist es nie, weil `flatShading` die Normale aus
   * den Bildschirmableitungen nimmt: Eine Innenseite ist genauso beleuchtet
   * wie eine Aussenseite, nur steht sie am falschen Ort.
   *
   * Die Reihenfolge wird deshalb hier gedreht, an einer Stelle, und der
   * Umlaufsinn des Grundrisses wird oben je Gebäude vereinheitlicht. Teile,
   * deren Richtung nicht aus dem Grundriss folgt (Dachuntersicht, Ortgang,
   * Balkon, alle Anbauten aus Phase 2), gehen über `quadNach`, das die Seite
   * aus einer Richtung bestimmt statt aus einer Konvention.
   */
  const quad = (
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number], f: THREE.Color,
  ) => { tri(a, c, b, f); tri(a, d, c, f); };

  /**
   * Ein Viereck, das seine sichtbare Seite nach `aussen` richtet — die
   * Punktreihenfolge ist egal, nur die Fläche zählt. Für alles, was nicht
   * an einer Grundrisskante hängt.
   */
  const quadNach = (
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number], f: THREE.Color,
    aussen: readonly [number, number, number],
  ) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const s = (uy * vz - uz * vy) * aussen[0] + (uz * vx - ux * vz) * aussen[1] + (ux * vy - uy * vx) * aussen[2];
    if (s > 0) { tri(a, b, c, f); tri(a, c, d, f); } else { tri(a, c, b, f); tri(a, d, c, f); }
  };

  /**
   * Ein deterministischer Würfel je Gebäude, gesät aus seiner ersten Ecke.
   *
   * Kein `Math.random`: Eine Kachel wird beim Näherkommen neu gebaut und muss
   * dann genauso aussehen wie beim letzten Mal — sonst wechseln die Bretter
   * eines Hauses den Ton, während man davorsteht.
   */
  const wuerfelAus = (x: number, z: number) => {
    let s = (Math.imul(Math.round(x * 10), 0x9e3779b1) ^ Math.imul(Math.round(z * 10), 0x85ebca77)) >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const referenzen: readonly HausReferenz[] = !referenz ? [] : Array.isArray(referenz) ? referenz : [referenz as HausReferenz];
  for (const g of auswahl) {
    /** D291: erste Ecke dieses Hauses — für die Umfärbung nach dem Fassaden-Steckbrief am Ende. */
    const ersteEcke = farben.length / 3;
    let p = g.punkte.map(([lat, lon]) => zuWelt(lat, lon));
    const hProbe = referenzen.length && p.length >= 4 ? orientierteHuelle(p) : null;
    const mitteProbe = hProbe?.welt((hProbe.minU+hProbe.maxU)/2,(hProbe.minV+hProbe.maxV)/2);
    const hausReferenz = mitteProbe ? referenzen.find(r => Math.hypot(mitteProbe[0]-r.mitte[0],mitteProbe[1]-r.mitte[1]) < 0.1) : undefined;
    const referenzHaus = !!hausReferenz;
    lokalerBodenkontakt = referenzHaus && HOF_BODEN_AN;
    const laubenDetails = referenzHaus && HOF_LAUBEN_AN;
    if (referenzHaus) p = vereinfacheHauswand(p);
    if (p.length < 3) continue;
    // Freihaltung eines Bauwerks (ADR-0006, D155): Die Blender-Szene blendet OSM-Haeuser im Nahbereich
    // aus (`loch_im_fernen`); die Engine muss dasselbe Loch lassen, sonst steht ein Hof vor dem Steg.
    if (gesperrt(p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length, 'haeuser')) continue;
    /**
     * Umlaufsinn vereinheitlichen (G-128). OSM schreibt Grundrisse in beiden
     * Richtungen (1.545 gegen 488 in der Region); die Wandnormale `wx, wz`
     * unten und damit die Seite, auf der Fenster, Tür und Bänder liegen,
     * folgt aber dem Umlauf. Nach dem Drehen zeigt sie überall nach aussen.
     */
    let umlauf = 0;
    for (let k = 0; k < p.length - 1; k++) umlauf += p[k][0] * p[k + 1][1] - p[k + 1][0] * p[k][1];
    if (umlauf < 0) p.reverse();
    const wuerfel = wuerfelAus(p[0][0], p[0][1]);
    /**
     * D290: Mit LoD2 kommen Traufhöhe, Firsthöhe, Dachform und Firstrichtung aus den amtlichen 3D-Gebäudemodellen
     * (echte Silhouette); die Geschosszahl folgt aus der Traufe (≈ 2,9 m je Geschoss). Ohne LoD2 wie bisher aus OSM.
     */
    const echt2 = LOD2_AN && g.lod2 ? g.lod2 : null;
    const ebenen = echt2 ? Math.max(1, Math.min(4, Math.round(echt2.t / 2.9))) : g.ebenen;
    const h = echt2 ? Math.max(2.2, echt2.t) / MASSSTAB.stauchung : (ebenen * METER_JE_EBENE) / MASSSTAB.stauchung;
    /** Geschosshöhe: mit LoD2 die echte Traufe gleichmässig geteilt, sonst 3 m. */
    const geschoss = echt2 ? h / ebenen : METER_JE_EBENE;

    /**
     * Sockel auf den tiefsten Punkt der **Wandlinie**, nicht der Ecken.
     *
     * Der Unterschied ist keine Feinheit: Bei 301 von 2.009 Häusern liegt das
     * Gelände zwischen zwei Ecken tiefer als an beiden Ecken, im Extrem 2,23 m
     * (`npm run aufsatz`). Genau dort steht die Wand auf nichts, und man sieht
     * unter dem Haus hindurch. Abgetastet wird alle 1,5 m — feiner als das
     * Mikrorelief Wellen schlägt.
     */
    let boden = Infinity, unterkante = Infinity, bergseits = -Infinity;
    for (let k = 0; k < p.length - 1; k++) {
      const [ax, az] = p[k], [bx, bz] = p[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
      for (let i = 0; i <= n; i++) {
        const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
        boden = Math.min(boden, terrain.hoeheAn(x, z));
        unterkante = Math.min(unterkante, terrain.tiefsteFlaeche(x, z));
        bergseits = Math.max(bergseits, terrain.tiefsteFlaeche(x, z));
      }
    }
    if (!Number.isFinite(boden)) continue;
    /**
     * **Ein Haus am Steilhang wird angehoben, bis die Traufe den Berg erreicht** (D162).
     *
     * Der Sockel sitzt auf dem **tiefsten** Punkt der Wandlinie. Das ist auf
     * ebenem Grund richtig und am Steilhang zu wenig: Steigt das Gelände über
     * die Grundrisslänge stärker als das Haus hoch ist, verschwindet es im Berg.
     * Gemessen über die Region ist das ein einziger Fall — ein 9 × 9 m grosses
     * Haus auf 75 % Neigung bei 1841,676, dessen First 1,12 m statt der
     * geforderten 1,5 m über dem bergseitigen Gelände stand. Ein Fall ist kein
     * Grund für eine Ausnahme, aber einer für eine Regel: Die Traufe erreicht
     * bergseits mindestens das Gelände, das Dach steht dann von selbst darüber.
     *
     * Talseitig trägt das eine Stützmauer — `fuss` bekommt die Hebung dazu,
     * sonst schwebt das Haus auf der Talseite genau um diesen Betrag (und W1b
     * meldete es sofort). Im Bestand ist das nichts Erfundenes: Ein Hanghaus
     * steht auf einem gemauerten Sockel, der talseitig aus dem Boden wächst.
     */
    const hebung = Math.max(0, bergseits - (boden + h));
    boden += hebung;
    // Vor der ersten Wand setzen — die Wände kommen vor dem Dach.
    aoBoden = boden; aoTraufe = boden + h;
    // Fundament: so weit unter den Sockel, wie das gezeichnete Gelände in der
    // Ferne wegfallen kann. Deckelt bei FUNDAMENT_MAX — ein Haus braucht keinen
    // 15 m tiefen Keller, den ohnehin niemand sieht. Plus die Hebung, siehe oben.
    const fuss = boden - Math.min(FUNDAMENT_MAX + hebung, Math.max(0, boden - unterkante));

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
    const hu = orientierteHuelle(p, echt2 && echt2.w !== null ? echt2.w * Math.PI / 180 : undefined);
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
     * D289 Einfirsthof (Bauwelt D287): grosser, länglicher Grundriss (≈ 400–1.500 m², Länge/Breite 1,3–2,6), kein
     * Gewerbe, keine Garage. Wohnteil an einem Giebelende (≈ 42 % der Länge, Putz-EG, Holz-OG, Läden), daran unter
     * demselben First Tenne und Stall: ganz verbrettert über einem Bruchsteinsockel, Tennentor an der Traufseite.
     * Welches Ende wohnt, entscheidet der Würfel des Hauses — deterministisch, nicht gespeichert.
     */
    const flaeche = breite * tiefe;
    const einfirst = BAUWELT_AN && g.art !== 'garage' && g.art !== 'garages' && g.art !== 'industrial' && g.art !== 'warehouse'
      && flaeche >= 380 && flaeche <= 1600 && breite / tiefe >= 1.3 && breite / tiefe <= 2.6;
    // Eigener Würfel: `wuerfel()` hier zu ziehen, verschöbe die Folge und damit Bretter und Läden aller Häuser.
    const wohnVorn = einfirst ? wuerfelAus(p[0][1] + 7.3, p[0][0])() < 0.5 : true;
    // D289: Verfallsstufe — eigener Würfel (die Hausfolge bleibt unberührt).
    const mx0 = p.reduce((s0, q) => s0 + q[0], 0) / p.length, mz0 = p.reduce((s0, q) => s0 + q[1], 0) / p.length;
    const stufe = !BAUWELT_AN ? 0
      : bewohnt.some(([bx, bz]) => (bx - mx0) * (bx - mx0) + (bz - mz0) * (bz - mz0) < 150 * 150) ? 0
      : wuerfelAus(mz0 + 3.7, mx0 - 1.1)() < 0.6 ? 1 : 2;
    stufeJetzt = g.fassade?.stufe !== undefined && BAUWELT_AN ? Math.min(2, g.fassade.stufe) : stufe;
    // Ein naher Enklavenbewohner pflegt nicht automatisch alle Nachbarhäuser.
    const hofVerfall = HOF_VERFALL_AN && referenzHaus;
    const ortsalterung = HOF_ORTSALTERUNG_AN && referenzen.some(({ mitte }) =>
      (mitte[0]-mx0) ** 2 + (mitte[1]-mz0) ** 2 <= 53 ** 2);
    if ((hofVerfall || ortsalterung) && g.fassade?.stufe === undefined) {
      const bewohntHier = bewohnt.some(([x,z]) => imPolygon([x,z], p));
      stufeJetzt = bewohntHier ? 0 : wuerfelAus(mz0 + 3.7, mx0 - 1.1)() < .33 ? 1 : 2;
    }
    const bauSchaden = hofVerfall ? stufeJetzt : 0;
    // Die gezeichnete Spur gehört zur freiliegenden Nordecke von Haus 308 und dessen Satteldach.
    const kurvenHaus = HOF_RANKE_AN && bauSchaden === 2 && hausReferenz?.gebaeudeIndex === 308 && p.length === 5
      && Math.hypot(p[1][0] - 1425.85, p[1][1] - 408.90) < .15
      && echt2?.d === 3100 && breite >= 6 && echt2.f - echt2.t >= .35;
    const ruinenHaus = HOF_RUINE_AN && kurvenHaus;
    const einsturzspur = HOF_EINSTURZ_AN && ruinenHaus;
    zielHausJetzt = HOF_ZIEL_AN && einsturzspur;
    const zielHaus = zielHausJetzt;
    const dachbruchHaus = HOF_DACHBRUCH_AN && zielHaus;
    const zieltreueHaus = HOF_ZIELTREUE_AN && dachbruchHaus;
    const verlaufHaus = HOF_VERFALLVERLAUF_AN && zieltreueHaus;
    const ortsprofil = ortsalterung ? bestimmeBaualterung(stufeJetzt, bergseits - unterkante, klein,
      NUTZBAU.has(g.art) || ebenen === 1, wuerfelAus(mx0 + 21.3,mz0 - 19.5)) : null;
    alterungJetzt = ortsprofil ? packeBaualterung(ortsprofil) : 0;
    const bewohntHaus = stufeJetzt === 0;
    const wohnGrenze = wohnVorn ? minU + breite * 0.42 : maxU - breite * 0.42;
    /** Liegt ein Weltpunkt im Wirtschaftsteil (Tenne/Stall)? */
    const imStall = (x: number, z: number) => {
      if (!einfirst) return false;
      const u = x * hu.cos + z * hu.sin;
      return wohnVorn ? u > wohnGrenze : u < wohnGrenze;
    };

    /**
     * Wo die Haustür sitzt: an der längsten Wand, mittig.
     *
     * Kein Zufall und keine Heuristik über den nächsten Weg — die längste Wand ist
     * bei einem Alpenhaus die Traufseite, und dort liegt der Eingang. Eine Garage
     * bekommt statt der Tür ein Tor: 2,6 m breit, weil ein 1,05 m breiter Eingang
     * an einer Garage sofort als Fehler auffällt.
     */
    let tuerWand = referenzHaus ? -1 : 0, tuerLang = 0;
    for (let k = 0; k < p.length - 1; k++) {
      const l = Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);
      const front = referenzHaus ? ((p[k+1][1]-p[k][1])*hausReferenz!.vorne[0] - (p[k+1][0]-p[k][0])*hausReferenz!.vorne[1]) / l : 1;
      const e = hausReferenz?.eingang;
      const aufWand = e === undefined || (e !== null && Math.abs(((e[0]-p[k][0])*(p[k+1][1]-p[k][1])-(e[1]-p[k][1])*(p[k+1][0]-p[k][0]))/l)<.03);
      if (aufWand && front > 0.9 && l > tuerLang) { tuerLang = l; tuerWand = k; }
    }
    const garage = g.art === 'garage' || g.art === 'carport';
    const tuerBreite = garage ? 2.6 : 1.05;
    const tuerHoehe = garage ? 2.3 : 2.1;
    /**
     * Was ein **Wohnhaus** ist — und damit Läden, Geranien, Vordach und
     * Holzstapel bekommt. Nicht die Halle, nicht der Stall, nicht die Garage,
     * und nichts über 16 m Spannweite oder 26 m Länge: Fensterläden an einem
     * 40-m-Werk sind kein Detail, sondern ein Fehler, und sie kosten dort 500
     * Dreiecke. Gemessen: Das 28 × 18 m grosse Dreigeschossige hätte mit
     * Läden 1.514 Dreiecke, über dem Deckel (D111).
     */
    // Und höchstens drei Ebenen: Ein Viergeschossiges mit Läden an 68 Fenstern
    // kam auf 1.502 Dreiecke — zwei über dem Deckel — und ist im Bestand ein
    // Wohnblock, kein Bauernhaus.
    const wohnhaus = (!garage && !NUTZBAU.has(g.art) && klein <= 16 && breite <= 26 && ebenen <= 3) || einfirst;
    /** Umfang des Grundrisses — die Brettbreite wächst damit, siehe `bretterwand`. */
    let umfang = 0;
    for (let k = 0; k < p.length - 1; k++) umfang += Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);

    /**
     * Bretterschalung: senkrechte Bretter, 0,5 m breit, jedes in einem eigenen
     * Ton — das Obergeschoss war bisher **eine** Fläche in `SCHALUNG`, und eine
     * Fläche in einer Farbe ist genau das, was die Stilreferenz nie zeigt
     * (D112). Nachbarbretter bekommen nie denselben Ton. **Budget je Haus,
     * nicht je Wand:** Die Brettbreite ist 0,5 m, wächst aber so, dass ein
     * Haus höchstens 60 Bretter trägt — ein 30-Ecken-Werk mit 270 m Umfang
     * hätte sonst 540 Bretter und 2.188 Dreiecke, über dem Deckel (D111).
     * Nur an Wohnhäusern; eine Halle ist im Bestand Blech, nicht Lärche.
     */
    // D296: Rechteckige Wandfelder nur an realen Fensteröffnungen unterteilen.
    // Gilt auch für einzelne Bretter; die vorhandenen Farbtöne bleiben erhalten.
    let wandLoch: { u0: number; u1: number; y0: number; y1: number }[] = [];
    let wandStart: [number, number] = [0, 0], wandRichtung: [number, number] = [1, 0];
    const wandFeld = (ax: number, az: number, bx: number, bz: number, y0: number, y1: number, farbe: THREE.Color) => {
      if (!wandLoch.length) { quad([ax,y0,az], [bx,y0,bz], [bx,y1,bz], [ax,y1,az], farbe); return; }
      const uA = (ax - wandStart[0]) * wandRichtung[0] + (az - wandStart[1]) * wandRichtung[1];
      const uB = (bx - wandStart[0]) * wandRichtung[0] + (bz - wandStart[1]) * wandRichtung[1];
      const relevant = wandLoch.filter(l => l.u1 > uA && l.u0 < uB && l.y1 > y0 && l.y0 < y1);
      const ys = [...new Set([y0, y1, ...relevant.flatMap(l => [Math.max(y0,l.y0), Math.min(y1,l.y1)])])].sort((a,b) => a-b);
      const P = (u: number, y: number): [number, number, number] => [wandStart[0] + wandRichtung[0]*u, y, wandStart[1] + wandRichtung[1]*u];
      // Pro Höhenband nur die geschlossenen Abschnitte bauen. Ein kartesisches
      // Raster würde Fensterkanten durch die gesamte Wand fortsetzen und viel
      // unnötige Geometrie erzeugen, besonders zwischen den Geschossen.
      for (let j = 0; j < ys.length - 1; j++) {
        const y = (ys[j] + ys[j + 1]) * 0.5;
        const loecher = relevant.filter(l => y > l.y0 && y < l.y1).sort((a, b) => a.u0 - b.u0);
        const streifen = (von: number, bis: number) => {
          if (bis - von < 1e-6 || ys[j + 1] - ys[j] < 1e-6) return;
          quad(P(von, ys[j]), P(bis, ys[j]), P(bis, ys[j + 1]), P(von, ys[j + 1]), farbe);
        };
        let rand = uA;
        for (const loch of loecher) {
          streifen(rand, Math.min(uB, loch.u0));
          rand = Math.max(rand, Math.min(uB, loch.u1));
        }
        streifen(rand, uB);
      }
    };
    const brettBreite = Math.max(0.5, umfang / 60);
    const bretterwand = (x1: number, z1: number, x2: number, z2: number, y0: number, y1: number, eingebrochen = false,
      putzbruch?: (t: number) => number) => {
      const l = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(1, Math.round(l / brettBreite));
      const nx = (z2-z1)/l, nz = -(x2-x1)/l;
      let ton = Math.floor(wuerfel() * 5);
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        ton = (ton + 1 + Math.floor(wuerfel() * 4)) % 5;
        const ax=x1+(x2-x1)*t0, az=z1+(z2-z1)*t0, bx=x1+(x2-x1)*t1, bz=z1+(z2-z1)*t1;
        const mitte = (t0+t1)*.5;
        if (putzbruch && mitte > .14 && mitte < .86) {
          const P = (t: number, y: number, v: number): [number, number, number] => [x1+(x2-x1)*t+nx*v,y,z1+(z2-z1)*t+nz*v];
          baueSchalungsriss(tri,quadNach,P,t0,t1,y0,y1,[(x2-x1)/l,0,(z2-z1)/l],[nx,0,nz],SCHALUNG_TOENE[ton],i,putzbruch);
        } else if (eingebrochen && mitte > .19 && mitte < .74) {
          // Gebrochene Brettenden tragen noch die Stärke der verwitterten Schalung.
          const h0 = y0 + (dachbruchHaus ? .23 + [0,.15,.08,.31,.23,.46,.32][i%7]
            : .39 + [0,.43,.12,.61,.26,.96,.57][i%7]);
          const h1 = h0 + (i%2 ? .12 : -.19);
          const a: [number, number, number] = [ax,h0,az], b: [number, number, number] = [bx,h1,bz];
          const innen = ([x,y,z]: [number, number, number]): [number, number, number] => [x-nx*.11,y,z-nz*.11];
          quad([ax,y0,az],[bx,y0,bz],b,a,SCHALUNG_TOENE[ton]);
          quadNach(a,b,innen(b),innen(a),RAHMEN,[0,1,0]);
          quadNach(a,innen(a),innen([ax,y0,az]),[ax,y0,az],TUER,[-(x2-x1),0,-(z2-z1)]);
          quadNach(b,[bx,y0,bz],innen([bx,y0,bz]),innen(b),TUER,[x2-x1,0,z2-z1]);
        } else wandFeld(ax,az,bx,bz,y0,y1,SCHALUNG_TOENE[ton]);
      }
    };

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
    const holzAb = ebenen >= 2 && !garage
      ? boden + (ebenen - 1) * geschoss
      : Infinity;

    // Wände
    for (let k = 0; k < p.length - 1; k++) {
      const [x1, z1] = p[k], [x2, z2] = p[k + 1];
      const oben = boden + h;
      const einsturz = ruinenHaus && k === 1;
      const stallWand = imStall((x1 + x2) / 2, (z1 + z2) / 2);
      const breiteF = 0.9, hoeheF = 1.15;
      wandLoch = [];
      const lochLaenge = Math.hypot(x2-x1,z2-z1);
      const traufseitig = Math.abs((x2-x1)*hu.cos + (z2-z1)*hu.sin) > lochLaenge*0.7;
      const anzahl = g.fassade ? (traufseitig ? g.fassade.fensterachsen.traufe : g.fassade.fensterachsen.giebel)
        : Math.max(1, Math.floor(lochLaenge / 3.2));
      const eingangU = hausReferenz?.eingang
        ? ((hausReferenz.eingang[0]-x1)*(x2-x1)+(hausReferenz.eingang[1]-z1)*(z2-z1))/lochLaenge : lochLaenge/2;
      const eingangX=x1+(x2-x1)*eingangU/lochLaenge, eingangZ=z1+(z2-z1)*eingangU/lochLaenge;
      const eingangBoden = referenzHaus && k === tuerWand
        ? Math.max(boden, terrain.hoeheAn(eingangX+(z2-z1)/lochLaenge*.35,eingangZ-(x2-x1)/lochLaenge*.35)) : boden;
      const fensterEntfaellt = (ebene: number, u: number) =>
        (referenzHaus && k === tuerWand && ebene === 0 && Math.abs(u-eingangU) < (tuerBreite+breiteF)/2+(hausReferenz?.eingang ? 0.65 : 0.18))
        || (einsturz && ebene > 0 && u / lochLaenge > .13 && u / lochLaenge < .83);
      const fensterUnterkante = (ebene: number) => boden + ebene * geschoss + 1.05;
      // Unpassende Fotoachsen erzeugen keine überlappenden Löcher oder offene Hausecken.
      const fensterVertieft = (FENSTERTIEFE_AN || referenzHaus) && !stallWand && lochLaenge >= 2.2 && anzahl > 0 && lochLaenge / anzahl >= 1.2;
      wandStart = [x1,z1]; wandRichtung = [(x2-x1)/Math.max(lochLaenge,1e-6),(z2-z1)/Math.max(lochLaenge,1e-6)];
      if (fensterVertieft) {
        for(let e=0;e<ebenen;e++) {
          const y=fensterUnterkante(e);
          if(y+hoeheF > oben-0.25) continue;
          for(let i=0;i<anzahl;i++) { const u=lochLaenge*(i+0.5)/anzahl; if(fensterEntfaellt(e,u)) continue; wandLoch.push({u0:u-breiteF/2,u1:u+breiteF/2,y0:y,y1:y+hoeheF}); }
        }
      }
      if (referenzHaus && k === tuerWand) wandLoch.push({u0:eingangU-tuerBreite/2,u1:eingangU+tuerBreite/2,y0:boden,y1:eingangBoden+tuerHoehe+.02});
      const bruchGrenze = Math.max(boden+1.05+hoeheF+.065,k === tuerWand ? eingangBoden+tuerHoehe+.095 : -Infinity);
      const putzbruch = verlaufHaus && einsturz && holzAb > bruchGrenze
        ? (t: number) => Math.min(holzAb-bruchGrenze,bruchKantenabtrag(t)) : undefined;
      if (stallWand) {
        // D289: Tenne/Stall — Bruchsteinsockel bis 0,9 m, darüber Bretter bis zur Traufe.
        quad([x1, fuss, z1], [x2, fuss, z2], [x2, boden + 0.9, z2], [x1, boden + 0.9, z1], SOCKEL);
        bretterwand(x1, z1, x2, z2, boden + 0.9, oben);
      } else if (holzAb < oben && holzAb > fuss) {
        if (putzbruch) {
          // Die Oberkante der Mauer bröckelt entlang der eingebrochenen Lastspur ab. Die Aussparungen bleiben gleich.
          wandFeld(x1,z1,x2,z2,fuss,bruchGrenze,WAND);
          const nx = wandRichtung[1], nz = -wandRichtung[0];
          const P = (t: number, y: number, v = 0): [number, number, number] => [x1+(x2-x1)*t+nx*v,y,z1+(z2-z1)*t+nz*v];
          const reihe = [0,.18,.21,.24,.27,.30,.33,.36,.39,.42,.45,.48,.51,.54,.57,.60,.63,.66,.69,.72,.75,.79,.82,1];
          for (let i = 0; i < reihe.length - 1; i++) {
            const a = reihe[i], b = reihe[i+1], ya = holzAb-putzbruch(a), yb = holzAb-putzbruch(b);
            if (ya > bruchGrenze && yb > bruchGrenze) quad(P(a,bruchGrenze),P(b,bruchGrenze),P(b,yb),P(a,ya),WAND);
            else if (ya > bruchGrenze) tri(P(a,bruchGrenze),P(a,ya),P(b,bruchGrenze),WAND);
            else if (yb > bruchGrenze) tri(P(a,bruchGrenze),P(b,yb),P(b,bruchGrenze),WAND);
            if (ya < holzAb-.015 || yb < holzAb-.015) {
              quadNach(P(a,ya),P(b,yb),P(b,yb+.027,-.16),P(a,ya+.027,-.16),SOCKEL,[0,1,0]);
            }
          }
        } else wandFeld(x1,z1,x2,z2,fuss,holzAb,WAND);
        if (wohnhaus) bretterwand(x1, z1, x2, z2, holzAb, oben, einsturz, putzbruch);
        else wandFeld(x1,z1,x2,z2,holzAb,oben,SCHALUNG);
      } else {
        wandFeld(x1,z1,x2,z2,fuss,oben,WAND);
      }

      const wandLaenge = Math.hypot(x2 - x1, z2 - z1);
      if (wandLaenge < 0.5) continue;
      const wx = (z2 - z1) / wandLaenge, wz = -(x2 - x1) / wandLaenge;   // Wandnormale
      if (einsturz) {
        // Im Einsturz sind Deckenansatz, hintere Wand und abgescherte Ständer sichtbar.
        const K = fassadenKasten(quadNach,[x1,z1],wandRichtung,[wx,wz]);
        const u = (t: number) => t * wandLaenge;
        if (putzbruch) {
          K(u(.16),u(.36),holzAb-.12,holzAb+.06,-1.55,-.12,TUER);
          K(u(.39),u(.62),holzAb-.22,holzAb-.09,-1.55,-.48,RUINEN_INNEN);
          K(u(.63),u(.78),holzAb-.10,holzAb+.06,-1.55,-.19,TUER);
        } else K(u(.17),u(.77),holzAb-.04,holzAb+.12,-1.55,-.09,TUER);
        const rueckwand = dachbruchHaus ? -2.62 : -1.6;
        if (dachbruchHaus) K(u(.14),u(.81),holzAb+.12,oben+.38,rueckwand,rueckwand+.07,RUINEN_INNEN);
        else K(u(.17),u(.77),holzAb+.12,oben+.05,-1.6,-1.53,RUINEN_INNEN);
        const staender = zielHaus ? [[.22,.40],[.43,1.43],[.72,.49]] : [[.22,.35],[.41,.59],[.63,.80],[.72,.45]];
        for (const [t, rest] of staender) {
          K(u(t)-.065,u(t)+.065,holzAb,oben-rest,-.31,-.13,SPARREN);
        }
        const P = (t: number, y: number, v: number): [number, number, number] => [x1+u(t)*wandRichtung[0]+wx*v,y,z1+u(t)*wandRichtung[1]+wz*v];
        if (dachbruchHaus) {
          // Das Feld hinter dem Bruch bleibt auch beim Blick quer zur Wand räumlich geschlossen.
          for (const t of [.145,.80]) K(u(t)-.045,u(t)+.045,holzAb+.12,oben+.25,rueckwand+.06,-.39,RUINEN_INNEN);
          K(u(.17),u(.77),holzAb+.12,holzAb+.19,rueckwand+.06,-.35,TUER);
          K(u(.18),u(.76),oben-.36,oben-.19,rueckwand+.12,-.50,SPARREN);
          for (const t of [.26,.42,.57,.71]) {
            const endHoehe = oben - .15 - (t - .23) * .92;
            K(u(t)-.07,u(t)+.073,endHoehe-.16,endHoehe,rueckwand+.13,-.34,SPARREN);
          }
          const eckscheibe = u(.41), y = holzAb+1.21, tiefe = rueckwand+.087;
          K(eckscheibe-.33,eckscheibe+.33,y,y+.75,tiefe,tiefe+.04,RUINEN_INNEN);
          for (const x of [-.31,0,.31]) K(eckscheibe+x-.028,eckscheibe+x+.028,y,y+.75,tiefe+.04,tiefe+.08,REFERENZ_HOLZ);
          for (const hoehe of [y,y+.36,y+.71]) K(eckscheibe-.31,eckscheibe+.31,hoehe,hoehe+.04,tiefe+.04,tiefe+.08,REFERENZ_HOLZ);
          baueTruemmerkeil(tri,quadNach,P,wandLaenge,holzAb,oben,ALTE_SCHINDEL,[wx,0,wz],zieltreueHaus,verlaufHaus);
          baueRankenkurve(tri, [
            { ort: P(.55,holzAb+.17,.16), aussen: [wx,.24,wz] },
            { ort: P(.61,holzAb+.38,.19), aussen: [wx,.28,wz] },
            { ort: P(.707,holzAb+.57,.20), aussen: [wx,0,wz] },
            { ort: P(.735,oben-.98,.12), aussen: [wx,0,wz] },
            { ort: P(.723,oben-.47,.17), aussen: [wx,.30,wz] },
          ], 318312, WANDRANKE);
          if (zieltreueHaus) {
            // Der abgerissene Trieb hängt vom linken Bruchrand zurück auf die alte Schalung.
            baueRankenkurve(tri, [
              { ort: P(.168,oben-.11,.30), aussen: [wx,.28,wz] },
              { ort: P(.154,oben-.44,.29), aussen: [wx,0,wz] },
              { ort: P(.164,oben-.78,.20), aussen: [wx,0,wz] },
              { ort: P(.186,oben-1.15,.15), aussen: [wx,0,wz] },
              { ort: P(.180,holzAb+.34,.14), aussen: [wx,0,wz] },
            ], 320831, WANDRANKE, true);
          }
        } else if (zielHaus) {
          // Der lange Riss im Zielbild läuft durch die obere Öffnung bis zum Efeu an der Ecke.
          baueBruchholz(tri,P(.60,holzAb+.26,-.10),P(.225,oben-.38,.08),.21,.19,317308);
          baueBruchholz(tri,P(.57,holzAb+.20,-.03),P(.369,holzAb+1.18,.18),.105,.093,317311);
          baueBruchholz(tri,P(.71,holzAb+.58,-.27),P(.40,holzAb+.22,.12),.19,.12,317309);
          baueBruchholz(tri,P(.47,holzAb+.42,-.25),P(.30,holzAb+.57,.21),.22,.11,317310);
          // Dachschindeln stauen sich auf dem abgesackten Deckenrand der Öffnung.
          for (const [t,y,v,kipp] of [[.27,.18,-.04,.30],[.34,.23,.04,-.22],[.44,.28,.09,.36],[.54,.17,-.11,-.17],[.62,.23,.09,.45]]) {
            quadNach(P(t-.026,holzAb+y,v+.28),P(t+.022,holzAb+y+.11,v+.22),
              P(t+.029,holzAb+y+.23+kipp,v-.24),P(t-.028,holzAb+y+.19+kipp,v-.24),ALTE_SCHINDEL,[0,1,0]);
          }
          const fensterTiefe = -1.49, fensterU = u(.42), fensterY = holzAb+1.24;
          K(fensterU-.29,fensterU+.29,fensterY,fensterY+.62,fensterTiefe,fensterTiefe+.04,TUER);
          for(const seite of [-1,1]){
            K(fensterU+seite*.22-.024,fensterU+seite*.22+.024,fensterY,fensterY+.62,fensterTiefe+.04,fensterTiefe+.075,REFERENZ_HOLZ);
          }
          K(fensterU-.22,fensterU+.22,fensterY+.28,fensterY+.32,fensterTiefe+.04,fensterTiefe+.075,REFERENZ_HOLZ);
          K(fensterU-.024,fensterU+.024,fensterY,fensterY+.62,fensterTiefe+.04,fensterTiefe+.075,REFERENZ_HOLZ);
          baueRankenkurve(tri, [
            { ort: P(.66,holzAb+.12,.19), aussen: [wx,0,wz] },
            { ort: P(.70,holzAb+.47,.23), aussen: [wx,0,wz] },
            { ort: P(.73,holzAb+.88,.17), aussen: [wx,0,wz] },
            { ort: P(.739,oben-.72,.16), aussen: [wx,.24,wz] },
          ], 317312, WANDRANKE);
        } else quadNach(P(.22,oben-.55,-.16),P(.66,holzAb+.34,-.08),P(.68,holzAb+.59,-.08),P(.24,oben-.34,-.16),SPARREN,[wx,0,wz]);
        const [tx,tz] = wandRichtung;
        const [sx,,sz] = P(.19,boden,0);
        baueRuinenschutt(tri,[sx,sz],wandRichtung,[wx,wz],terrain.hoeheAn,417,(x,z) => {
          const ort = (x-x1)*tx + (z-z1)*tz;
          const grenze = k === tuerWand ? eingangU - .92 : u(.41);
          return ort < .03 || ort > grenze;
        }, zielHaus);
        if (einsturzspur && !zielHaus) {
          // Auflage zwischen Trümmern und dem gebrochenen unteren Wandriegel.
          const fuss = P(.105,boden,1.74);
          fuss[1] = terrain.hoeheAn(fuss[0],fuss[2]) + .065;
          baueBruchholz(tri,fuss,P(.295,holzAb+.87,.085),.29,.25,316308);
        }
      }
      const feuchteWand = ortsprofil && !referenzHaus && stufeJetzt === 2 && ortsprofil.feuchte > .59 && wz < -.38;
      if ((bauSchaden === 1 || bauSchaden === 2 || feuchteWand) && wandLaenge >= 2.2 && !(kurvenHaus && k < 2)) {
        const saat = Math.floor(glutHash(x1, boden, z1) * 4294967295);
        const zurGasse = hausReferenz && wx * hausReferenz.vorne[0] + wz * hausReferenz.vorne[1] > -.2;
        if (zurGasse || bauSchaden === 2 || feuchteWand) baueHausbewuchs(tri, [x1,z1], [x2,z2], [wx,wz],
          terrain.hoeheAn, oben, bauSchaden === 2 ? 2 : 1, saat, k === tuerWand ? eingangU : null, WANDRANKE);
      }

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
        if (referenzHaus) {
          const K=fassadenKasten(quadNach,[x1,z1],[(x2-x1)/wandLaenge,(z2-z1)/wandLaenge],[wx,wz]);
          const abschnitte=k===tuerWand ? [[0,eingangU-tuerBreite/2-0.12],[eingangU+tuerBreite/2+0.12,wandLaenge]] : [[0,wandLaenge]];
          if (HOF_BODEN_AN) baueHofsockel(quadNach,[x1,z1],[(x2-x1)/wandLaenge,(z2-z1)/wandLaenge],
            [wx,wz],abschnitte as [number,number][],fuss-.06,boden+.34,terrain.hoeheAn,SOCKEL,dachbruchHaus ? SOCKEL : RAHMEN);
          else for(const [a,b] of abschnitte) {
            K(a,b,fuss-0.06,boden+0.34,0.015,0.13,SOCKEL);
            K(a,b,boden+0.34,boden+0.41,0.01,0.17,RAHMEN);
          }
          if (putzbruch) {
            K(0,wandLaenge*.192,holzAb-.15,holzAb+.02,.02,.13,TUER);
            K(wandLaenge*.795,wandLaenge,holzAb-.15,holzAb+.02,.02,.13,TUER);
            const P = (t: number, y: number, v: number): [number, number, number] =>
              [x1+(x2-x1)*t+wx*v,y,z1+(z2-z1)*t+wz*v];
            baueBruchholz(tri,P(.187,holzAb-.064,.071),P(.383,holzAb-.19,.28),.129,.161,321320,true,true);
            baueBruchholz(tri,P(.806,holzAb-.062,.07),P(.623,holzAb-.27,.18),.13,.14,321321,true,true);
          } else if(Number.isFinite(holzAb)) K(0,wandLaenge,holzAb-0.15,Math.min(oben,holzAb)+0.02,0.02,0.13,TUER);
        } else band(boden, 0.34, 0.05, SOCKEL);
        for (let e = 1; e < ebenen; e++) if (!putzbruch || e < ebenen-1) band(boden + e * geschoss - 0.07, 0.14, 0.07, DACH);
      }

      // Haustür
      if (k === tuerWand && wandLaenge >= tuerBreite + 0.6) {
        const t = eingangU/wandLaenge;
        const cx = x1 + (x2 - x1) * t, cz = z1 + (z2 - z1) * t;
        const ex = (x2 - x1) / wandLaenge * tuerBreite / 2;
        const ez = (z2 - z1) / wandLaenge * tuerBreite / 2;
        const o = referenzHaus ? -0.14 : 0.06, y0 = eingangBoden + 0.02, y1 = Math.min(eingangBoden+tuerHoehe,boden+h-0.3);
        if (!referenzHaus) quad(
          [cx - ex + wx * o, y0, cz - ez + wz * o],
          [cx + ex + wx * o, y0, cz + ez + wz * o],
          [cx + ex + wx * o, y1, cz + ez + wz * o],
          [cx - ex + wx * o, y1, cz - ez + wz * o],
          TUER,
        );
        // Türstock: ein schmaler heller Rahmen, damit die Tür nicht als Loch liest.
        const r = 0.09;
        if (!referenzHaus) quad(
          [cx - ex - ex * 0.14 + wx * (o - 0.02), y0, cz - ez - ez * 0.14 + wz * (o - 0.02)],
          [cx + ex + ex * 0.14 + wx * (o - 0.02), y0, cz + ez + ez * 0.14 + wz * (o - 0.02)],
          [cx + ex + ex * 0.14 + wx * (o - 0.02), y1 + r, cz + ez + ez * 0.14 + wz * (o - 0.02)],
          [cx - ex - ex * 0.14 + wx * (o - 0.02), y1 + r, cz - ez - ez * 0.14 + wz * (o - 0.02)],
          SOCKEL,
        );
        if (referenzHaus) {
          const K=fassadenKasten(quadNach,[cx,cz],[(x2-x1)/wandLaenge,(z2-z1)/wandLaenge],[wx,wz]);
          const a=tuerBreite/2;
          // Aufgedoppelte Füllungen und Querfriese statt einer aufgeklebten Türfläche.
          for(let b=0;b<4;b++) K(-a+.055+b*(tuerBreite-.11)/4,-a+.055+(b+1)*(tuerBreite-.11)/4-.008,y0+.12,y1-.12,-.135,-.115,REFERENZ_HOLZ);
          for(const y of [y0+.12,y0+.92,y1-.15]) K(-a+.03,a-.03,y,y+.075,-.115,-.075,TUER);
          K(-a-.13,-a,y0,y1+.13,-.16,.08,RAHMEN);
          K(a,a+.13,y0,y1+.13,-.16,.08,RAHMEN);
          K(-a,a,y1,y1+.13,-.16,.08,RAHMEN);
          // Zurückgesetzte Brettertür, Füllungen, Schloss und Drücker.
          K(-a,a,y0,y1,-.18,-.14,TUER);
          K(a-.16,a-.10,y0+.92,y0+1.16,-.10,-.06,RINNE);
          K(a-.22,a-.08,y0+1.08,y0+1.12,-.06,.015,RINNE);
          const grund = Math.min(...[-a-.18,a+.18].flatMap(u=>[-.14,.38].map(v=>
            terrain.hoeheAn(cx+(x2-x1)/wandLaenge*u+wx*v,cz+(z2-z1)/wandLaenge*u+wz*v))))-.12;
          K(-a-.18,a+.18,grund,y0+.015,-.14,.38,SOCKEL);
          if (HOF_BODEN_AN && hausReferenz?.eingang) baueHoftrittplatten(quadNach,
            [hausReferenz.eingang[0],hausReferenz.eingang[1]], [wx,wz], terrain.hoeheAn, Math.floor(glutHash(cx,y0,cz)*4294967295), SOCKEL);
        }
        /**
         * Vordach über der Haustür — ein kleines Pultdach auf zwei Kopfbändern.
         *
         * Es ist das Bauteil, das die Tür als Eingang liest und nicht als
         * dunkles Rechteck: Ein Dach über einer Öffnung heisst, hier geht man
         * hinein. 0,95 m vor die Wand, je 0,35 m breiter als die Tür. Oberseite
         * in Dachfarbe, Untersicht und Stirn in Zimmermannsholz, die
         * Kopfbänder heller — sie stehen im Licht, das die Untersicht nicht
         * bekommt. Zehn Dreiecke.
         */
        if (wohnhaus) {
          const dx = (x2 - x1) / wandLaenge, dz = (z2 - z1) / wandLaenge;
          const P = (a: number, y: number, vor: number): [number, number, number] =>
            [cx + dx * a + wx * vor, y, cz + dz * a + wz * vor];
          const vb = tuerBreite / 2 + 0.35, vt = 0.95, yV0 = y1 + r + 0.22, yV1 = yV0 + 0.40;
          const nachVorn: [number, number, number] = [wx, 0, wz];
          quadNach(P(-vb, yV0, vt), P(vb, yV0, vt), P(vb, yV1, 0.02), P(-vb, yV1, 0.02), DACH, [wx, 1, wz]);
          quadNach(P(-vb, yV0 - 0.08, vt), P(vb, yV0 - 0.08, vt), P(vb, yV1 - 0.08, 0.02), P(-vb, yV1 - 0.08, 0.02),
                   TUER, [0, -1, 0]);
          quadNach(P(-vb, yV0 - 0.08, vt), P(vb, yV0 - 0.08, vt), P(vb, yV0, vt), P(-vb, yV0, vt), TUER, nachVorn);
          for (const s of [-1, 1]) {
            const a = s * (vb - 0.15);
            quadNach(P(a - 0.05, yV0 - 0.95, 0.02), P(a + 0.05, yV0 - 0.95, 0.02),
                     P(a + 0.05, yV0 - 0.12, vt - 0.2), P(a - 0.05, yV0 - 0.12, vt - 0.2), SPARREN, nachVorn);
          }
        }
      }

      /**
       * Fenster: Vorgabe als aufgesetzte Fläche; D296 vertieft die Scheibe um 18 cm.
       * In der Probe ist das Wandfeld bereits ausgespart. Fasche und Laibung
       * umschliessen die Öffnung, die opake Scheibe schliesst die Gebäudehülle.
       */
      const laenge = wandLaenge;
      if (laenge < 2.2) continue;
      const nx = wx, nz = wz;
      if (stallWand) {
        // D289: Tennentor — zweiflüglig, 3,6 × 3,4 m, nur an der Traufseite (lange Wand) des Stallteils.
        if (laenge >= 5 && Math.abs((x2 - x1) * hu.cos + (z2 - z1) * hu.sin) > laenge * 0.7) {
          const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, ex = (x2 - x1) / laenge * 1.8, ez = (z2 - z1) / laenge * 1.8;
          quad([cx - ex + nx * 0.05, boden, cz - ez + nz * 0.05], [cx + ex + nx * 0.05, boden, cz + ez + nz * 0.05],
               [cx + ex + nx * 0.05, boden + 3.4, cz + ez + nz * 0.05], [cx - ex + nx * 0.05, boden + 3.4, cz - ez + nz * 0.05], TUER);
          quad([cx - 0.04 * (x2 - x1) / laenge + nx * 0.07, boden, cz - 0.04 * (z2 - z1) / laenge + nz * 0.07],
               [cx + 0.04 * (x2 - x1) / laenge + nx * 0.07, boden, cz + 0.04 * (z2 - z1) / laenge + nz * 0.07],
               [cx + 0.04 * (x2 - x1) / laenge + nx * 0.07, boden + 3.4, cz + 0.04 * (z2 - z1) / laenge + nz * 0.07],
               [cx - 0.04 * (x2 - x1) / laenge + nx * 0.07, boden + 3.4, cz - 0.04 * (z2 - z1) / laenge + nz * 0.07], SPARREN);
        }
        continue;
      }
      // D296: dieselben Achsen, Masse und Unterkanten wie die Wandaussparungen oben.
      for (let ebene = 0; ebene < ebenen; ebene++) {
        const yUnten = fensterUnterkante(ebene);
        if (yUnten + hoeheF > boden + h - 0.25) continue;
        for (let i = 0; i < anzahl; i++) {
          const t = (i + 0.5) / anzahl;
          if (fensterEntfaellt(ebene,laenge*t)) continue;
          const cx = x1 + (x2 - x1) * t, cz = z1 + (z2 - z1) * t;
          const zerbrochen = einsturz && !zielHaus && ebene === 0 && t < .4;
          const ex = (x2 - x1) / laenge * breiteF / 2, ez = (z2 - z1) / laenge * breiteF / 2;
          const o = fensterVertieft ? -0.18 : 0.04;
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
          if (fensterVertieft) {
            const dx=(x2-x1)/laenge, dz=(z2-z1)/laenge;
            const P=(u:number,y:number,vor:number):[number,number,number] => [cx+dx*u+nx*vor,y,cz+dz*u+nz*vor];
            const a=breiteF/2, y0=yUnten, y1=yUnten+hoeheF, v=0.025;
            const ton=wohnhaus ? RAHMEN : SOCKEL;
            // Vier offene Faschenstreifen; kein Quad verdeckt die Aussparung.
            quadNach(P(-a-r,y0-r,v),P(-a,y0-r,v),P(-a,y1+r,v),P(-a-r,y1+r,v),ton,[nx,0,nz]);
            quadNach(P(a,y0-r,v),P(a+r,y0-r,v),P(a+r,y1+r,v),P(a,y1+r,v),ton,[nx,0,nz]);
            quadNach(P(-a,y0-r,v),P(a,y0-r,v),P(a,y0,v),P(-a,y0,v),ton,[nx,0,nz]);
            quadNach(P(-a,y1,v),P(a,y1,v),P(a,y1+r,v),P(-a,y1+r,v),ton,[nx,0,nz]);
            // Laibung: Licht und Silhouette entstehen aus der tatsächlichen Tiefe.
            quadNach(P(-a,y0,o),P(-a,y0,v),P(-a,y1,v),P(-a,y1,o),ton,[dx,0,dz]);
            quadNach(P(a,y0,v),P(a,y0,o),P(a,y1,o),P(a,y1,v),ton,[-dx,0,-dz]);
            quadNach(P(-a,y0,v),P(-a,y0,o),P(a,y0,o),P(a,y0,v),ton,[0,1,0]);
            quadNach(P(-a,y1,o),P(-a,y1,v),P(a,y1,v),P(a,y1,o),ton,[0,-1,0]);
          } else {
          quad(
            [cx - rx + nx * (o - 0.015), yUnten - r, cz - rz + nz * (o - 0.015)],
            [cx + rx + nx * (o - 0.015), yUnten - r, cz + rz + nz * (o - 0.015)],
            [cx + rx + nx * (o - 0.015), yUnten + hoeheF + r, cz + rz + nz * (o - 0.015)],
            [cx - rx + nx * (o - 0.015), yUnten + hoeheF + r, cz - rz + nz * (o - 0.015)],
            // Helle Fasche statt Sockelton (D119): Ein Rahmen, der dunkler ist als
            // die Wand, rahmt nichts — er war gegen den Fensterschwarz unsichtbar.
            wohnhaus ? RAHMEN : SOCKEL,
          );
          }
          // Hinter knapp der Haelfte der Wohnhausfenster brennt nachts Licht,
          // in Staellen und Hallen hinter jedem achten (D134).
          if (HAUSFRONT_AN) raumFenster = { x: cx, z: cz, dx: (x2-x1)/laenge, dz: (z2-z1)/laenge,
            unten: yUnten, breite: breiteF, hoehe: hoeheF, seed: glutHash(cx + 17.7, yUnten, cz) };
          glutWert = (!BAUWELT_AN || bewohntHaus) && glutHash(cx, yUnten, cz) < (wohnhaus ? 0.45 : 0.12) ? 1 : 0;
          if (zerbrochen) {
            // Ein Rest Glas sitzt in den unteren Ecken, der Raum dahinter bleibt offen sichtbar.
            const links: [number, number, number] = [cx-ex+nx*o,yUnten,cz-ez+nz*o];
            const rechts: [number, number, number] = [cx+ex+nx*o,yUnten,cz+ez+nz*o];
            const mitte: [number, number, number] = [cx+nx*o,yUnten+.02,cz+nz*o];
            tri(links,[links[0],yUnten+.31,links[2]],mitte,FENSTER);
            tri(mitte,[rechts[0],yUnten+.19,rechts[2]],rechts,FENSTER);
          } else quad(
            [cx - ex + nx * o, yUnten, cz - ez + nz * o],
            [cx + ex + nx * o, yUnten, cz + ez + nz * o],
            [cx + ex + nx * o, yUnten + hoeheF, cz + ez + nz * o],
            [cx - ex + nx * o, yUnten + hoeheF, cz - ez + nz * o],
            FENSTER,
          );
          raumFenster = null;
          glutWert = 0;
          if (referenzHaus) {
            const dx=(x2-x1)/laenge,dz=(z2-z1)/laenge;
            const K=fassadenKasten(quadNach,[cx,cz],[dx,dz],[nx,nz]);
            const a=breiteF/2, y0=yUnten, y1=yUnten+hoeheF;
            K(-a,-a+.055,y0,y1,o+.006,o+.08,RAHMEN);
            K(a-.055,a,y0,y1,o+.006,o+.08,RAHMEN);
            K(-a+.055,a-.055,y0,y0+.055,o+.006,o+.08,RAHMEN);
            K(-a+.055,a-.055,y1-.055,y1,o+.006,o+.08,RAHMEN);
            if (!zerbrochen) {
              K(-.025,.025,y0+.055,y1-.055,o+.006,o+.065,RAHMEN);
              const sprossen = zieltreueHaus ? [.327,.674] : [.60];
              for (const t of sprossen) {
                const y = y0 + hoeheF*t;
                K(-a+.055,a-.055,y-.02,y+.02,o+.006,o+.065,RAHMEN);
              }
            }
            K(-a-.16,a+.16,y0-.16,y0-.08,-.18,.28,RAHMEN);
            if (zerbrochen) {
              K(-a-.28,a+.28,y0-.18,y1+.25,-.93,-.84,RUINEN_INNEN);
              continue;
            }
            if (bauSchaden > 0 && (!zielHaus || !einsturz || t >= .4) && glutHash(cx - 1.7, y0, cz) < .33 + bauSchaden * .1) {
              K(-a-.07,a+.07,y0+hoeheF*.27,y0+hoeheF*.40,-.035,.035,REFERENZ_HOLZ);
            }
            for(const seite of [-1,1]) {
              const zustandLaden = glutHash(cx + seite * 1.7, y0, cz);
              if (bauSchaden > 0 && zustandLaden < bauSchaden * .26) continue;
              const winkel=seite*(.24 + (bauSchaden > 0 ? zustandLaden * .65 : 0)), c=Math.cos(winkel), s=Math.sin(winkel);
              const richtung=[dx*c+nx*s,dz*c+nz*s];
              const n=[nx*c-dx*s,nz*c-dz*s];
              const ursprung=[cx+dx*seite*(a+.15)+nx*.06,cz+dz*seite*(a+.15)+nz*.06];
              const L=fassadenKasten(quadNach,ursprung,richtung,n);
              const lo=seite<0 ? -.4 : 0, hi=lo+.4;
              for(let b=0;b<3;b++) L(lo+b*.134,Math.min(hi,lo+(b+1)*.134-.009),y0-.02,y1+.02,-.025,.025,LADEN);
              for(const y of [y0+.14,y1-.18]) L(lo,hi,y,y+.065,.025,.055,TUER);
              for(const y of [y0+.18,y1-.22]) L(seite<0 ? -.07 : 0,seite<0 ? 0 : .07,y,y+.045,.055,.075,RINNE);
            }
            continue;
          }
          if (BAUWELT_AN) {
            /**
             * D289: Fensterkreuz und Vorhang. Ohne sie ist eine Scheibe eine schwarze Fläche; mit ihnen ein Fenster.
             * Kreuz in Rahmenfarbe 5 cm breit, Vorhang (helles Leinen) hinter jeder zweiten Wohnhausscheibe als
             * oberes Drittel — ein bewohntes Haus liest sich am Vorhang.
             */
            const kx = (x2 - x1) / laenge * 0.025, kz = (z2 - z1) / laenge * 0.025, ov = o + 0.006;
            quad([cx - kx + nx * ov, yUnten, cz - kz + nz * ov], [cx + kx + nx * ov, yUnten, cz + kz + nz * ov],
                 [cx + kx + nx * ov, yUnten + hoeheF, cz + kz + nz * ov], [cx - kx + nx * ov, yUnten + hoeheF, cz - kz + nz * ov], RAHMEN);
            const qy = yUnten + hoeheF * 0.6;
            quad([cx - ex + nx * ov, qy - 0.025, cz - ez + nz * ov], [cx + ex + nx * ov, qy - 0.025, cz + ez + nz * ov],
                 [cx + ex + nx * ov, qy + 0.025, cz + ez + nz * ov], [cx - ex + nx * ov, qy + 0.025, cz - ez + nz * ov], RAHMEN);
            if (!HAUSFRONT_AN && wohnhaus && bewohntHaus && glutHash(cx + 3.1, yUnten, cz) < 0.5) {
              const vo = o + 0.003;
              quad([cx - ex + nx * vo, yUnten + hoeheF * 0.68, cz - ez + nz * vo], [cx + ex + nx * vo, yUnten + hoeheF * 0.68, cz + ez + nz * vo],
                   [cx + ex + nx * vo, yUnten + hoeheF, cz + ez + nz * vo], [cx - ex + nx * vo, yUnten + hoeheF, cz - ez + nz * vo], VORHANG);
            }
          }
          if (!wohnhaus) continue;

          /**
           * Fensterbank, Läden, Geranien — die drei Dinge, an denen ein
           * oberbayerisches Fenster von jedem anderen zu unterscheiden ist.
           *
           * Die **Bank** ist ein helles Brett 10 cm vor der Wand; sie gibt dem
           * Fenster eine Unterkante, die Schatten wirft. Die **Läden** sind je
           * ein Flügel links und rechts, 0,40 m breit, in Grün — im Bestand
           * die häufigste Ladenfarbe, und gegen den Putz die eine gesättigte
           * Fläche an der Wand. **Geranien** nur an der Traufseite mit der Tür
           * und nur ab dem ersten Obergeschoss: Dort hängen sie im Bestand,
           * und an allen Fenstern wären es an einem 12-m-Haus 40 Kästen. Sie
           * sind der eine rote Fleck, den die Palette hat, und der trägt auf
           * 60 m noch.
           */
          const dx = (x2 - x1) / laenge, dz = (z2 - z1) / laenge;
          const bankY = yUnten - r - 0.07;
          quad([cx - rx + nx * 0.10, bankY, cz - rz + nz * 0.10], [cx + rx + nx * 0.10, bankY, cz + rz + nz * 0.10],
               [cx + rx + nx * 0.10, yUnten - r, cz + rz + nz * 0.10], [cx - rx + nx * 0.10, yUnten - r, cz - rz + nz * 0.10],
               RAHMEN);
          const lb = 0.40, o2 = fensterVertieft ? 0.05 : o + 0.01;
          for (const s of [-1, 1]) {
            // D289: Verlassene Häuser haben Läden verloren — 30 % (Stufe 1) bzw. 60 % (Stufe 2) fehlen.
            if (BAUWELT_AN && stufeJetzt > 0 && glutHash(cx + s * 1.7, yUnten + 0.3, cz) < stufeJetzt * 0.3) continue;
            const a0 = s * (breiteF / 2 + r + 0.03), a1 = a0 + s * lb;
            const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
            quad([cx + dx * lo + nx * o2, yUnten - 0.02, cz + dz * lo + nz * o2],
                 [cx + dx * hi + nx * o2, yUnten - 0.02, cz + dz * hi + nz * o2],
                 [cx + dx * hi + nx * o2, yUnten + hoeheF + 0.02, cz + dz * hi + nz * o2],
                 [cx + dx * lo + nx * o2, yUnten + hoeheF + 0.02, cz + dz * lo + nz * o2], LADEN);
          }
          if (ebene >= 1 && k === tuerWand && (!BAUWELT_AN || bewohntHaus)) {
            const kv = 0.28, ky0 = bankY - 0.18, ky1 = bankY;
            quad([cx - ex + nx * kv, ky0, cz - ez + nz * kv], [cx + ex + nx * kv, ky0, cz + ez + nz * kv],
                 [cx + ex + nx * kv, ky1, cz + ez + nz * kv], [cx - ex + nx * kv, ky1, cz - ez + nz * kv], KASTEN);
            const gv = kv + 0.03, gx = ex * 1.12, gz = ez * 1.12;
            for (let t = 0; t < 3; t++) {
              const f0 = -1 + t * 2 / 3, f1 = f0 + 2 / 3;
              quad([cx + gx * f0 + nx * gv, ky1 - 0.03, cz + gz * f0 + nz * gv], [cx + gx * f1 + nx * gv, ky1 - 0.03, cz + gz * f1 + nz * gv],
                   [cx + gx * f1 + nx * gv, ky1 + (t === 1 ? 0.14 : 0.22), cz + gz * f1 + nz * gv],
                   [cx + gx * f0 + nx * gv, ky1 + (t === 1 ? 0.14 : 0.22), cz + gz * f0 + nz * gv],
                   t === 1 ? LAUB : GERANIE);
            }
            quadNach([cx - gx + nx * 0.10, ky1 + 0.12, cz - gz + nz * 0.10],
                     [cx + gx + nx * 0.10, ky1 + 0.12, cz + gz + nz * 0.10],
                     [cx + gx + nx * gv, ky1 + 0.22, cz + gz + nz * gv],
                     [cx - gx + nx * gv, ky1 + 0.22, cz - gz + nz * gv], GERANIE, [0, 1, 0]);
          }
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
    const ueber = BAUWELT_AN ? Math.min(1.4, 0.3 + klein * 0.08) : Math.min(1.4, klein * 0.16);
    /** D289: Giebelüberstand — im Inntal grösser als an der Traufe, er deckt die Lauben (Bauwelt: 1,5–2,5 m). */
    const ueberGiebel = BAUWELT_AN && !garage ? Math.min(2.2, ueber + 0.6 + klein * 0.03) : ueber;
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
    // D289 (Bauwelt D287): Flachsatteldach 18–25° — 0,20 entspricht 22° (tan 22° / 2); Hallen bleiben bei 0,11.
    const steil = BAUWELT_AN ? 0.20 : 0.42;
    const neigungsFaktor = klein <= 14 ? steil
      : klein >= 34 ? 0.11
      : steil + (0.11 - steil) * (klein - 14) / 20;
    // D290: Firsthöhe aus LoD2 — Flachdach (1000) und Pultdach (2100) als flaches Dach, sonst die echte Dachhöhe.
    const firstH = echt2 ? traufe + (echt2.d === 1000 || echt2.d === 2100 ? 0.15 : Math.max(0.3, echt2.f - echt2.t))
      : traufe + klein * neigungsFaktor;
    const aU0 = minU - ueberGiebel, aU1 = maxU + ueberGiebel;
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
    const dick = dachbruchHaus ? .11 : .22;
    /** Weltrichtungen der Hüllenachsen, für `quadNach`. */
    const [ux, uz] = hu.welt(1, 0), [vx, vz] = hu.welt(0, 1);
    const richtU = (s: number): [number, number, number] => [s * ux, 0, s * uz];
    const richtV = (s: number): [number, number, number] => [s * vx, 0, s * vz];
    const OBEN: [number, number, number] = [0, 1, 0], UNTEN: [number, number, number] = [0, -1, 0];
    /**
     * D290 Walm- und Krüppelwalmdach (LoD2-Dachform 3200/3300): der First ist an beiden Enden um `walmEinzug`
     * eingerückt, die Giebelenden werden zu Walmflächen (Grundriss-Neigung 45° wie die Traufseiten). Krüppelwalm
     * vereinfacht mit halbem Einzug. Ohne Walm ist `walmEinzug` 0 und alles bleibt Satteldach.
     */
    const walm = !!echt2 && (echt2.d === 3200 || echt2.d === 3300);
    const walmEinzug = walm ? Math.min((aU1 - aU0) / 2 - 0.1, (mv - aV0) * (echt2!.d === 3300 ? 0.5 : 1)) : 0;
    /** u-Rand der Dachfläche in der Tiefe v (bei Walm von der Traufe zum First eingezogen). */
    const uRand = (v: number, seite: -1 | 1) => {
      const anteil = walm ? 1 - Math.min(1, Math.abs(v - mv) / Math.max(0.01, mv - aV0)) : 0;
      return seite < 0 ? aU0 + walmEinzug * anteil : aU1 - walmEinzug * anteil;
    };
    const dachY = (v: number) => {
      const halb = mv - aV0;
      if (halb <= 0) return traufe;
      return firstH - (firstH - traufe) * Math.min(1, Math.abs(v - mv) / halb);
    };
    const sackdach = ortsprofil && !zielHaus && (!echt2 || echt2.d === 3100) && breite >= 5.5
      && ortsprofil.dachschaden > .30 ? ortsprofil : null;
    const schadSeite = sackdach && sackdach.lage > .53 ? (vz > 0 ? 1 : -1) : (vz > 0 ? -1 : 1);
    const schadTraufe = schadSeite === -1 ? aV0 : aV1;
    const schadSaat = glutHash(mx0, 31.4, mz0);
    const schadBreite = ruinenHaus ? Math.min(7.4, breite * .51)
      : sackdach ? Math.min(5.0, breite * (.20 + sackdach.dachschaden * .28)) : Math.min(5.8, breite * .34);
    const schadStart = minU + (sackdach ? (breite - schadBreite) * (.14 + sackdach.lage * .72) : breite * (.21 + schadSaat * .19));
    const bruchDachY = (u: number, v: number) => {
      const y = dachY(v);
      if (sackdach) {
        const phase = (u - schadStart) / schadBreite;
        const mulde = THREE.MathUtils.smoothstep(phase,-.24,.47) * (1 - THREE.MathUtils.smoothstep(phase,.53,1.24));
        const zurTraufe = Math.max(0, (v-mv) / (schadTraufe-mv));
        return y - sackdach.dachschaden * mulde * zurTraufe ** 2.3;
      }
      if (!einsturzspur) return y;
      // Die erhaltene Gegenseite, der First und die äußeren Giebel bleiben Anschlüsse.
      if (zieltreueHaus) {
        const phase = (u - schadStart) / schadBreite;
        const durchhang = verlaufHaus
          ? THREE.MathUtils.smoothstep(phase,ortsalterung ? -.43 : -.20,.44)
            * (1 - THREE.MathUtils.smoothstep(phase,.64,ortsalterung ? 1.49 : 1.34))
          : Math.max(0, 1 - ((phase - .64) / .67) ** 2);
        const zurTraufe = Math.min(1, Math.max(0, (v - mv) / (schadTraufe - mv)));
        if (verlaufHaus) return y - ((ortsalterung ? 1.53 : 1.49) + .20 * Math.sin(phase * 11.4))
          * durchhang * zurTraufe ** (ortsalterung ? 2.74 : 3.4);
        return y - 1.57 * durchhang * zurTraufe ** 4.8;
      }
      const laengs = (u - schadStart) / schadBreite - .46;
      const laengsGewicht = Math.max(0, 1 - (laengs / .70) ** 2);
      const vomFirst = Math.min(1, Math.max(0, (v-mv) / (schadTraufe-mv) * 3.15));
      return y - (dachbruchHaus ? 1.44 : 1.14) * laengsGewicht * vomFirst;
    };
    const bruch = (bauSchaden === 2 || sackdach) && !walm && breite >= 6 && firstH - traufe >= .35
      ? [0, .24, .56, .79, 1].map((u, i) => ({
        u: schadStart + u * schadBreite,
        v: schadTraufe + (mv - schadTraufe) * (sackdach
          ? [0,.09+sackdach.lage*.17,.16+sackdach.feuchte*.21,.06+(1-sackdach.lage)*.13,0]
          : verlaufHaus ? [0,.127,.208,.127,0] : zieltreueHaus ? [0,.21,.104,.041,0] : dachbruchHaus ? [0,.16,.26,.23,0]
          : zielHaus ? [0,.66,.40,.29,0] : ruinenHaus ? [0,.73,.45,.88,0] : [0,.48,.35,.62,0])[i],
      })) : null;
    const splitterRand = bruch && zielHaus ? bruch.flatMap((a, i) => {
      const b = bruch[i + 1];
      if (!b) return [a];
      return [a, ...[.27,.48,.71,.88].map((t,k) => ({
        u: a.u + (b.u - a.u) * t,
        v: a.v + (b.v - a.v) * t + schadSeite * (verlaufHaus ? [.13,-.25,.16,-.09] : zieltreueHaus ? [.18,-.225,.32,-.16]
          : dachbruchHaus ? [.17,-.12,.31,-.21] : [.10,-.24,.15,-.20])[(i + k) % 4],
      }))];
    }) : bruch;
    const traufenRand = splitterRand && (() => {
      const start = {u:aU0,v:schadTraufe}, ende = {u:aU1,v:schadTraufe};
      if (!dachbruchHaus && !sackdach) return [start,...splitterRand,ende];
      // Sparren und gebogene Dachhaut folgen derselben Absenkung. Auch neben
      // der Öffnung braucht die Haut Stützstellen, sonst ragen Sparren heraus.
      const strecke = (von: number, bis: number) => {
        const abschnitte = Math.max(1,Math.ceil((bis-von)/(sackdach ? .7 : .32)));
        return Array.from({length:abschnitte-1},(_,i) => ({u:von+(bis-von)*(i+1)/abschnitte,v:schadTraufe}));
      };
      return [start,...strecke(aU0,splitterRand[0].u),...splitterRand,
        ...strecke(splitterRand[splitterRand.length-1].u,aU1),ende];
    })();
    if (kurvenHaus && bruch) {
      // Kontrollpunkte entlang der beiden ausgefalteten Wände; die Knickzone wird außen gerundet.
      const wand = (k: number, anteil: number, hoehe: number, abstand = .17): Rankenpunkt => {
        const a = p[k], b = p[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
        const nx = dz / l, nz = -dx / l;
        return { ort: [a[0] + dx * anteil + nx * abstand, traufe - hoehe, a[1] + dz * anteil + nz * abstand], aussen: [nx, 0, nz] };
      };
      const wurzel = wand(0, dachbruchHaus ? .91 : zielHaus ? .94 : .74, 0, dachbruchHaus ? .17 : .08);
      wurzel.ort[1] = terrain.hoeheAn(wurzel.ort[0], wurzel.ort[2]) - .035;
      const eckeA = wand(0, 1, h * .48), eckeB = wand(1, 0, h * .48);
      const [nx, , nz] = richtV(schadSeite);
      const abstandZurEcke = ({ u, v }: { u: number; v: number }) => {
        const [x, z] = hu.welt(u, v);
        return Math.hypot(x - p[1][0], z - p[1][1]);
      };
      const nahAnfang = abstandZurEcke(bruch[0]) < abstandZurEcke(bruch[4]);
      const ende = bruch[nahAnfang ? 0 : 4], innen = bruch[nahAnfang ? 1 : 3];
      const spitzeU = ende.u + (innen.u - ende.u) * .08;
      const spitzeV = ende.v + (innen.v - ende.v) * .08;
      const knick: Rankenpunkt = {
        ort: [p[1][0] + (eckeA.aussen[0] + eckeB.aussen[0]) * .23, eckeA.ort[1], p[1][1] + (eckeA.aussen[2] + eckeB.aussen[2]) * .23],
        aussen: [eckeA.aussen[0] + eckeB.aussen[0], 0, eckeA.aussen[2] + eckeB.aussen[2]],
      };
      const haupttrieb = dachbruchHaus
        ? [wand(0,.917,h*.83,.20),wand(0,.947,h*.69,.16),wand(0,.966,h*.57,.18),wand(0,.988,h*.52,.20),knick,
            wand(1,.032,h*.40,.21),wand(1,.035,h*.24,.21),wand(1,.058,.34,.17)]
        : [wand(0,zielHaus ? .94 : .74,h*.74),wand(0,zielHaus ? .97 : .84,h*.57),wand(0,zielHaus ? .98 : .95,h*.53),
            knick,wand(1,zielHaus ? .045 : .10,h*.40),wand(1,zielHaus ? .065 : .15,h*.22),wand(1,zielHaus ? .06 : .10,.37)];
      const punkte: Rankenpunkt[] = [wurzel, ...haupttrieb, {
        ort: welt3(ende.u, bruchDachY(ende.u, schadTraufe) - .23, schadTraufe + schadSeite * .13), aussen: [nx, .25, nz],
      }, {
        ort: welt3(spitzeU, bruchDachY(spitzeU, spitzeV) + .15, spitzeV + schadSeite * .18), aussen: [nx, .52, nz],
      }];
      baueRankenkurve(tri, punkte, 308, WANDRANKE, zielHaus, dachbruchHaus);
    }

    const gebrocheneSeite = (versatz: number, farbe: THREE.Color, normal: [number, number, number]) => {
      if (!traufenRand) return;
      const E = (u: number, v: number) => welt3(u, bruchDachY(u,v) + versatz, v);
      for (let i = 0; i + 1 < traufenRand.length; i++) {
        const a = traufenRand[i], b = traufenRand[i+1];
        if (zieltreueHaus) {
          // An der abgerissenen Traufe krümmt sich das Feld stärker als oben am First.
          const schnitte = [.075,.17,.29,.45,.68,1];
          let vorher = 0;
          for (const anteil of schnitte) {
            quadNach(E(a.u,a.v+(mv-a.v)*vorher),E(b.u,b.v+(mv-b.v)*vorher),
              E(b.u,b.v+(mv-b.v)*anteil),E(a.u,a.v+(mv-a.v)*anteil),farbe,normal);
            vorher = anteil;
          }
          continue;
        }
        const querA = a.v + (mv-a.v)*.45, querB = b.v + (mv-b.v)*.45;
        if (einsturzspur || sackdach) {
          quadNach(E(a.u,a.v),E(b.u,b.v),E(b.u,querB),E(a.u,querA),farbe,normal);
          quadNach(E(a.u,querA),E(b.u,querB),E(b.u,mv),E(a.u,mv),farbe,normal);
        } else quadNach(E(a.u,a.v), E(b.u,b.v), E(b.u,mv), E(a.u,mv), farbe, normal);
      }
    };
    const dachHaut = (versatz: number, farbe: THREE.Color, seite: [number, number, number]) => {
      const f0 = aU0 + walmEinzug, f1 = aU1 - walmEinzug;
      if (bruch && schadSeite === -1) gebrocheneSeite(versatz, farbe, seite);
      else quadNach(welt3(aU0, traufe + versatz, aV0), welt3(aU1, traufe + versatz, aV0),
               welt3(f1, firstH + versatz, mv), welt3(f0, firstH + versatz, mv), farbe, seite);
      if (bruch && schadSeite === 1) gebrocheneSeite(versatz, farbe, seite);
      else quadNach(welt3(aU1, traufe + versatz, aV1), welt3(aU0, traufe + versatz, aV1),
               welt3(f0, firstH + versatz, mv), welt3(f1, firstH + versatz, mv), farbe, seite);
      if (walm) {
        // Walmflächen an den Enden (Dreieck als Viereck mit doppelter Spitze).
        quadNach(welt3(aU0, traufe + versatz, aV1), welt3(aU0, traufe + versatz, aV0),
                 welt3(f0, firstH + versatz, mv), welt3(f0, firstH + versatz, mv), farbe, seite);
        quadNach(welt3(aU1, traufe + versatz, aV0), welt3(aU1, traufe + versatz, aV1),
                 welt3(f1, firstH + versatz, mv), welt3(f1, firstH + versatz, mv), farbe, seite);
      }
    };
    // First läuft über u, die lange Achse. Die Fallunterscheidung von früher ist
    // weg — die Drehung erledigt, was vorher zwei Zweige tun mussten.
    /**
     * D290 Dachfarbe aus dem Luftbild (DOP20): Farbton des echten Dachs, die Helligkeit zur Hälfte von der Palette
     * (Art Direction bleibt), leicht entsättigt (Luftbilder sind sonnig und kräftig). Eigene Farbobjekte je Haus,
     * in `ROLLE` als Dach (2) angemeldet, damit der Dachscan sie trägt.
     */
    let dachFarbe = DACH, dachKante = DACH_KANTE;
    if (echt2?.c) {
      const luft = new THREE.Color(echt2.c);
      const hell = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      const ziel = (hell(DACH) + hell(luft)) / 2;
      const grau = hell(luft);
      luft.lerp(new THREE.Color(grau, grau, grau), 0.25).multiplyScalar(ziel / Math.max(0.005, grau));
      dachFarbe = luft; dachKante = luft.clone().multiplyScalar(1.3);
      ROLLE.set(dachFarbe, 2); ROLLE.set(dachKante, 2);
    }
    dachHaut(dick, dachFarbe, OBEN);
    // Untersicht: dieselbe Fläche tiefer. Wer unter dem Überstand steht, sieht
    // sonst durch das Dach hindurch. Seit D119 in Schalungston statt in
    // `TUER`: Die Sparren darunter sind dunkel, und dunkel vor dunkel ist
    // nichts — im Bestand ist die Untersicht ohnehin verschalt, hell, und die
    // Kontaktabdunklung unter der Traufe (D116) nimmt ihr das Grelle.
    dachHaut(0, SCHALUNG_TOENE[1], UNTEN);
    // Die gerissene Dachkante hat weiterhin eine Materialstärke.
    for (const seite of [-1, 1] as const) {
      const v = seite === -1 ? aV0 : aV1;
      const rand = traufenRand && schadSeite === seite
        ? [...traufenRand] : [{u:aU0,v},{u:aU1,v}];
      if (seite === 1) rand.reverse();
      for (let i = 0; i + 1 < rand.length; i++) {
        const a=rand[i], b=rand[i+1];
        const yA=bruchDachY(a.u,a.v), yB=bruchDachY(b.u,b.v);
        quadNach(welt3(a.u,yA,a.v), welt3(b.u,yB,b.v),
          welt3(b.u,yB+dick,b.v), welt3(a.u,yA+dick,a.v), zielHaus ? ALTE_SCHINDEL : TUER,richtV(seite));
      }
    }
    if (splitterRand && (zieltreueHaus || sackdach)) {
      const deckung = verlaufHaus ? [{u:Math.max(aU0+.06,splitterRand[0].u-.90),v:schadTraufe},...splitterRand,
        {u:Math.min(aU1-.06,splitterRand[splitterRand.length-1].u+.94),v:schadTraufe}] : splitterRand;
      baueDachschindeln(tri,quadNach,(u,v,hub) => welt3(u,bruchDachY(u,v)+dick+hub,v),
        deckung,schadSeite,richtV(schadSeite),SCHINDELTOENE,verlaufHaus || !!sackdach);
    } else if (splitterRand && zielHaus) {
      // Überlappende, nach außen gewölbte Schindeln über der Bruchkante.
      for (let i = 0; i < splitterRand.length - 1; i++) {
        const a = splitterRand[i], b = splitterRand[i + 1];
        for (let lage = 0; lage < (dachbruchHaus ? 5 : 3); lage++) {
          const f = glutHash(a.u,lage,a.v);
          if (lage === 0 && f < .25) continue;
          const breit = b.u - a.u;
          const u0 = a.u + breit * .05, u1 = b.u + breit * .08;
          const rueck = lage * (dachbruchHaus ? .24 : .29);
          const ueberhang = dachbruchHaus ? .24 + .23 * Math.sin(Math.PI * i / (splitterRand.length - 1)) : 0;
          const v0 = a.v + schadSeite * (.13 + f * .29 - rueck + ueberhang);
          const v1 = b.v + schadSeite * (.23 - rueck + ueberhang);
          const E = (u: number, v: number, hub: number) => welt3(u,bruchDachY(u,v)+dick+hub,v);
          const senkung = dachbruchHaus ? Math.max(0,1-lage*.65) * (.08 + f*.22) : 0;
          const A = E(u0,v0,.067+f*.09-senkung), B = E(u1,v1,.048+f*.045-senkung);
          const C = E(u1,v1-schadSeite*.46,.038), D = E(u0,v0-schadSeite*.46,.042);
          quadNach(A,B,C,D,ALTE_SCHINDEL,OBEN);
          if (lage === 0 || (dachbruchHaus && lage === 1)) quadNach(A,D,C,B,ALTE_SCHINDEL,UNTEN);
        }
      }
    }
    // Ortgang — die vier schrägen Kanten über den Giebeln (beim Walmdach gibt es keine Giebel).
    for (const u of walm ? [] : [aU0, aU1]) {
      for (const v of [aV0, aV1]) {
        quadNach(welt3(u, traufe, v), welt3(u, traufe + dick, v),
                 welt3(u, firstH + dick, mv), welt3(u, firstH, mv), TUER, richtU(u === aU0 ? -1 : 1));
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
      /**
       * **An der Firstlinie teilen** (D162).
       *
       * `dachY` ist über `v` ein **Zelt mit Knick bei `mv`**, keine Ebene. Ein
       * einziges Viereck über die ganze Kante zieht dort eine **Sehne unter dem
       * Zelt** — und was zwischen Sehne und Dachunterseite liegt, fehlt.
       *
       * Bei einem rechteckigen Grundriss ist das **der ganze Giebel**: Die
       * Giebelkante läuft von `minV` nach `maxV`, `dachY` steht an beiden Enden
       * knapp über der Traufe (nur der Dachüberstand `ueber` hebt sie an), die
       * Sehne ist also ein flacher Streifen von 40 cm statt eines Dreiecks von
       * 5 m. Gemessen: **2.020 von 2.020 Gebäuden** betroffen, Klaffmass p50
       * 3,23 m, max 5,78 m — von aussen sah man unter dem Dach durch das Haus
       * hindurch, und zwar seit dem 26.08.2026 in jedem Bild.
       *
       * Der Kommentar oben („an den Hüllenenden ergibt es das Giebeldreieck")
       * beschrieb die Absicht; erst die Teilung liefert sie. Kosten: zwei
       * Dreiecke je kreuzender Kante, beim Rechteck vier je Haus.
       */
      const teiler = (vA - mv) * (vB - mv) < 0 ? [0, (mv - vA) / (vB - vA), 1] : [0, 1];
      const giebeleinsturz = ruinenHaus && k === 1;
      if (giebeleinsturz) {
        teiler.push(.19,.74);
        teiler.sort((a,b) => a-b);
      }
      for (let s = 0; s + 1 < teiler.length; s++) {
        const t0 = teiler[s], t1 = teiler[s + 1];
        if (giebeleinsturz && t0 >= .19 && t1 <= .74) continue;
        const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0;
        const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
        const y0 = dachY(vA + (vB - vA) * t0), y1 = dachY(vA + (vB - vA) * t1);
        // Liegt das Teilstück an der Traufe, gibt es dort keinen Giebel — beim Walmdach nirgends (D290).
        if (walm || (y0 - traufe < 0.02 && y1 - traufe < 0.02)) continue;
        quad([x0, traufe, z0], [x1, traufe, z1], [x1, y1, z1], [x0, y0, z0], giebel);
      }
    }

    /**
     * Ein Kasten in Hüllenkoordinaten, mit Oberkante, die der Dachunterseite
     * folgt — für Sparren- und Pfettenköpfe, Rinne, Fallrohr, Pfosten. Welche
     * Seiten gezeichnet werden, sagt `seiten`; eine Fläche, die niemand sehen
     * kann (die Oberseite eines Sparrens unter dem Dach), kostet nur.
     */
    const kasten = (
      u0: number, u1: number, v0: number, v1: number,
      yU: (u: number, v: number) => number, yO: (u: number, v: number) => number,
      farbe: THREE.Color, seiten: { oben?: boolean; unten?: boolean; u0?: boolean; u1?: boolean; v0?: boolean; v1?: boolean },
    ) => {
      const E = (u: number, v: number, oben: boolean) => welt3(u, oben ? yO(u, v) : yU(u, v), v);
      if (seiten.unten) quadNach(E(u0, v0, false), E(u1, v0, false), E(u1, v1, false), E(u0, v1, false), farbe, UNTEN);
      if (seiten.oben) quadNach(E(u0, v0, true), E(u1, v0, true), E(u1, v1, true), E(u0, v1, true), farbe, OBEN);
      if (seiten.u0) quadNach(E(u0, v0, false), E(u0, v1, false), E(u0, v1, true), E(u0, v0, true), farbe, richtU(-1));
      if (seiten.u1) quadNach(E(u1, v0, false), E(u1, v1, false), E(u1, v1, true), E(u1, v0, true), farbe, richtU(1));
      if (seiten.v0) quadNach(E(u0, v0, false), E(u1, v0, false), E(u1, v0, true), E(u0, v0, true), farbe, richtV(-1));
      if (seiten.v1) quadNach(E(u0, v1, false), E(u1, v1, false), E(u1, v1, true), E(u0, v1, true), farbe, richtV(1));
    };
    const fest = (y: number) => () => y;
    if (bruch) {
      // Im Riss bleiben Sparren mit ungleich langen, abgesackten Enden stehen.
      for (let i = 1; i < bruch.length - 1; i++) {
        const { u, v } = bruch[i];
        if (einsturzspur) {
          // Die intakten Enden reichen in die Dachhaut. Die abgesackten Köpfe haben verschiedene Längen.
          const ansatz = v + (mv-v)*(zieltreueHaus ? .30 : .40);
          const ende = v + (schadTraufe-v)*[.68,.29,.49][i-1];
          baueBruchholz(tri,welt3(u,bruchDachY(u,ansatz)-.09,ansatz),
            welt3(u+[.11,-.16,.24][i-1],bruchDachY(u,v)-[.61,.33,.89][i-1],ende),.16,.19,31630+i,dachbruchHaus,zieltreueHaus);
          continue;
        }
        const ende = schadTraufe + (v - schadTraufe) * (.13 + .13 * i);
        const hoehe = (_u: number, t: number) => dachY(t) - .03 - .32 * Math.abs(v - t) / Math.max(.1,Math.abs(v-ende));
        kasten(u-.07,u+.07, Math.min(v,ende), Math.max(v,ende),
          (u,t) => hoehe(u,t)-.15, hoehe,TUER,{oben:true,unten:true,u0:true,u1:true,v0:true,v1:true});
      }
    }

    /**
     * Sparrenköpfe unter dem Überstand und Pfettenköpfe am Giebel (D119).
     *
     * Der Überstand war bisher eine glatte Untersicht — und eine glatte
     * Untersicht ist ein Karton mit Deckel, egal wie weit sie übersteht. Was
     * ein Alpendach von unten ausmacht, sind die Hölzer, die ihn tragen:
     * **Sparren** alle 1,1 m entlang der Traufe, von der Dachkante bis unter
     * die Wand, und am Giebel die drei **Pfetten** (First und zwei Mittel-
     * pfetten), die als Balkenköpfe aus der Giebelwand stossen. Beides folgt
     * mit der Oberkante `dachY`, derselben Formel wie die Haut. Gedeckelt bei
     * zehn Sparren je Seite am Wohnhaus, sechs an allem anderen: Bei einer
     * 54-m-Halle wären es sonst 49, und ab zehn liest man den Rhythmus, nicht
     * die Zahl. Sparren nur an Dächern mit
     * mindestens 0,5 m Überstand — an einem Schuppen mit 0,3 m stünden sie
     * als Punkte unter der Kante.
     */
    if (ueber >= 0.5 && !garage) {
      const sparrenY = (u: number, v: number) => bruchDachY(u,v) - 0.02;
      const zahl = Math.min(wohnhaus ? 10 : 6, Math.max(2, Math.floor(breite / 1.1)));
      const schritt = breite / zahl;
      for (let i = 0; i < zahl; i++) {
        const u = minU + schritt * (i + 0.5);
        const sb = 0.08;
        const fehlt = einsturzspur && u + sb > schadStart && u - sb < schadStart+schadBreite;
        // Traufseite aV0 und aV1: vom Dachrand bis 0,25 m unter die Wand.
        if (!(fehlt && schadSeite === -1)) kasten(u - sb, u + sb, aV0 + 0.02, minV + 0.25, (u, v) => sparrenY(u,v) - 0.22, sparrenY, SPARREN,
               { unten: true, u0: true, u1: true, v0: true });
        if (!(fehlt && schadSeite === 1)) kasten(u - sb, u + sb, maxV - 0.25, aV1 - 0.02, (u, v) => sparrenY(u,v) - 0.22, sparrenY, SPARREN,
               { unten: true, u0: true, u1: true, v1: true });
      }
      const halb = mv - aV0;
      // Pfetten nur am Wohnhaus: Eine Halle hat Binder, keine Balkenköpfe.
      for (const v of wohnhaus ? [mv, mv - halb * 0.55, mv + halb * 0.55] : []) {
        const pb = 0.11, yTop = dachY(v) - 0.02;
        kasten(aU0 + 0.02, minU + 0.25, v - pb, v + pb, fest(yTop - 0.24), fest(yTop), SPARREN,
               { unten: true, v0: true, v1: true, u0: true });
        kasten(maxU - 0.25, aU1 - 0.02, v - pb, v + pb, fest(yTop - 0.24), fest(yTop), SPARREN,
               { unten: true, v0: true, v1: true, u1: true });
      }
    }

    if (referenzHaus && !walm) {
      // Geschlossene Ortgangbretter, mit derselben Dachfunktion wie die Haut.
      for(const [u0,u1] of [[aU0-.035,aU0+.09],[aU1-.09,aU1+.035]]) {
        for(const [v0,v1] of [[aV0,mv],[mv,aV1]]) kasten(u0,u1,v0,v1,
          (_u,v)=>dachY(v)-.20,(_u,v)=>dachY(v)+.035,REFERENZ_HOLZ,
          {oben:true,unten:true,u0:true,u1:true,v0:true,v1:true});
      }
    }

    /**
     * Ziegelreihen und First (D119). Die Dachhaut war eine Fläche in einer
     * Farbe — in der Stilreferenz hat jedes Dach Reihen, die als hellere Kante
     * lesen, wo die Ziegelkante das Licht fängt. Hier als schmale Bänder 3 cm
     * über der Haut, alle 1,15 m Dachtiefe, höchstens sechs je Seite; der
     * First als zwei Bänder über dem Grat, ebenfalls hell. Ein Dach mit First
     * ist ein Dach, eines ohne ein Keil.
     */
    {
      const reihen = Math.min(6, Math.max(1, Math.floor((mv - aV0) / 1.15)));
      const abstand = (mv - aV0) / (reihen + 0.35);
      for (let i = 1; i <= reihen; i++) {
        for (const s of [-1, 1]) {
          const vA = mv + s * (mv - aV0 - i * abstand), vB = vA + s * 0.07;
          if (bruch && schadSeite === s) continue;
          quadNach(welt3(uRand(vA, -1), dachY(vA) + dick + 0.03, vA), welt3(uRand(vA, 1), dachY(vA) + dick + 0.03, vA),
                   welt3(uRand(vB, 1), dachY(vB) + dick + 0.03, vB), welt3(uRand(vB, -1), dachY(vB) + dick + 0.03, vB), dachKante, OBEN);
        }
      }
      for (const s of [-1, 1]) {
        const vB = mv + s * 0.20;
        quadNach(welt3(uRand(mv, -1), firstH + dick + 0.06, mv), welt3(uRand(mv, 1), firstH + dick + 0.06, mv),
                 welt3(uRand(vB, 1), dachY(vB) + dick + 0.02, vB), welt3(uRand(vB, -1), dachY(vB) + dick + 0.02, vB), dachKante, OBEN);
      }
    }

    /**
     * Dachrinne und ein Fallrohr (D119). Die Rinne hängt als Kasten unter der
     * Traufkante, an beiden Traufseiten; das Fallrohr steht an der Hüllenecke,
     * an der der Grundriss tatsächlich eine Ecke hat — bei einem L-Grundriss
     * ist eine Hüllenecke oft Luft, und ein Rohr in der Luft ist schlimmer
     * als keins. Blechgrau, damit es sich vom Holz absetzt: Es ist das eine
     * Bauteil am Haus, das nicht Holz und nicht Putz ist.
     */
    if (!garage && breite >= 5) {
      const ry = traufe - 0.02;
      const blech = zielHaus ? ALTES_BLECH : RINNE;
      if (!bruch || schadSeite !== -1) kasten(aU0, aU1, aV0 - 0.05, aV0 + 0.08, fest(ry - 0.12), fest(ry), blech, { unten: true, v0: true, v1: true });
      if (!bruch || schadSeite !== 1) kasten(aU0, aU1, aV1 - 0.08, aV1 + 0.05, fest(ry - 0.12), fest(ry), blech, { unten: true, v0: true, v1: true });
      const ecken: [number, number][] = [[minU, minV], [maxU, minV], [maxU, maxV], [minU, maxV]];
      const wahl = Math.floor(wuerfel() * 4);
      for (let e = 0; e < 4; e++) {
        const [eu, ev] = ecken[(wahl + e) % 4];
        let naechste = Infinity;
        for (let k = 0; k < p.length - 1; k++) {
          const uP = p[k][0] * hu.cos + p[k][1] * hu.sin, vP = -p[k][0] * hu.sin + p[k][1] * hu.cos;
          naechste = Math.min(naechste, Math.hypot(uP - eu, vP - ev));
        }
        if (naechste > 0.6) continue;
        const su = eu === minU ? 1 : -1, sv = ev === minV ? -1 : 1;
        const u0 = eu + su * 0.25 - 0.06, v0 = ev + sv * 0.12 - 0.06;
        kasten(u0, u0 + 0.12, v0, v0 + 0.12, fest(boden), fest(ry - 0.12), blech,
               { u0: true, u1: true, v0: sv < 0, v1: sv > 0 });
        break;
      }
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
    if (ebenen >= 2 && Math.max(breite, tiefe) >= 6 && g.fassade?.laube !== 'keine') {
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
        const y = boden + (ebenen - 1) * geschoss + 0.6;
        const bruest = 0.95;
        const v0 = bV, v1 = bV + tiefeB;
        // Der Balkon liegt an einer Wand, deren Aussenseite nach +V zeigt —
        // alles hier richtet sich also nach +V, nach oben oder nach unten.
        const VOR = richtV(1);
        const LAUBE_DUNKEL = BAUWELT_AN ? SCHALUNG_TOENE[0] : TUER;
        if (laubenDetails) {
          const alleSeiten = { oben:true, unten:true, u0:true, u1:true, v0:true, v1:true };
          kasten(bU0,bU1,v0,v1,fest(y-.08),fest(y),LAUBE_DUNKEL,alleSeiten);
          kasten(bU0-.04,bU1+.04,v1-.02,v1+.09,fest(y+.04),fest(y+.16),REFERENZ_HOLZ,alleSeiten);
          const bruchA = bU0 + (bU1 - bU0) * .34, bruchB = bU0 + (bU1 - bU0) * .58;
          const handlauf = (a: number, b: number) => kasten(a,b,v1-.015,v1+.135,fest(y+bruest-.10),fest(y+bruest+.025),REFERENZ_HOLZ,alleSeiten);
          if (bauSchaden === 2) { handlauf(bU0-.06,bruchA); handlauf(bruchB,bU1+.06); }
          else handlauf(bU0-.06,bU1+.06);
          const anzahl = Math.min(48,Math.max(3,Math.round((bU1-bU0)/.24)));
          const halb=(bU1-bU0)/anzahl*.43;
          for(let i=0;i<anzahl;i++) {
            const u=bU0+(bU1-bU0)*(i+.5)/anzahl;
            if (bauSchaden === 2 && u + halb > bruchA && u - halb < bruchB) continue;
            kasten(u-halb,u+halb,v1+.015,v1+.07,fest(y+.14),fest(y+bruest-.10),SCHALUNG_TOENE[(i*2)%5],alleSeiten);
          }
        } else {
          // D305-Gegenprobe: alte Flächen und Brettanzahl unverändert.
          quadNach(welt3(bU0,y,v0),welt3(bU1,y,v0),welt3(bU1,y,v1),welt3(bU0,y,v1),SCHALUNG,OBEN);
          quadNach(welt3(bU0,y-.08,v0),welt3(bU1,y-.08,v0),welt3(bU1,y-.08,v1),welt3(bU0,y-.08,v1),LAUBE_DUNKEL,UNTEN);
          quadNach(welt3(bU0,y+.04,v1),welt3(bU1,y+.04,v1),welt3(bU1,y+.22,v1),welt3(bU0,y+.22,v1),SCHALUNG,VOR);
          quadNach(welt3(bU0,y+bruest-.13,v1+.06),welt3(bU1,y+bruest-.13,v1+.06),welt3(bU1,y+bruest,v1+.06),welt3(bU0,y+bruest,v1+.06),LAUBE_DUNKEL,VOR);
          const bretter=Math.min(16,Math.max(3,Math.round((bU1-bU0)/.42)));
          const bb=(bU1-bU0)/bretter*(BAUWELT_AN ? 0.86 : 0.55);
          for(let i=0;i<bretter;i++) {
            const u=bU0+(bU1-bU0)*(i+.5)/bretter;
            quadNach(welt3(u-bb/2,y+.2,v1+.01),welt3(u+bb/2,y+.2,v1+.01),welt3(u+bb/2,y+bruest-.12,v1+.01),welt3(u-bb/2,y+bruest-.12,v1+.01),SCHALUNG_TOENE[(i*2)%5],VOR);
          }
        }
        // Zwei Stützen bis zum Boden — ohne sie schwebt der Balkon, mit fester
        // Länge hängen sie in der Luft.
        if (BAUWELT_AN) {
          /**
           * D292: Die Laube des Inntaler Hofs ruht auf Konsolen — den vorstehenden Köpfen der Deckenbalken des
           * Blockbaus —, nicht auf Stützen bis zum Boden; die standen wie ein Gerüst vor der Wand. Alle ~1,6 m ein
           * Balkenkopf von der Wand bis unter die Vorderkante.
           */
          const koepfe = Math.max(2, Math.round((bU1 - bU0) / 1.6) + 1);
          for (let i = 0; i < koepfe; i++) {
            const u = bU0 + 0.1 + (bU1 - bU0 - 0.2) * i / (koepfe - 1);
            kasten(u - 0.08, u + 0.08, v0 - 0.02, v1 - 0.04, fest(y - 0.3), fest(y - 0.08), SCHALUNG_TOENE[0],
                   { unten: true, u0: true, u1: true, v1: true });
          }
        } else {
          for (const u of [bU0 + 0.35, bU1 - 0.35]) {
            kasten(u - 0.07, u + 0.07, v1 - 0.19, v1 - 0.05, fest(boden), fest(y), TUER,
                   { u0: true, u1: true, v1: true });
          }
        }
        /**
         * Eckpfosten und Geranienkasten (D119). Die Pfosten schliessen die
         * Brüstung an den Enden — ohne sie endet das Brett in der Luft. Der
         * Kasten hängt aussen am Handlauf über die ganze Länge; der Balkon ist
         * im Bestand der Ort, an dem die Geranien hängen, nicht das Fenster.
         */
        for (const u of [bU0, bU1]) {
          kasten(u - 0.06, u + 0.06, v1 - 0.06, v1 + 0.08, fest(y), fest(y + bruest + 0.06), LAUBE_DUNKEL,
                 { oben: true, u0: true, u1: true, v1: true, unten:laubenDetails, v0:laubenDetails });
        }
        // D289: Blumen nur an bewohnten Häusern — an verlassenen hingen sonst frische Geranien am morschen Balkon.
        if (wohnhaus && (!BAUWELT_AN || stufeJetzt === 0)) {
          const ky = y + bruest - 0.42;
          if (laubenDetails) {
            const span=bU1-bU0-.30;
            const anzahl=Math.max(3,Math.min(5,Math.floor(span/1.35)));
            const breite=Math.min(1.05,span/anzahl-.24);
            const erde=KASTEN.clone().multiplyScalar(.28);
            const ausgabe: HausQuad = (a,b,c,d,farbe,n) => {
              quadNach(welt3(a[0],a[1],a[2]),welt3(b[0],b[1],b[2]),welt3(c[0],c[1],c[2]),welt3(d[0],d[1],d[2]),farbe,
                [n[0]*hu.cos-n[2]*hu.sin,n[1],n[0]*hu.sin+n[2]*hu.cos]);
            };
            const [sx,sz]=hu.welt((bU0+bU1)/2,v1);
            const seed=Math.floor(glutHash(sx,y,sz)*4294967295);
            for(let i=0;i<anzahl;i++) baueLaubenkasten(ausgabe,bU0+.15+span*(i+.5)/anzahl,ky+.22,v1+.32,breite,seed+i*7919,
              {holz:REFERENZ_HOLZ,laub:LAUB,bluete:GERANIE,erde});
            // Gleicher Würfelverbrauch wie das frühere 0,7m-Blütenband: Holzstapel usw. bleiben erhalten.
            const gU0=bU0+.12, gU1=bU1-.12;
            const seg=Math.max(2,Math.round((gU1-gU0)/.7));
            for(let i=0;i<seg;i++)wuerfel();
          } else {
            kasten(bU0 + 0.15, bU1 - 0.15, v1 + 0.08, v1 + 0.30, fest(ky), fest(ky + 0.22), KASTEN,
                 { unten: true, u0: true, u1: true, v1: true });
          // Blüten in Segmenten von 0,7 m, rot und Laub im Wechsel — ein
          // durchgehender roter Balken war das Erste, was im Bild stand, und
          // las sich als Markise, nicht als Blumen.
          const gU0 = bU0 + 0.12, gU1 = bU1 - 0.12;
          const seg = Math.max(2, Math.round((gU1 - gU0) / 0.7));
          kasten(gU0, gU1, v1 + 0.06, v1 + 0.34, fest(ky + 0.18), fest(ky + 0.36), LAUB, { oben: true, u0: true, u1: true });
          for (let i = 0; i < seg; i++) {
            const a0 = gU0 + (gU1 - gU0) * i / seg, a1 = gU0 + (gU1 - gU0) * (i + 1) / seg;
            const rot = wuerfel() < 0.6;
            kasten(a0, a1, v1 + 0.06, v1 + 0.36, fest(ky + 0.18), fest(ky + (rot ? 0.42 : 0.34)),
                   rot ? GERANIE : LAUB, { v1: true, oben: rot });
          }
          }
        }
      }
    }

    /**
     * Holzstapel an der Giebelwand (D119) — an jedem zweiten Wohnhaus ab 7 m.
     *
     * Ein Haus, an dem etwas lehnt, ist bewohnt. Der Stapel steht an einer
     * Giebelwand, die es wirklich gibt: gesucht wird eine Grundrisskante, die
     * auf einem Hüllenende liegt (beide Enden innerhalb 0,3 m von `minU` oder
     * `maxU`); ohne so eine Kante gibt es keinen Stapel. Zwei Meter lang,
     * 0,5 m tief, 1,3 m hoch; die Stirn in fünf Lagen mit wechselndem Ton,
     * denn ein Stapel in einer Farbe ist ein Klotz. Auf dem Gelände am Ort
     * des Stapels, nicht auf `boden` — die Giebelseite kann einen halben
     * Meter höher liegen als der tiefste Punkt der Wandlinie.
     */
    if (wohnhaus && breite >= 7 && wuerfel() < 0.5 && bauSchaden === 0) {
      let beste: { u: number; vm: number; s: number } | null = null;
      for (let k = 0; k < p.length - 1; k++) {
        const uA = p[k][0] * hu.cos + p[k][1] * hu.sin, vA = -p[k][0] * hu.sin + p[k][1] * hu.cos;
        const uB = p[k + 1][0] * hu.cos + p[k + 1][1] * hu.sin, vB = -p[k + 1][0] * hu.sin + p[k + 1][1] * hu.cos;
        if (Math.abs(vB - vA) < 2.6) continue;
        for (const [ende, s] of [[minU, -1], [maxU, 1]] as const) {
          if (Math.abs(uA - ende) < 0.3 && Math.abs(uB - ende) < 0.3) beste = { u: ende, vm: (vA + vB) / 2, s };
        }
      }
      if (beste) {
        const { u, vm, s } = beste;
        const u0 = Math.min(u + s * 0.08, u + s * 0.58), u1 = Math.max(u + s * 0.08, u + s * 0.58);
        const [sx, sz] = hu.welt((u0 + u1) / 2, vm);
        const fussY = terrain.hoeheAn(sx, sz) - 0.08, kopfY = fussY + 1.2;
        // Die Stirn als Raster aus Scheitholz-Enden: fuenf Lagen, sieben Scheite,
        // jedes Feld in einem der drei Toene, Nachbarn nie gleich. Fuenf
        // durchgehende Lagen (erster Stand) lasen sich als heller Kasten (D119);
        // erst das Raster macht aus dem Kasten einen Stapel. 70 statt 10 Dreiecke.
        const lagen = 5, scheite = 7, lh = (kopfY - fussY) / lagen, sb = 2.0 / scheite;
        const aussenU = s > 0 ? 'u1' : 'u0';
        let ton = 0;
        for (let l = 0; l < lagen; l++) {
          for (let c = 0; c < scheite; c++) {
            ton = (ton + 1 + Math.floor(wuerfel() * 2)) % 3;
            kasten(u0, u1, vm - 1.0 + c * sb, vm - 1.0 + (c + 1) * sb, fest(fussY + l * lh), fest(fussY + (l + 1) * lh),
                   BRENNHOLZ_TOENE[ton], { [aussenU]: true });
          }
        }
        kasten(u0, u1, vm - 1.0, vm + 1.0, fest(fussY), fest(kopfY), BRENNHOLZ_TOENE[0], { oben: true, v0: true, v1: true });
      }
    }

    /**
     * D291: Farben nach dem Fassaden-Steckbrief. Die Ecken dieses Hauses werden nach ihrer Rolle umgefärbt: Putz (0)
     * und Holz (1) auf die fotografierte Farbe, Läden auf ihre Farbe — das Verhältnis zur Palettenfarbe (gebackene
     * Kontaktabdunklung, Brett-Töne) bleibt erhalten.
     */
    if (g.fassade) {
      const putz = new THREE.Color(g.fassade.putz), holz = new THREE.Color(g.fassade.holz);
      const laden = g.fassade.laeden ? new THREE.Color(g.fassade.laeden) : null;
      const lum = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      for (let e = ersteEcke; e < farben.length / 3; e++) {
        const r = rollen[e];
        const alt = { r: farben[e * 3], g: farben[e * 3 + 1], b: farben[e * 3 + 2] };
        let ziel: THREE.Color | null = null, bezug = 0;
        if (r === 0) { ziel = putz; bezug = lum(WAND); }
        else if (r === 1) { ziel = holz; bezug = lum(SCHALUNG); }
        else if (laden && Math.abs(alt.r / Math.max(1e-4, alt.g) - LADEN.r / LADEN.g) < 0.02
                 && Math.abs(alt.b / Math.max(1e-4, alt.g) - LADEN.b / LADEN.g) < 0.02) { ziel = laden; bezug = lum(LADEN); }
        if (!ziel) continue;
        const k = lum(alt) / Math.max(1e-4, bezug);
        farben[e * 3] = ziel.r * k; farben[e * 3 + 1] = ziel.g * k; farben[e * 3 + 2] = ziel.b * k;
      }
    }
  }

  if (!positionen.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  geo.setAttribute('glut', new THREE.Float32BufferAttribute(glut, 1));
  geo.setAttribute('rolle', new THREE.Float32BufferAttribute(rollen, 1));
  geo.setAttribute('zustand', new THREE.Float32BufferAttribute(zustand, 2));
  if (HAUSFRONT_AN) geo.setAttribute('raumUv', new THREE.Float32BufferAttribute(raumUv, 3));
  geo.computeVertexNormals();
  return geo;
}
