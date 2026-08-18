/**
 * BRACHLAND — Terrain-Detail: LOD-Kacheln und prozedurale Mikrorelief
 *
 * Das Problem, das 1:1-Maßstab freigelegt hat: EU-DEM liefert Stützpunkte alle 25 m.
 * Aus 6 m Kameraabstand steht der Spieler damit auf einer einzigen großen Fläche.
 *
 * Zwei Antworten, beide nötig:
 *   1. Zwischen den DEM-Stützpunkten wird bilinear interpoliert und mit
 *      deterministischem Rauschen aufgebrochen — Detail unterhalb der Datenauflösung.
 *   2. Das Terrain wird in Kacheln zerlegt, deren Dichte von der Kameraentfernung
 *      abhängt. Nah fein, fern grob.
 *
 * Das Rauschen erfindet Gelände, das es real nicht gibt. Zulässig, weil es die
 * Großform nicht verändert (Amplitude < 1,2 m) — der Wiedererkennungseffekt hängt
 * an Flusslauf, Kamm und Terrasse, nicht an Bodenwellen.
 */
import * as THREE from 'three';
import type { Weltdaten, Biom } from './osm.js';
import { MASSSTAB, BIOM_FARBE } from './terrain.js';
import type { Aufsatzboden } from './terrain.js';
import { baueWasserfeld } from './wasserfeld.js';

/** Kachelkantenlänge in Metern. */
export const KACHEL = 64;

/** Auflösungsstufen: Abstand bis, Vertexabstand in Metern. */
export const LOD_STUFEN = [
  { bisMeter: 90,   schritt: 2 },
  { bisMeter: 220,  schritt: 4 },
  { bisMeter: 420,  schritt: 8 },
  { bisMeter: 900,  schritt: 16 },
  { bisMeter: Infinity, schritt: 32 },
] as const;

// ------------------------------------------------------------- Rauschen

/** Deterministisches Wertrauschen — gleicher Punkt ergibt immer denselben Wert. */
function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const glaetten = (t: number) => t * t * (3 - 2 * t);

function wertrauschen(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = glaetten(x - xi), yf = glaetten(y - yi);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
}

/** Mehrere Oktaven — grobe Wellen plus feine Unebenheit. */
export function mikrorelief(x: number, z: number): number {
  let summe = 0, amplitude = 1, frequenz = 1 / 26, norm = 0;
  for (let o = 0; o < 4; o++) {
    summe += (wertrauschen(x * frequenz, z * frequenz) - 0.5) * amplitude;
    norm += amplitude;
    amplitude *= 0.45;
    frequenz *= 2.3;
  }
  return summe / norm;
}

// -------------------------------------------------- Höhe mit Zwischenwerten

export interface HoehenFeld {
  /**
   * Höhe der **Geländeoberfläche** an beliebiger Weltposition, inkl. Interpolation,
   * Mikrorelief und **ausgeschnittenem Gewässerbett**.
   *
   * Das Bett ist neu und war der eigentliche Grund, warum Wasser sich nicht wie
   * Wasser anfühlte: Das Wasserband lag 30 cm **über** dem Gelände. Es gab keine
   * Mulde, also konnte man auch nicht einsinken — man lief über eine blaue Platte.
   *
   * Weil alles, was aufsitzt, aus dieser einen Funktion liest (D20), sinkt die
   * Figur jetzt von selbst ein: Sie folgt dem Boden, und der Boden geht hinunter.
   */
  hoehe: (x: number, z: number) => number;
  /**
   * Wassertiefe an einer Position, 0 heißt trocken.
   *
   * Der Wasserspiegel ist `hoehe(x,z) + wasserTiefe(x,z)` — also die Höhe, die das
   * Gelände ohne Bett hätte. Eine zweite gespeicherte Höhe wäre Drift; abgeleitet
   * kann sie nicht auseinanderlaufen.
   */
  wasserTiefe: (x: number, z: number) => number;
  /** Stehende Gewässer als Polygone in Weltkoordinaten — für die Wasserfläche. */
  teiche: { punkte: [number, number][]; tiefe: number }[];
  biom: (x: number, z: number) => Biom;
  breiteMeter: number;
  tiefeMeter: number;
}

const METER_JE_GRAD = 111_320;

export function baueHoehenfeld(welt: Weltdaten, mikroStaerke = 1.1): HoehenFeld {
  const [sued, west, nord, ost] = welt.bbox;
  const n = welt.aufloesung;
  const mittelLat = (sued + nord) / 2;
  const breiteMeter = (ost - west) * METER_JE_GRAD * Math.cos(mittelLat * Math.PI / 180) / MASSSTAB.stauchung;
  const tiefeMeter  = (nord - sued) * METER_JE_GRAD / MASSSTAB.stauchung;

  const gueltig = welt.hoehen.flat().filter(h => !Number.isNaN(h));
  const mittel = gueltig.reduce((a, b) => a + b, 0) / Math.max(1, gueltig.length);
  const H = welt.hoehen.map(z => z.map(x => (Number.isNaN(x) ? mittel : x)));

  const roh = (i: number, j: number) =>
    (H[Math.max(0, Math.min(n - 1, i))][Math.max(0, Math.min(n - 1, j))] - welt.hoeheMin)
    * MASSSTAB.ueberhoehung / MASSSTAB.stauchung;

  // Wasser braucht die Ausdehnung, die hier gerade berechnet wurde — deshalb hier
  // und nicht in der Szene. Ein zweites Wasserfeld an anderer Stelle wäre die Art
  // von Doppelung, an der schon die Höhenquellen einmal auseinandergelaufen sind.
  const wasser = baueWasserfeld(welt, breiteMeter, tiefeMeter);

  const hoehe = (x: number, z: number): number => {
    // Rasterkoordinate mit Nachkommaanteil
    const fj = (x / breiteMeter + 0.5) * (n - 1);
    const fi = (z / tiefeMeter + 0.5) * (n - 1);
    const j0 = Math.floor(fj), i0 = Math.floor(fi);
    const tx = glaetten(fj - j0), tz = glaetten(fi - i0);

    // Bilineare Interpolation zwischen den DEM-Stützpunkten
    const h00 = roh(i0, j0), h10 = roh(i0, j0 + 1);
    const h01 = roh(i0 + 1, j0), h11 = roh(i0 + 1, j0 + 1);
    const basis = (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;

    // Mikrorelief stärker auf Hängen, schwächer in der Ebene — auf einer Wiese
    // wären Buckel unnatürlich, an einem Steilhang sind sie es nicht.
    const neigung = Math.min(1, (Math.abs(h10 - h00) + Math.abs(h01 - h00)) / 12);
    const staerke = mikroStaerke * (0.45 + 0.85 * neigung);
    // Das Bett wird abgezogen, nicht dazugerechnet: Der Wasserspiegel bleibt dort,
    // wo das Gelände vorher war, und die Sohle geht darunter. Andersherum stünde
    // das Wasser als Wall in der Landschaft.
    return basis + mikrorelief(x, z) * staerke - wasser.tiefeAn(x, z);
  };

  const biom = (x: number, z: number): Biom => {
    const j = Math.max(0, Math.min(n - 1, Math.round((x / breiteMeter + 0.5) * (n - 1))));
    const i = Math.max(0, Math.min(n - 1, Math.round((z / tiefeMeter + 0.5) * (n - 1))));
    return welt.biome[i][j];
  };

  return {
    hoehe, biom, breiteMeter, tiefeMeter,
    wasserTiefe: wasser.tiefeAn, teiche: wasser.teiche,
  };
}

/**
 * Höhe der **gezeichneten** Oberfläche an einer Weltposition.
 *
 * `feld.hoehe` liefert die stetige Funktion. Gezeichnet wird aber ein Dreiecksnetz
 * mit Vertices im LOD0-Abstand (2 m) — dazwischen ist die Fläche linear interpoliert
 * und liegt auf Kuppen unter der Funktion. Wer eine Figur auf `feld.hoehe` setzt,
 * lässt sie dort schweben.
 *
 * Das Vertexraster beginnt bei `-breiteMeter/2` und läuft in Schritten von `schritt`
 * — nicht bei 0. `breiteMeter` kommt aus der bbox und ist kein Vielfaches von 2,
 * also war ein Raster auf `Math.floor(x/s)*s` gegenüber dem gezeichneten Netz
 * verschoben. Kleiner Fehler, aber einer, der sich nicht wegmitteln lässt.
 *
 * `schritt` ist voreingestellt auf LOD0. Wer wissen will, wie die Fläche in der
 * Ferne liegt, gibt den gröberen Schritt an — dort steht die Aufsatzgeometrie
 * nämlich auf einem anderen Netz (`npm run aufsatz`).
 */
export function hoeheAufFlaeche(
  feld: HoehenFeld, x: number, z: number, schritt: number = LOD_STUFEN[0].schritt,
): number {
  return aufNetz(feld.hoehe, feld, x, z, schritt);
}

/**
 * Der **Wasserspiegel** auf der gezeichneten Fläche.
 *
 * Nicht `hoeheAufFlaeche + wasserTiefe`. Das Bett ist 4 m breit; ein Netz mit 32 m
 * Vertexabstand hat es schlicht nicht. Rechnete man die volle Bettiefe auf eine
 * Fläche, in der gar keine Mulde steckt, stünde das Band in der Ferne 85 cm über
 * dem Boden — der Fehler, den man vorher mit einer Böschung zudecken musste.
 *
 * Richtig ist, die **Fläche ohne Bett** auf demselben Netz abzutasten. Dann
 * verschwindet die Tiefe von selbst, sobald das Netz sie nicht mehr auflöst.
 */
export function spiegelAufFlaeche(
  feld: HoehenFeld, x: number, z: number, schritt: number = LOD_STUFEN[0].schritt,
): number {
  return aufNetz((px, pz) => feld.hoehe(px, pz) + feld.wasserTiefe(px, pz), feld, x, z, schritt);
}

/**
 * Eine Höhenfunktion auf dem Vertexraster der Kacheln abtasten und **auf dem
 * Dreieck** interpolieren.
 *
 * `baueKachelGeometrie` teilt jede Zelle entlang der Nebendiagonale p01–p10. Eine
 * bilineare Fläche liegt dazwischen und weicht um bis zu |h00+h11-h01-h10|/4 ab —
 * auf 32 m Zellweite ist das ein Meter. Gegen die wirklich gebaute Geometrie
 * gemessen liegt diese Fassung bei 0,0000 m, die bilineare lag darüber.
 */
function aufNetz(
  f: (x: number, z: number) => number,
  feld: HoehenFeld, x: number, z: number, s: number,
): number {
  const ux = -feld.breiteMeter / 2, uz = -feld.tiefeMeter / 2;
  const x0 = Math.floor((x - ux) / s) * s + ux, z0 = Math.floor((z - uz) / s) * s + uz;
  const fx = (x - x0) / s, fz = (z - z0) / s;
  return fx + fz <= 1
    ? f(x0, z0) + (f(x0 + s, z0) - f(x0, z0)) * fx + (f(x0, z0 + s) - f(x0, z0)) * fz
    : f(x0 + s, z0 + s)
      + (f(x0, z0 + s) - f(x0 + s, z0 + s)) * (1 - fx)
      + (f(x0 + s, z0) - f(x0 + s, z0 + s)) * (1 - fz);
}

/**
 * Die eine Höhenquelle für alles, was auf dem Gelände aufsitzt.
 *
 * Vorher hat sich jeder Aufrufer sein eigenes Objekt zusammengebaut — die Szene
 * `{...terrain, hoeheAn: feld.hoehe}`, die Werkzeuge das rohe `terrain` mit dem
 * groben Raster. Zwei Aufrufer, zwei Höhen, und die Messung prüfte die falsche.
 * Wer jetzt ein Band bauen will, muss hier durch.
 *
 * `spiegel: true` liefert die Wasseroberfläche statt der Geländeoberfläche: Seit
 * D63 ist `feld.hoehe` im Bach die **Sohle**, der Spiegel liegt eine Bettiefe
 * darüber — genau dort, wo das Gelände ohne Bett läge.
 */
/**
 * Bis zu welcher LOD-Stufe die Schürze das Wegfallen des Bodens auffängt.
 *
 * LOD4 bewusst nicht. Es gilt erst ab 900 m Kameraabstand, und dort ist ein Meter
 * Lücke rund einen Pixel hoch — dafür würde die Schürze fast an **jedem** Segment
 * gebaut, weil auf 32 m Vertexabstand irgendwo immer Gelände wegfällt. Gemessen:
 * mit LOD4 wachsen die Wege von 93.000 auf 239.000 Dreiecke, und das Wegband ist
 * ein einziges Mesh — es wird komplett gezeichnet, sobald ein Zipfel im Bild ist.
 */
const SCHUERZE_BIS_LOD = 3;

export function aufsatzboden(feld: HoehenFeld, spiegel = false): Aufsatzboden {
  return {
    breiteMeter: feld.breiteMeter,
    tiefeMeter: feld.tiefeMeter,
    hoeheAn: spiegel
      ? (x, z) => feld.hoehe(x, z) + feld.wasserTiefe(x, z)
      : (x, z) => feld.hoehe(x, z),
    tiefsteFlaeche: (x, z) => {
      let tiefste = Infinity;
      for (let i = 0; i <= SCHUERZE_BIS_LOD; i++)
        tiefste = Math.min(tiefste, hoeheAufFlaeche(feld, x, z, LOD_STUFEN[i].schritt));
      return tiefste;
    },
  };
}

// ------------------------------------------------------------- Kacheln

export interface Kachel {
  /** Kachelindex im Raster. */
  ix: number; iz: number;
  mitte: [number, number];
  radius: number;
}

export function baueKachelraster(feld: HoehenFeld): Kachel[] {
  const nx = Math.ceil(feld.breiteMeter / KACHEL);
  const nz = Math.ceil(feld.tiefeMeter / KACHEL);
  const kacheln: Kachel[] = [];
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      kacheln.push({
        ix, iz,
        mitte: [
          -feld.breiteMeter / 2 + (ix + 0.5) * KACHEL,
          -feld.tiefeMeter / 2 + (iz + 0.5) * KACHEL,
        ],
        radius: KACHEL * 0.71,
      });
    }
  }
  return kacheln;
}

export function lodFuerAbstand(abstand: number): number {
  for (let i = 0; i < LOD_STUFEN.length; i++)
    if (abstand <= LOD_STUFEN[i].bisMeter) return i;
  return LOD_STUFEN.length - 1;
}

/**
 * Geometrie einer Kachel in einer LOD-Stufe.
 *
 * Mit Schürze: An den Rändern werden die Vertices nach unten gezogen. Ohne das
 * klaffen zwischen benachbarten LOD-Stufen sichtbare Risse, weil die feinere
 * Kachel Zwischenpunkte hat, die der gröberen fehlen.
 *
 * **Die Tiefe hängt an der LOD-Stufe, nicht an einer festen Zahl.** Gemessene
 * Risse (16.08.2026):
 *
 * ```
 *   LOD0/1 ( 2→ 4 m):  Mittel 0,03 m   Maximum 0,20 m
 *   LOD1/2 ( 4→ 8 m):  Mittel 0,12 m   Maximum 0,77 m
 *   LOD2/3 ( 8→16 m):  Mittel 0,38 m   Maximum 2,54 m
 *   LOD3/4 (16→32 m):  Mittel 1,01 m   Maximum 6,97 m
 * ```
 *
 * Eine feste Schürze von 3 m war im Nahbereich 15-fach überdimensioniert und in
 * der Ferne zu klein. Das ist keine Kosmetik: Die überschüssige Tiefe erzeugt am
 * Kachelrand eine senkrechte Wand, die mit Flat Shading fast kein Licht abbekommt
 * und bei flachem Blickwinkel als dunkles Rechteckraster im Boden erscheint —
 * genau der Fehler, der als G-8 zwei Fehldiagnosen überstanden hat.
 */
export function baueKachelGeometrie(
  feld: HoehenFeld, kachel: Kachel, lod: number, schuerzeTiefeFest?: number,
): THREE.BufferGeometry {
  const schritt = LOD_STUFEN[Math.min(lod, LOD_STUFEN.length - 1)].schritt;
  // 0,45 × Schritt deckt den gemessenen Maximalriss jeder Stufe mit Reserve.
  const schuerzeTiefe = schuerzeTiefeFest ?? schritt * 0.45;
  const teile = Math.max(1, Math.round(KACHEL / schritt));
  const x0 = kachel.mitte[0] - KACHEL / 2;
  const z0 = kachel.mitte[1] - KACHEL / 2;

  const positionen: number[] = [];
  const farben: number[] = [];
  const farbe = new THREE.Color();

  const punkt = (a: number, b: number): [number, number, number] => {
    const x = x0 + (a / teile) * KACHEL;
    const z = z0 + (b / teile) * KACHEL;
    return [x, feld.hoehe(x, z), z];
  };

  const dreieck = (p: [number, number, number][], biomQuelle: [number, number]) => {
    for (const [x, y, z] of p) positionen.push(x, y, z);
    farbe.set(BIOM_FARBE[feld.biom(biomQuelle[0], biomQuelle[1])]);
    const jitter = 0.93 + hash2(Math.round(biomQuelle[0]), Math.round(biomQuelle[1])) * 0.14;
    for (let k = 0; k < 3; k++) farben.push(farbe.r * jitter, farbe.g * jitter, farbe.b * jitter);
  };

  for (let b = 0; b < teile; b++) {
    for (let a = 0; a < teile; a++) {
      const p00 = punkt(a, b), p10 = punkt(a + 1, b);
      const p01 = punkt(a, b + 1), p11 = punkt(a + 1, b + 1);
      const mitte: [number, number] = [(p00[0] + p11[0]) / 2, (p00[2] + p11[2]) / 2];
      dreieck([p00, p01, p10], mitte);
      dreieck([p10, p01, p11], mitte);
    }
  }

  // Schürze rundherum
  const rand: [number, number][] = [];
  for (let a = 0; a <= teile; a++) rand.push([a, 0]);
  for (let b = 1; b <= teile; b++) rand.push([teile, b]);
  for (let a = teile - 1; a >= 0; a--) rand.push([a, teile]);
  for (let b = teile - 1; b >= 1; b--) rand.push([0, b]);
  for (let k = 0; k < rand.length; k++) {
    const p1 = punkt(...rand[k]);
    const p2 = punkt(...rand[(k + 1) % rand.length]);
    const u1: [number, number, number] = [p1[0], p1[1] - schuerzeTiefe, p1[2]];
    const u2: [number, number, number] = [p2[0], p2[1] - schuerzeTiefe, p2[2]];
    const mitte: [number, number] = [(p1[0] + p2[0]) / 2, (p1[2] + p2[2]) / 2];
    dreieck([p1, u1, p2], mitte);
    dreieck([p2, u1, u2], mitte);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Dreieckszahl einer Kachel je LOD — für Budgetrechnungen. */
export function dreieckeJeKachel(lod: number): number {
  const schritt = LOD_STUFEN[Math.min(lod, LOD_STUFEN.length - 1)].schritt;
  const teile = Math.max(1, Math.round(KACHEL / schritt));
  return teile * teile * 2 + teile * 4 * 2;
}
