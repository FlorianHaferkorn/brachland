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
import { PALETTE } from './palette.js';
import { gesperrt } from './bauwerke.js';

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
    glut.push(glutWert, glutWert, glutWert);
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

  for (const g of auswahl) {
    const p = g.punkte.map(([lat, lon]) => zuWelt(lat, lon));
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
    const wohnhaus = !garage && !NUTZBAU.has(g.art) && klein <= 16 && breite <= 26 && g.ebenen <= 3;
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
    const brettBreite = Math.max(0.5, umfang / 60);
    const bretterwand = (x1: number, z1: number, x2: number, z2: number, y0: number, y1: number) => {
      const l = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(1, Math.round(l / brettBreite));
      let ton = Math.floor(wuerfel() * 5);
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        ton = (ton + 1 + Math.floor(wuerfel() * 4)) % 5;
        quad([x1 + (x2 - x1) * t0, y0, z1 + (z2 - z1) * t0], [x1 + (x2 - x1) * t1, y0, z1 + (z2 - z1) * t1],
             [x1 + (x2 - x1) * t1, y1, z1 + (z2 - z1) * t1], [x1 + (x2 - x1) * t0, y1, z1 + (z2 - z1) * t0],
             SCHALUNG_TOENE[ton]);
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
    const holzAb = g.ebenen >= 2 && !garage
      ? boden + (g.ebenen - 1) * METER_JE_EBENE
      : Infinity;

    // Wände
    for (let k = 0; k < p.length - 1; k++) {
      const [x1, z1] = p[k], [x2, z2] = p[k + 1];
      const oben = boden + h;
      if (holzAb < oben && holzAb > fuss) {
        quad([x1, fuss, z1], [x2, fuss, z2], [x2, holzAb, z2], [x1, holzAb, z1], WAND);
        if (wohnhaus) bretterwand(x1, z1, x2, z2, holzAb, oben);
        else quad([x1, holzAb, z1], [x2, holzAb, z2], [x2, oben, z2], [x1, oben, z1], SCHALUNG);
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
            // Helle Fasche statt Sockelton (D119): Ein Rahmen, der dunkler ist als
            // die Wand, rahmt nichts — er war gegen den Fensterschwarz unsichtbar.
            wohnhaus ? RAHMEN : SOCKEL,
          );
          // Hinter knapp der Haelfte der Wohnhausfenster brennt nachts Licht,
          // in Staellen und Hallen hinter jedem achten (D134).
          glutWert = glutHash(cx, yUnten, cz) < (wohnhaus ? 0.45 : 0.12) ? 1 : 0;
          quad(
            [cx - ex + nx * o, yUnten, cz - ez + nz * o],
            [cx + ex + nx * o, yUnten, cz + ez + nz * o],
            [cx + ex + nx * o, yUnten + hoeheF, cz + ez + nz * o],
            [cx - ex + nx * o, yUnten + hoeheF, cz - ez + nz * o],
            FENSTER,
          );
          glutWert = 0;
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
          const lb = 0.40, o2 = o + 0.01;
          for (const s of [-1, 1]) {
            const a0 = s * (breiteF / 2 + r + 0.03), a1 = a0 + s * lb;
            const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
            quad([cx + dx * lo + nx * o2, yUnten - 0.02, cz + dz * lo + nz * o2],
                 [cx + dx * hi + nx * o2, yUnten - 0.02, cz + dz * hi + nz * o2],
                 [cx + dx * hi + nx * o2, yUnten + hoeheF + 0.02, cz + dz * hi + nz * o2],
                 [cx + dx * lo + nx * o2, yUnten + hoeheF + 0.02, cz + dz * lo + nz * o2], LADEN);
          }
          if (ebene >= 1 && k === tuerWand) {
            const kv = o + 0.24, ky0 = bankY - 0.18, ky1 = bankY;
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
            quadNach([cx - gx + nx * (o + 0.06), ky1 + 0.12, cz - gz + nz * (o + 0.06)],
                     [cx + gx + nx * (o + 0.06), ky1 + 0.12, cz + gz + nz * (o + 0.06)],
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
    /** Weltrichtungen der Hüllenachsen, für `quadNach`. */
    const [ux, uz] = hu.welt(1, 0), [vx, vz] = hu.welt(0, 1);
    const richtU = (s: number): [number, number, number] => [s * ux, 0, s * uz];
    const richtV = (s: number): [number, number, number] => [s * vx, 0, s * vz];
    const OBEN: [number, number, number] = [0, 1, 0], UNTEN: [number, number, number] = [0, -1, 0];
    const dachHaut = (versatz: number, farbe: THREE.Color, seite: [number, number, number]) => {
      quadNach(welt3(aU0, traufe + versatz, aV0), welt3(aU1, traufe + versatz, aV0),
               welt3(aU1, firstH + versatz, mv), welt3(aU0, firstH + versatz, mv), farbe, seite);
      quadNach(welt3(aU1, traufe + versatz, aV1), welt3(aU0, traufe + versatz, aV1),
               welt3(aU0, firstH + versatz, mv), welt3(aU1, firstH + versatz, mv), farbe, seite);
    };
    // First läuft über u, die lange Achse. Die Fallunterscheidung von früher ist
    // weg — die Drehung erledigt, was vorher zwei Zweige tun mussten.
    dachHaut(dick, DACH, OBEN);
    // Untersicht: dieselbe Fläche tiefer. Wer unter dem Überstand steht, sieht
    // sonst durch das Dach hindurch. Seit D119 in Schalungston statt in
    // `TUER`: Die Sparren darunter sind dunkel, und dunkel vor dunkel ist
    // nichts — im Bestand ist die Untersicht ohnehin verschalt, hell, und die
    // Kontaktabdunklung unter der Traufe (D116) nimmt ihr das Grelle.
    dachHaut(0, SCHALUNG_TOENE[1], UNTEN);
    // Traufkanten — die beiden waagerechten Stirnflächen.
    quadNach(welt3(aU0, traufe, aV0), welt3(aU1, traufe, aV0),
             welt3(aU1, traufe + dick, aV0), welt3(aU0, traufe + dick, aV0), TUER, richtV(-1));
    quadNach(welt3(aU1, traufe, aV1), welt3(aU0, traufe, aV1),
             welt3(aU0, traufe + dick, aV1), welt3(aU1, traufe + dick, aV1), TUER, richtV(1));
    // Ortgang — die vier schrägen Kanten über den Giebeln.
    for (const u of [aU0, aU1]) {
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
      for (let s = 0; s + 1 < teiler.length; s++) {
        const t0 = teiler[s], t1 = teiler[s + 1];
        const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0;
        const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
        const y0 = dachY(vA + (vB - vA) * t0), y1 = dachY(vA + (vB - vA) * t1);
        // Liegt das Teilstück an der Traufe, gibt es dort keinen Giebel.
        if (y0 - traufe < 0.02 && y1 - traufe < 0.02) continue;
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
      const sparrenY = (v: number) => dachY(v) - 0.02;
      const zahl = Math.min(wohnhaus ? 10 : 6, Math.max(2, Math.floor(breite / 1.1)));
      const schritt = breite / zahl;
      for (let i = 0; i < zahl; i++) {
        const u = minU + schritt * (i + 0.5);
        const sb = 0.08;
        // Traufseite aV0 und aV1: vom Dachrand bis 0,25 m unter die Wand.
        kasten(u - sb, u + sb, aV0 + 0.02, minV + 0.25, (_u, v) => sparrenY(v) - 0.22, (_u, v) => sparrenY(v), SPARREN,
               { unten: true, u0: true, u1: true, v0: true });
        kasten(u - sb, u + sb, maxV - 0.25, aV1 - 0.02, (_u, v) => sparrenY(v) - 0.22, (_u, v) => sparrenY(v), SPARREN,
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
          quadNach(welt3(aU0, dachY(vA) + dick + 0.03, vA), welt3(aU1, dachY(vA) + dick + 0.03, vA),
                   welt3(aU1, dachY(vB) + dick + 0.03, vB), welt3(aU0, dachY(vB) + dick + 0.03, vB), DACH_KANTE, OBEN);
        }
      }
      for (const s of [-1, 1]) {
        const vB = mv + s * 0.20;
        quadNach(welt3(aU0, firstH + dick + 0.06, mv), welt3(aU1, firstH + dick + 0.06, mv),
                 welt3(aU1, dachY(vB) + dick + 0.02, vB), welt3(aU0, dachY(vB) + dick + 0.02, vB), DACH_KANTE, OBEN);
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
      kasten(aU0, aU1, aV0 - 0.05, aV0 + 0.08, fest(ry - 0.12), fest(ry), RINNE, { unten: true, v0: true, v1: true });
      kasten(aU0, aU1, aV1 - 0.08, aV1 + 0.05, fest(ry - 0.12), fest(ry), RINNE, { unten: true, v0: true, v1: true });
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
        kasten(u0, u0 + 0.12, v0, v0 + 0.12, fest(boden), fest(ry - 0.12), RINNE,
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
        // Der Balkon liegt an einer Wand, deren Aussenseite nach +V zeigt —
        // alles hier richtet sich also nach +V, nach oben oder nach unten.
        const VOR = richtV(1);
        // Boden: von oben (vom Hang aus) und von unten (von der Strasse aus)
        // sichtbar, also beide Seiten.
        quadNach(welt3(bU0, y, v0), welt3(bU1, y, v0), welt3(bU1, y, v1), welt3(bU0, y, v1), SCHALUNG, OBEN);
        quadNach(welt3(bU0, y - 0.08, v0), welt3(bU1, y - 0.08, v0), welt3(bU1, y - 0.08, v1), welt3(bU0, y - 0.08, v1), TUER, UNTEN);
        // Fußleiste und Handlauf — die zwei Waagerechten.
        quadNach(welt3(bU0, y + 0.04, v1), welt3(bU1, y + 0.04, v1),
                 welt3(bU1, y + 0.22, v1), welt3(bU0, y + 0.22, v1), SCHALUNG, VOR);
        quadNach(welt3(bU0, y + bruest - 0.13, v1 + 0.06), welt3(bU1, y + bruest - 0.13, v1 + 0.06),
                 welt3(bU1, y + bruest, v1 + 0.06), welt3(bU0, y + bruest, v1 + 0.06), TUER, VOR);
        // Bretter dazwischen. Alle 0,42 m, gedeckelt bei 16: An einem 14-m-Haus
        // wären es sonst 33, und ab etwa 20 sieht man den Unterschied nicht mehr.
        const bretter = Math.min(16, Math.max(3, Math.round((bU1 - bU0) / 0.42)));
        const bb = (bU1 - bU0) / bretter * 0.55;
        for (let i = 0; i < bretter; i++) {
          const cu = bU0 + (bU1 - bU0) * (i + 0.5) / bretter;
          quadNach(welt3(cu - bb / 2, y + 0.2, v1 + 0.01), welt3(cu + bb / 2, y + 0.2, v1 + 0.01),
                   welt3(cu + bb / 2, y + bruest - 0.12, v1 + 0.01),
                   welt3(cu - bb / 2, y + bruest - 0.12, v1 + 0.01), SCHALUNG_TOENE[(i * 2) % 5], VOR);
        }
        // Zwei Stützen bis zum Boden — ohne sie schwebt der Balkon, mit fester
        // Länge hängen sie in der Luft.
        for (const u of [bU0 + 0.35, bU1 - 0.35]) {
          kasten(u - 0.07, u + 0.07, v1 - 0.19, v1 - 0.05, fest(boden), fest(y), TUER,
                 { u0: true, u1: true, v1: true });
        }
        /**
         * Eckpfosten und Geranienkasten (D119). Die Pfosten schliessen die
         * Brüstung an den Enden — ohne sie endet das Brett in der Luft. Der
         * Kasten hängt aussen am Handlauf über die ganze Länge; der Balkon ist
         * im Bestand der Ort, an dem die Geranien hängen, nicht das Fenster.
         */
        for (const u of [bU0, bU1]) {
          kasten(u - 0.06, u + 0.06, v1 - 0.06, v1 + 0.08, fest(y), fest(y + bruest + 0.06), TUER,
                 { oben: true, u0: true, u1: true, v1: true });
        }
        if (wohnhaus) {
          const ky = y + bruest - 0.42;
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
    if (wohnhaus && breite >= 7 && wuerfel() < 0.5) {
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
  }

  if (!positionen.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  geo.setAttribute('glut', new THREE.Float32BufferAttribute(glut, 1));
  geo.computeVertexNormals();
  return geo;
}
