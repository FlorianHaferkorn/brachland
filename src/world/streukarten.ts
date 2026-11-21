/**
 * BRACHLAND — Bodenstreu als gebackene Karten (D361): Falllaub, Nadeln, Zapfen, Kies, Moos, Zweige in echter Grösse.
 *
 * Die Bodenscans (D223) tragen die Fläche; aus der Nähe fehlt ihnen das, was obenauf liegt. `tools/streukarten.py`
 * backt in Blender vier Felder 1 × 1 m (Laubstreu Buche, Nadelstreu Fichte mit Zapfen, Kies mit Moos, Zweige mit
 * trockenem Laub; Grössen aus `content/massstab.json`). Hier liegen sie als Karten auf dem Gelände: je Meter-Zelle
 * ein Würfelwurf aus dem Seed der Zelle (Performance-Invariante: erzeugt, nicht gespeichert), Art und Dichte nach
 * Biom, Karte nach der Geländeneigung gekippt und um die Normale gedreht.
 */
import * as THREE from 'three';
import type { Biom } from './osm.js';

/** Atlas-Kacheln: 0 Laub, 1 Nadel, 2 Kies/Moos, 3 Zweige. */
const LAUB = 0, NADEL = 1, KIES = 2, ZWEIGE = 3;

/** Wahrscheinlichkeit je Meter-Zelle und Art(en) je Biom. Wasser und Unbekanntes bleiben frei. */
const STREU: Partial<Record<Biom, { p: number; arten: readonly number[] }>> = {
  wald: { p: 0.75, arten: [LAUB, LAUB, NADEL, NADEL, ZWEIGE] },
  gebuesch: { p: 0.55, arten: [LAUB, LAUB, ZWEIGE] },
  moor: { p: 0.25, arten: [NADEL, ZWEIGE] },
  fels: { p: 0.35, arten: [KIES, KIES, ZWEIGE] },
  ruine: { p: 0.5, arten: [KIES, ZWEIGE, LAUB] },
  siedlung: { p: 0.3, arten: [KIES, LAUB, ZWEIGE] },
  industrie: { p: 0.35, arten: [KIES, KIES, ZWEIGE] },
  wiese: { p: 0.06, arten: [ZWEIGE, LAUB] },
  acker: { p: 0.05, arten: [ZWEIGE, KIES] },
};

/** Weiches Wertrauschen (0…1) auf `zelle` Metern — Streu liegt in Inseln, nicht gleichmässig (D361, Tupfenmuster). */
function haeufung(x: number, z: number, zelle: number): number {
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

/** Ein Baum für die Streu: Ort und ob Nadelbaum (D362). */
export interface StreuBaum { x: number; z: number; nadel: boolean }

/** Baumraster für schnelle Nachbarsuche (8-m-Zellen). */
export function baumRaster(baeume: readonly StreuBaum[]): Map<string, StreuBaum[]> {
  const raster = new Map<string, StreuBaum[]>();
  for (const b of baeume) {
    const k = `${Math.floor(b.x / 8)}:${Math.floor(b.z / 8)}`;
    const l = raster.get(k); if (l) l.push(b); else raster.set(k, [b]);
  }
  return raster;
}

function naechsterBaum(raster: Map<string, StreuBaum[]>, x: number, z: number): { d: number; nadel: boolean } | null {
  const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
  let best: { d: number; nadel: boolean } | null = null;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of raster.get(`${cx + i}:${cz + j}`) ?? []) {
    const d = Math.hypot(b.x - x, b.z - z);
    if (!best || d < best.d) best = { d, nadel: b.nadel };
  }
  return best;
}

/** Instanzmatrizen je Atlas-Kachel im Quadrat um (mx, mz). */
export function streuMatrizen(
  mx: number, mz: number, radius: number,
  hoeheAn: (x: number, z: number) => number, biomAn: (x: number, z: number) => Biom,
  /** D362: Bäume steuern Dichte (unter der Krone viel, im Offenen wenig) und Art (Laub oder Nadel). */
  baeume?: Map<string, StreuBaum[]>,
): THREE.Matrix4[][] {
  const kacheln: THREE.Matrix4[][] = [[], [], [], []];
  const z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), q = new THREE.Quaternion(), dreh = new THREE.Quaternion();
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  const x0 = Math.floor(mx - radius), x1 = Math.ceil(mx + radius), z0 = Math.floor(mz - radius), z1 = Math.ceil(mz + radius);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    let h = zellHash(ix, iz, 361);
    const wurf = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
    const x = ix + wurf(), zz = iz + wurf();
    if ((x - mx) ** 2 + (zz - mz) ** 2 > radius * radius) continue;
    const regel = STREU[biomAn(x, zz)];
    if (!regel) continue;
    // Inseln: zwei Rauschlagen (9 m und 3 m), die Biomdichte bleibt im Mittel erhalten.
    const insel = 0.65 * haeufung(x, zz, 9) + 0.35 * haeufung(x, zz, 3);
    const baum = baeume ? naechsterBaum(baeume, x, zz) : null;
    // Unter der Krone (≤ 5 m) dichter, bis 10 m wie das Biom, im Offenen ein Drittel.
    const kronenFaktor = !baeume ? 1 : !baum || baum.d > 10 ? 0.33 : baum.d < 5 ? 1.6 : 1;
    // Unter einer Krone fällt immer Streu: der Baum bildet seine eigene Insel, unabhängig vom Rauschen.
    const inselAnteil = Math.max(Math.min(1, Math.max(0, (insel - 0.32) * 2.6)), baum && baum.d < 5 ? 1 - baum.d / 6 : 0);
    if (wurf() > Math.min(0.95, regel.p * kronenFaktor) * inselAnteil) continue;
    const e = 0.4;
    n.set(hoeheAn(x - e, zz) - hoeheAn(x + e, zz), 2 * e, hoeheAn(x, zz - e) - hoeheAn(x, zz + e)).normalize();
    q.setFromUnitVectors(z, n);
    dreh.setFromAxisAngle(z, wurf() * Math.PI * 2);
    const kante = 0.9 + 0.2 * wurf();          // 0,9–1,1 m: die Grössen im Feld bleiben echt
    p.set(x, hoeheAn(x, zz) + 0.015, zz);
    // Gestreckt statt rund: ±25 % je Achse, die Teile bleiben in der Toleranz der Referenz.
    s.set(kante * (0.8 + 0.45 * wurf()), kante * (0.75 + 0.3 * wurf()), 1);
    // Unter einem Baum fällt dessen Streu: Laub unter Laubbäumen, Nadeln unter Nadelbäumen (Zweige bleiben möglich).
    const artWurf = wurf();
    const art = baum && baum.d < 6 && artWurf < 0.8 ? (baum.nadel ? NADEL : LAUB)
      : regel.arten[Math.floor(artWurf * regel.arten.length) % regel.arten.length];
    kacheln[art].push(new THREE.Matrix4().compose(p, q.clone().multiply(dreh), s));
  }
  return kacheln;
}
