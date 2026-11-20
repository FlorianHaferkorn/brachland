/** D307: ein örtliches Bodenband an tatsächlichen Hauskanten, ohne Renderer-Abhängigkeit. */
import type { Weltdaten } from './osm.js';

type Punkt = [number, number];
type Weltmass = { breiteMeter: number; tiefeMeter: number };
type Kontaktring = { punkte: Punkt[]; kontakt: boolean };
const BREITE = 512;
const METER = 86;

export interface Hofbodenkontakt {
  daten: Uint8Array;
  breite: number;
  tiefe: number;
  /** Weltursprung x/z und Kehrwerte der Ausdehnung; Zeilen laufen in positivem z. */
  rahmen: [number, number, number, number];
}

/** Ein R8-Kanal (256 KiB) mit 12 cm vollem Kontakt und 1,15 m Auslauf. */
export function baueHofbodenkontakt(welt: Weltdaten, mass: Weltmass,
  haeuser: readonly { gebaeudeIndex: number }[], mitte: readonly number[]): Hofbodenkontakt {
  if (![mass.breiteMeter, mass.tiefeMeter, mitte[0], mitte[1]].every(Number.isFinite)
    || mass.breiteMeter <= 0 || mass.tiefeMeter <= 0) throw new Error('Bodenkontakt braucht endliche Weltmaße und Hofmitte.');
  const [sued, west, nord, ost] = welt.bbox;
  if (!(nord > sued && ost > west)) throw new Error('Bodenkontakt braucht eine gültige Welt-Boundingbox.');
  const punkt = ([lat, lon]: readonly number[]): Punkt => [((lon - west) / (ost - west) - .5) * mass.breiteMeter,
    ((nord - lat) / (nord - sued) - .5) * mass.tiefeMeter];
  const ausgewaehlt = new Set(haeuser.map(h => h.gebaeudeIndex));
  const ringe = welt.gebaeude.flatMap((g, i): Kontaktring[] => g.punkte.length < 4 ? [] : [
    { punkte: g.punkte.map(punkt), kontakt: ausgewaehlt.has(i) },
  ]);
  return rastereBodenkontakt(ringe, mitte[0] - METER / 2, mitte[1] - METER / 2, BREITE, BREITE, METER / BREITE, 1.15);
}

/** Bewertet nur Umgebungen gewählter Wandsegmente und spart alle Gebäudeinneren aus. */
export function rastereBodenkontakt(ringe: readonly Kontaktring[], x0: number, z0: number,
  breite: number, tiefe: number, schritt: number, auslauf: number): Hofbodenkontakt {
  const daten = new Uint8Array(breite * tiefe);
  const pixelMin = (x: number, ursprung: number) => Math.max(0, Math.ceil((x - ursprung) / schritt - .5));
  const pixelMax = (x: number, ursprung: number, anzahl: number) =>
    Math.min(anzahl - 1, Math.floor((x - ursprung) / schritt - .5));
  const lokal = ringe.filter(({ punkte }) => {
    const xs = punkte.map(q => q[0]), zs = punkte.map(q => q[1]);
    return Math.max(...xs) >= x0 - auslauf && Math.min(...xs) <= x0 + breite * schritt + auslauf
      && Math.max(...zs) >= z0 - auslauf && Math.min(...zs) <= z0 + tiefe * schritt + auslauf;
  });
  for (const { punkte: ring, kontakt } of lokal) {
    if (!kontakt) continue;
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], laenge2 = dx * dx + dz * dz;
      if (laenge2 < 1e-12) continue;
      const i0 = pixelMin(Math.min(a[1], b[1]) - auslauf, z0);
      const i1 = pixelMax(Math.max(a[1], b[1]) + auslauf, z0, tiefe);
      const j0 = pixelMin(Math.min(a[0], b[0]) - auslauf, x0);
      const j1 = pixelMax(Math.max(a[0], b[0]) + auslauf, x0, breite);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = x0 + (j + .5) * schritt, z = z0 + (i + .5) * schritt;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / laenge2));
        const abstand = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
        const rampe = Math.max(0, Math.min(1, (abstand - .12) / (auslauf - .12)));
        const wert = Math.round((1 - rampe * rampe * (3 - 2 * rampe)) * 255);
        const slot = i * breite + j;
        if (wert > daten[slot]) daten[slot] = wert;
      }
    }
  }
  // Scanline-Füllung statt jedes Pixel gegen jeden Weltgrundriss zu prüfen.
  for (const { punkte: ring } of lokal) {
    const zs = ring.map(q => q[1]);
    const i0 = pixelMin(Math.min(...zs), z0), i1 = pixelMax(Math.max(...zs), z0, tiefe);
    for (let i = i0; i <= i1; i++) {
      const z = z0 + (i + .5) * schritt, schnitte: number[] = [];
      for (let k = 0; k < ring.length; k++) {
        const a = ring[k], b = ring[(k + 1) % ring.length];
        if ((a[1] > z) !== (b[1] > z)) schnitte.push(a[0] + (z - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      schnitte.sort((a, b) => a - b);
      for (let k = 0; k + 1 < schnitte.length; k += 2) {
        const j0 = pixelMin(schnitte[k], x0), j1 = pixelMax(schnitte[k + 1], x0, breite);
        if (j0 <= j1) daten.fill(0, i * breite + j0, i * breite + j1 + 1);
      }
    }
  }
  return { daten, breite, tiefe, rahmen: [x0, z0, 1 / (breite * schritt), 1 / (tiefe * schritt)] };
}
