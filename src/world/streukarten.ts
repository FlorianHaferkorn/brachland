/**
 * BRACHLAND — Bodenstreu als gebackene Karten (D361): Falllaub, Nadeln, Zapfen, Kies, Moos, Zweige in echter Grösse.
 *
 * Die Bodenscans (D223) tragen die Fläche; aus der Nähe fehlt ihnen das, was obenauf liegt. `tools/streukarten.py`
 * backt in Blender vier Felder 1 × 1 m (Laubstreu Buche, Nadelstreu Fichte mit Zapfen, Kies mit Moos, Zweige mit
 * trockenem Laub; Grössen aus `content/massstab.json`). Hier liegen sie als Karten auf dem Gelände: je Meter-Zelle
 * ein Würfelwurf aus dem Seed der Zelle (Performance-Invariante: erzeugt, nicht gespeichert), Art und Dichte nach
 * Biom, Karte nach der Geländeneigung gekippt und um die Normale gedreht.
 *
 * D366: Unter einer Krone liegt eine **geschlossene** Decke (Befund Foto `.cache/referenz/befunde.md`, Boden:
 * Buchenlaub deckt unter der Krone 95–100 %, Fichtennadelstreu 100 %, scharfer Übergang von 1–2 m am Kronenrand).
 * Dafür ein eigenes, feineres Raster (`DECKE_RASTER`) bis zum Kronenrand, der über `KRONE_UEBERGANG` ausläuft.
 * Ausserhalb der Kronen bleiben die Inseln aus D361; auf Wiese und Acker liegt dort nichts.
 */
import * as THREE from 'three';
import type { Biom } from './osm.js';

/** Atlas-Kacheln: 0 Laub, 1 Nadel, 2 Kies/Moos, 3 Zweige. */
const LAUB = 0, NADEL = 1, KIES = 2, ZWEIGE = 3;

/** Wahrscheinlichkeit je Meter-Zelle und Art(en) je Biom. Wasser und Unbekanntes bleiben frei. */
const STREU: Partial<Record<Biom, { p: number; arten: readonly number[]; nurUnterBaum?: boolean }>> = {
  wald: { p: 0.75, arten: [LAUB, LAUB, NADEL, NADEL, ZWEIGE] },
  gebuesch: { p: 0.55, arten: [LAUB, LAUB, ZWEIGE] },
  moor: { p: 0.25, arten: [NADEL, ZWEIGE] },
  fels: { p: 0.35, arten: [KIES, KIES, ZWEIGE] },
  ruine: { p: 0.5, arten: [KIES, ZWEIGE, LAUB] },
  siedlung: { p: 0.3, arten: [KIES, LAUB, ZWEIGE] },
  industrie: { p: 0.35, arten: [KIES, KIES, ZWEIGE] },
  wiese: { p: 0.06, arten: [ZWEIGE, LAUB], nurUnterBaum: true },
  acker: { p: 0.05, arten: [ZWEIGE, KIES], nurUnterBaum: true },
};

/** Weiches Wertrauschen (0…1) auf `zelle` Metern — Streu liegt in Inseln, nicht gleichmässig (D361, Tupfenmuster). */
export function haeufung(x: number, z: number, zelle: number): number {
  const gx = x / zelle, gz = z / zelle, ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const w = (a: number, b: number) => zellHash(a, b, 977) / 0xffffffff;
  const o = w(ix, iz) + (w(ix + 1, iz) - w(ix, iz)) * sx;
  const u = w(ix, iz + 1) + (w(ix + 1, iz + 1) - w(ix, iz + 1)) * sx;
  return o + (u - o) * sz;
}

/** Ganzzahl-Hash einer Zelle — dieselbe Zelle gibt immer dieselbe Streu. */
function zellHash(ix: number, iz: number, salz: number): number {
  let h = (ix * 73856093) ^ (iz * 19349663) ^ (salz * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Ein Baum für die Streu: Ort, ob Nadelbaum (D362) und Kronenradius in Metern (D366). */
export interface StreuBaum { x: number; z: number; nadel: boolean; krone: number }

/**
 * D366: Kronenradius der Blender-Bäume bei Skalierung 1, gemessen an `public/props/baum-*-nah.glb` (95. Perzentil des
 * waagerechten Abstands der Kronenpunkte über einem Viertel der Höhe, mit Knotenmaßstab; Buche 4,3–5,4 m, Fichte
 * 1,9–2,6 m). Die Szene multipliziert mit der Instanzskalierung — die Decke folgt der Krone, die man sieht.
 */
export const KRONE_RADIUS = { laub: 4.9, nadel: 2.3 } as const;
/** Breite des Übergangs am Kronenrand (Befund: 1–2 m). */
export const KRONE_UEBERGANG = 1.5;
/** Kartenabstand der geschlossenen Decke: rund 5 Karten je m², damit die ausfransenden Felder lückenlos überlappen. */
export const DECKE_RASTER = 0.45;

/** D366: Bäume aus der Prop-Liste mit ihrem sichtbaren Kronenradius (Grundradius × Instanzskalierung). */
export function streuBaeume(props: readonly { art: string; position: readonly number[]; skalierung: number }[]): StreuBaum[] {
  return props.filter(p => p.art === 'laubbaum' || p.art === 'nadelbaum').map(p => ({
    x: p.position[0], z: p.position[2], nadel: p.art === 'nadelbaum',
    krone: KRONE_RADIUS[p.art === 'nadelbaum' ? 'nadel' : 'laub'] * p.skalierung,
  }));
}

/** Baumraster für schnelle Nachbarsuche (8-m-Zellen). */
export function baumRaster(baeume: readonly StreuBaum[]): Map<string, StreuBaum[]> {
  const raster = new Map<string, StreuBaum[]>();
  for (const b of baeume) {
    const k = `${Math.floor(b.x / 8)}:${Math.floor(b.z / 8)}`;
    const l = raster.get(k); if (l) l.push(b); else raster.set(k, [b]);
  }
  return raster;
}

/** Der Baum, dessen Kronenrand am nächsten liegt: `rand` < 0 heisst unter der Krone (Meter bis zum Rand). */
export function naechsteKrone(raster: Map<string, StreuBaum[]>, x: number, z: number): { rand: number; nadel: boolean } | null {
  const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
  let best: { rand: number; nadel: boolean } | null = null;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of raster.get(`${cx + i}:${cz + j}`) ?? []) {
    const rand = Math.hypot(b.x - x, b.z - z) - b.krone;
    if (!best || rand < best.rand) best = { rand, nadel: b.nadel };
  }
  return best;
}

/** Deckung der Kronendecke an einem Punkt: 1 unter der Krone, über `KRONE_UEBERGANG` am Rand auf 0 (geglättet). */
export function kronenDeckung(rand: number): number {
  const t = Math.min(1, Math.max(0, (KRONE_UEBERGANG / 2 - rand) / KRONE_UEBERGANG));
  return t * t * (3 - 2 * t);
}

type StreuKarte = { art: number; matrix: THREE.Matrix4 };
type StreuFeld = { x0: number; x1: number; z0: number; z1: number; zellen: (StreuKarte | null | undefined)[] };
export interface StreuCache { inseln?: StreuFeld; kronen?: StreuFeld }

/** Nur die Schnittmenge beider Suchfenster übernehmen. null = geprüft und leer,
 * undefined = außerhalb des alten Kreises oder erstmals erreicht. */
function streuFenster(alt: StreuFeld | undefined, x0: number, x1: number, z0: number, z1: number): StreuFeld {
  const tiefe = z1 - z0 + 1;
  const zellen = new Array<StreuKarte | null | undefined>((x1 - x0 + 1) * tiefe);
  if (alt) {
    for (let ix = Math.max(x0, alt.x0); ix <= Math.min(x1, alt.x1); ix++) {
      const neu = (ix - x0) * tiefe - z0;
      const vorher = (ix - alt.x0) * (alt.z1 - alt.z0 + 1) - alt.z0;
      for (let iz = Math.max(z0, alt.z0); iz <= Math.min(z1, alt.z1); iz++) zellen[neu + iz] = alt.zellen[vorher + iz];
    }
  }
  return { x0, x1, z0, z1, zellen };
}

/** Instanzmatrizen je Atlas-Kachel im Quadrat um (mx, mz). */
export function streuMatrizen(
  mx: number, mz: number, radius: number,
  hoeheAn: (x: number, z: number) => number, biomAn: (x: number, z: number) => Biom,
  /** D362/D366: Bäume legen unter ihrer Krone eine geschlossene Decke ihrer Art (Laub oder Nadel). */
  baeume?: Map<string, StreuBaum[]>, cache?: StreuCache,
): THREE.Matrix4[][] {
  const kacheln: THREE.Matrix4[][] = [[], [], [], []];
  const z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), q = new THREE.Quaternion(), dreh = new THREE.Quaternion();
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  const x0 = Math.floor(mx - radius), x1 = Math.ceil(mx + radius), z0 = Math.floor(mz - radius), z1 = Math.ceil(mz + radius);
  const lege = (x: number, zz: number, art: number, wurf: () => number) => {
    const e = 0.4;
    n.set(hoeheAn(x - e, zz) - hoeheAn(x + e, zz), 2 * e, hoeheAn(x, zz - e) - hoeheAn(x, zz + e)).normalize();
    q.setFromUnitVectors(z, n);
    dreh.setFromAxisAngle(z, wurf() * Math.PI * 2);
    const kante = 0.9 + 0.2 * wurf();          // 0,9–1,1 m: die Grössen im Feld bleiben echt
    p.set(x, hoeheAn(x, zz) + 0.015, zz);
    // Gestreckt statt rund: ±25 % je Achse, die Teile bleiben in der Toleranz der Referenz.
    s.set(kante * (0.8 + 0.45 * wurf()), kante * (0.75 + 0.3 * wurf()), 1);
    const matrix = new THREE.Matrix4().compose(p, q.multiply(dreh), s);
    kacheln[art].push(matrix);
    return { art, matrix };
  };
  const imKreis = (x: number, zz: number) => (x - mx) ** 2 + (zz - mz) ** 2 <= radius * radius;

  // 1. Inseln (D361) — nur ausserhalb der Kronen; auf Wiese und Acker dort gar nichts (D363/D366).
  const inseln = cache && (cache.inseln = streuFenster(cache.inseln, x0, x1, z0, z1));
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    let h = zellHash(ix, iz, 361);
    const wurf = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
    const x = ix + wurf(), zz = iz + wurf();
    if (!imKreis(x, zz)) continue;
    const index = (ix - x0) * (z1 - z0 + 1) + iz - z0;
    const alt = inseln?.zellen[index];
    if (alt !== undefined) {
      if (alt) kacheln[alt.art].push(alt.matrix);
      continue;
    }
    if (inseln) inseln.zellen[index] = null;
    const regel = STREU[biomAn(x, zz)];
    if (!regel) continue;
    const krone = baeume ? naechsteKrone(baeume, x, zz) : null;
    // Was die Decke trägt, tragen die Inseln nicht noch einmal: nur der Rest neben der Deckung.
    const frei = 1 - (krone ? kronenDeckung(krone.rand) : 0);
    if (regel.nurUnterBaum && baeume) continue;
    const insel = 0.65 * haeufung(x, zz, 9) + 0.35 * haeufung(x, zz, 3);
    const inselAnteil = Math.min(1, Math.max(0, (insel - 0.32) * 2.6));
    if (wurf() > Math.min(0.95, regel.p * (baeume ? 0.6 : 1)) * inselAnteil * frei) continue;
    const karte = lege(x, zz, regel.arten[Math.floor(wurf() * regel.arten.length) % regel.arten.length], wurf);
    if (inseln) inseln.zellen[index] = karte;
  }

  // 2. Geschlossene Decke unter den Kronen (D366): Laub unter Laubbäumen, Nadeln unter Nadelbäumen, wenige Zweige.
  if (baeume) {
    const g0x = Math.floor((mx - radius) / DECKE_RASTER), g1x = Math.ceil((mx + radius) / DECKE_RASTER);
    const g0z = Math.floor((mz - radius) / DECKE_RASTER), g1z = Math.ceil((mz + radius) / DECKE_RASTER);
    const kronen = cache && (cache.kronen = streuFenster(cache.kronen, g0x, g1x, g0z, g1z));
    for (let gx = g0x; gx <= g1x; gx++) for (let gz = g0z; gz <= g1z; gz++) {
      let h = zellHash(gx, gz, 366);
      const wurf = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
      // Leicht gerüttelt (±0,1 m), sonst liest die Decke als Raster.
      const x = (gx + 0.5) * DECKE_RASTER + (wurf() - 0.5) * 0.2, zz = (gz + 0.5) * DECKE_RASTER + (wurf() - 0.5) * 0.2;
      if (!imKreis(x, zz)) continue;
      const index = (gx - g0x) * (g1z - g0z + 1) + gz - g0z;
      const alt = kronen?.zellen[index];
      if (alt !== undefined) {
        if (alt) kacheln[alt.art].push(alt.matrix);
        continue;
      }
      if (kronen) kronen.zellen[index] = null;
      const biom = biomAn(x, zz);
      if (biom === 'wasser' || !STREU[biom]) continue;
      const krone = naechsteKrone(baeume, x, zz);
      if (!krone || wurf() >= kronenDeckung(krone.rand)) continue;
      const karte = lege(x, zz, wurf() < 0.08 ? ZWEIGE : krone.nadel ? NADEL : LAUB, wurf);
      if (kronen) kronen.zellen[index] = karte;
    }
  }
  return kacheln;
}
