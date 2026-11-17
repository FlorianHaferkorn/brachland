/** D307: ein örtliches Bodenband an tatsächlichen Hauskanten, ohne Renderer-Abhängigkeit. */
import type { Weltdaten } from './osm.js';

type Punkt = [number, number];
type Weltmass = { breiteMeter: number; tiefeMeter: number };
const BREITE = 512;
const METER = 86;
const SCHRITT = METER / BREITE;

export interface Hofbodenkontakt {
  daten: Uint8Array;
  breite: 512;
  /** Weltursprung x/z und Kehrwerte der Ausdehnung; Zeilen laufen in positivem z. */
  rahmen: [number, number, number, number];
}

/**
 * Ein R8-Kanal (256KiB): 12cm voller Kontakt, bis 1,15m weich auslaufend.
 * Pixelzentren entsprechen (i+0,5)/512; nur Segmentumgebungen werden ausgewertet.
 * Danach werden sämtliche örtlichen Gebäudeinneren ausgespart, auch Garagen und
 * nicht gewählte Nachbarn. Weder Grundrisse noch Spielkollisionen werden verändert.
 */
export function baueHofbodenkontakt(welt: Weltdaten, mass: Weltmass,
  haeuser: readonly { gebaeudeIndex: number }[], mitte: readonly number[]): Hofbodenkontakt {
  if (![mass.breiteMeter, mass.tiefeMeter, mitte[0], mitte[1]].every(Number.isFinite)
    || mass.breiteMeter <= 0 || mass.tiefeMeter <= 0) throw new Error('Bodenkontakt braucht endliche Weltmaße und Hofmitte.');
  const daten = new Uint8Array(BREITE * BREITE);
  const x0 = mitte[0] - METER / 2, z0 = mitte[1] - METER / 2;
  const [sued, west, nord, ost] = welt.bbox;
  if (!(nord > sued && ost > west)) throw new Error('Bodenkontakt braucht eine gültige Welt-Boundingbox.');
  const punkt = ([lat, lon]: readonly number[]): Punkt => [((lon - west) / (ost - west) - .5) * mass.breiteMeter,
    ((nord - lat) / (nord - sued) - .5) * mass.tiefeMeter];
  const pixelMin = (x: number, ursprung: number) => Math.max(0, Math.ceil((x - ursprung) / SCHRITT - .5));
  const pixelMax = (x: number, ursprung: number) => Math.min(BREITE - 1, Math.floor((x - ursprung) / SCHRITT - .5));
  const ausgewaehlt = new Set(haeuser.map(h => h.gebaeudeIndex));
  const ringe: Punkt[][] = [];
  welt.gebaeude.forEach((g, index) => {
    if (g.punkte.length < 4) return;
    const ring = g.punkte.map(punkt);
    const xs = ring.map(q => q[0]), zs = ring.map(q => q[1]);
    if (Math.max(...xs) < x0 - 1.15 || Math.min(...xs) > x0 + METER + 1.15
      || Math.max(...zs) < z0 - 1.15 || Math.min(...zs) > z0 + METER + 1.15) return;
    ringe.push(ring);
    if (!ausgewaehlt.has(index)) return;
    for (let k = 0; k < ring.length - 1; k++) {
      const a = ring[k], b = ring[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], laenge2 = dx * dx + dz * dz;
      if (laenge2 < 1e-12) continue;
      const i0 = pixelMin(Math.min(a[1], b[1]) - 1.15, z0), i1 = pixelMax(Math.max(a[1], b[1]) + 1.15, z0);
      const j0 = pixelMin(Math.min(a[0], b[0]) - 1.15, x0), j1 = pixelMax(Math.max(a[0], b[0]) + 1.15, x0);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = x0 + (j + .5) * SCHRITT, z = z0 + (i + .5) * SCHRITT;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / laenge2));
        const abstand = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
        const rampe = Math.max(0, Math.min(1, (abstand - .12) / (1.15 - .12)));
        const wert = Math.round((1 - rampe * rampe * (3 - 2 * rampe)) * 255);
        const slot = i * BREITE + j;
        if (wert > daten[slot]) daten[slot] = wert;
      }
    }
  });
  // Scanline-Füllung statt jedes Pixel gegen jeden Weltgrundriss zu prüfen.
  for (const ring of ringe) {
    const zs = ring.map(q => q[1]), i0 = pixelMin(Math.min(...zs), z0), i1 = pixelMax(Math.max(...zs), z0);
    for (let i = i0; i <= i1; i++) {
      const z = z0 + (i + .5) * SCHRITT, schnitte: number[] = [];
      for (let k = 0; k < ring.length - 1; k++) {
        const a = ring[k], b = ring[k + 1];
        if ((a[1] > z) !== (b[1] > z)) schnitte.push(a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]));
      }
      schnitte.sort((a, b) => a - b);
      for (let k = 0; k + 1 < schnitte.length; k += 2) {
        const j0 = pixelMin(schnitte[k], x0), j1 = pixelMax(schnitte[k + 1], x0);
        for (let j = j0; j <= j1; j++) daten[i * BREITE + j] = 0;
      }
    }
  }
  return { daten, breite: BREITE, rahmen: [x0, z0, 1 / METER, 1 / METER] };
}
