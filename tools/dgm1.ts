/**
 * BRACHLAND — Höhendaten aus dem bayerischen DGM1
 *
 * Ersetzt EU-DEM (25 m Raster, über eine Web-API punktweise abgefragt) durch das
 * **1-Meter-Geländemodell der Bayerischen Vermessungsverwaltung**. Der Unterschied
 * ist keine Politur: EU-DEM löst einen Wanderweg, eine Geländekante oder einen
 * Bachlauf schlicht nicht auf. Bei einem Spiel, dessen ganze Prämisse „reale
 * Geographie im Maßstab 1:1" lautet, ist das die teuerste offene Ungenauigkeit.
 *
 * Zwei weitere Unterschiede, die zählen:
 * - **DGM statt DSM.** DGM1 ist der *Boden*. Copernicus und ähnliche Modelle sind
 *   Oberflächenmodelle und enthalten Baumkronen — im Wald mehrere Meter zu hoch.
 *   Wir setzen Bäume selbst darauf; sie zweimal zu haben wäre falsch.
 * - **Kein Dienst dazwischen.** Die Kacheln liegen als statische Dateien auf einem
 *   CDN. Kein Schlüssel, kein Ratenlimit, kein Anbieter, der morgen abschaltet.
 *
 * Lizenz: CC BY 4.0. Der Quellenvermerk gehört in die Anwendung —
 * siehe `QUELLE` unten und `docs/QUELLEN.md`.
 *
 * Nur für den Bauschritt: Dieses Modul liest Dateien und ist nicht Teil des Bundles.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';
import type { BBox } from '../src/world/osm.js';

export const QUELLE = 'Bayerische Vermessungsverwaltung – www.geodaten.bayern.de (DGM1, CC BY 4.0, bearbeitet)';

const UTM32 = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';
const nachUtm = proj4(WGS84, UTM32);

/** Eine Kachel deckt 1 km x 1 km bei 1 m Auflösung ab. */
const KACHEL_M = 1000;
const SPIEGEL = ['https://download1.bayernwolke.de', 'https://download2.bayernwolke.de'];
const NODATA = -9999;

const ORDNER = '.cache/dgm1';

/** Lädt eine Kachel und legt sie im Zwischenspeicher ab. Zwei Spiegel, drei Versuche. */
async function holeKachel(e: number, n: number): Promise<Uint8Array | null> {
  const name = `${e}_${n}.tif`;
  const pfad = join(ORDNER, name);
  if (existsSync(pfad)) return new Uint8Array(readFileSync(pfad));

  for (let versuch = 0; versuch < SPIEGEL.length * 2; versuch++) {
    const host = SPIEGEL[versuch % SPIEGEL.length];
    try {
      const r = await fetch(`${host}/a/dgm/dgm1/${name}`);
      // 404 heißt: Diese Kachel gibt es nicht (Rand, Ausland). Kein Fehler.
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      mkdirSync(ORDNER, { recursive: true });
      writeFileSync(pfad, bytes);
      return bytes;
    } catch (fehler) {
      if (versuch === SPIEGEL.length * 2 - 1) throw fehler;
      await new Promise(res => setTimeout(res, 800 * (versuch + 1)));
    }
  }
  return null;
}

export interface HoehenErgebnis {
  raster: number[][];
  kacheln: number;
  fehlend: number;
  /** Anteil der Rasterpunkte ohne Messwert. */
  luecken: number;
}

/**
 * Baut ein Höhenraster über der BBox.
 *
 * Vorgehen: BBox in UTM32 umrechnen, alle berührten Kilometerkacheln laden, dann
 * je Rasterpunkt **bilinear** zwischen den vier umliegenden Meterwerten
 * interpolieren. Nearest Neighbour würde bei 15 m Rasterweite sichtbare Treppen
 * erzeugen — und zwar genau an Geländekanten, wo es am meisten auffällt.
 */
export async function holeHoehenDgm1(
  bbox: BBox, aufloesung: number, protokoll: (t: string) => void = console.log,
): Promise<HoehenErgebnis> {
  const [sued, west, nord, ost] = bbox;

  // Alle vier Ecken umrechnen: In UTM ist ein Lat/Lon-Rechteck leicht gedreht.
  const ecken = [[west, sued], [ost, sued], [ost, nord], [west, nord]]
    .map(([lon, lat]) => nachUtm.forward([lon, lat]));
  const eMin = Math.min(...ecken.map(p => p[0])), eMax = Math.max(...ecken.map(p => p[0]));
  const nMin = Math.min(...ecken.map(p => p[1])), nMax = Math.max(...ecken.map(p => p[1]));

  const kE0 = Math.floor(eMin / KACHEL_M), kE1 = Math.floor(eMax / KACHEL_M);
  const kN0 = Math.floor(nMin / KACHEL_M), kN1 = Math.floor(nMax / KACHEL_M);
  const gesamt = (kE1 - kE0 + 1) * (kN1 - kN0 + 1);
  protokoll(`  ${gesamt} Kacheln (E ${kE0}–${kE1}, N ${kN0}–${kN1}), je 1 km² zu 1 m`);

  const kacheln = new Map<string, Float32Array>();
  let geladen = 0, fehlend = 0;
  for (let e = kE0; e <= kE1; e++) {
    for (let n = kN0; n <= kN1; n++) {
      const bytes = await holeKachel(e, n);
      if (!bytes) { fehlend++; continue; }
      const tiff = await fromArrayBuffer(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      const bild = await tiff.getImage();
      const [daten] = await bild.readRasters() as unknown as Float32Array[];
      kacheln.set(`${e}:${n}`, daten);
      geladen++;
      if (geladen % 5 === 0) protokoll(`    ${geladen}/${gesamt} geladen`);
    }
  }
  protokoll(`  ${geladen} Kacheln gelesen, ${fehlend} nicht vorhanden`);

  /** Höhe an einer UTM-Koordinate, bilinear zwischen vier Metermesswerten. */
  const hoeheAn = (e: number, n: number): number => {
    const kE = Math.floor(e / KACHEL_M), kN = Math.floor(n / KACHEL_M);
    // Pixel (0,0) liegt links OBEN, die Nordwerte laufen also andersherum.
    const px = e - kE * KACHEL_M;
    const py = (kN + 1) * KACHEL_M - n;

    const lies = (gx: number, gy: number): number => {
      const tE = kE + Math.floor(gx / KACHEL_M), tN = kN - Math.floor(gy / KACHEL_M);
      const d = kacheln.get(`${tE}:${tN}`);
      if (!d) return NaN;
      const ix = ((gx % KACHEL_M) + KACHEL_M) % KACHEL_M;
      const iy = ((gy % KACHEL_M) + KACHEL_M) % KACHEL_M;
      const v = d[Math.round(iy) * KACHEL_M + Math.round(ix)];
      return v === NODATA ? NaN : v;
    };

    const x0 = Math.floor(px), y0 = Math.floor(py);
    const fx = px - x0, fy = py - y0;
    const a = lies(x0, y0), b = lies(x0 + 1, y0), c = lies(x0, y0 + 1), d = lies(x0 + 1, y0 + 1);
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) return a;
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };

  const raster: number[][] = [];
  let luecken = 0;
  for (let i = 0; i < aufloesung; i++) {
    const zeile: number[] = [];
    for (let j = 0; j < aufloesung; j++) {
      // Dasselbe Schema wie bisher: Zeile 0 ist Norden, Spalte 0 ist Westen.
      const lat = nord - (nord - sued) * (i / (aufloesung - 1));
      const lon = west + (ost - west) * (j / (aufloesung - 1));
      const [e, n] = nachUtm.forward([lon, lat]);
      const h = hoeheAn(e, n);
      if (Number.isNaN(h)) luecken++;
      // Auf Dezimeter runden: Ein Zehntelmeter ist unter der Sichtbarkeitsschwelle
      // und spart in der JSON-Datei rund die Hälfte der Zeichen.
      zeile.push(Number.isNaN(h) ? NaN : Math.round(h * 10) / 10);
    }
    raster.push(zeile);
  }

  return { raster, kacheln: geladen, fehlend, luecken: luecken / (aufloesung * aufloesung) };
}
