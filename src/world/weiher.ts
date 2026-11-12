/**
 * BRACHLAND — Stauweiher hinter dem Wehr (D268, `?weiher=1` / `?echt=1`)
 *
 * Das Stauwehr der Blender-Szene ist eine Mauer quer zum Bach — dahinter steht in der Natur ein Weiher
 * bis zur Kronenhöhe. Im Spiel gab es dort nur das Bachband, das dem Gelände folgt und die Mauer
 * trocken lässt (`Sturzstamm` lag bei x ≈ 1150 im Trockenen, 30 m vor der Mauer).
 *
 * **Aus dem GLB abgeleitet, nicht von Hand eingetragen:** Das Register wird von `szenenexport.py`
 * jedes Mal neu geschrieben, ein Zusatzfeld ginge verloren. Die Krone des Objekts `Wehr` ist der
 * Spiegel (minus 4 cm: das Wasser steht knapp unter der Kante); gefüllt wird von stromauf aus mit
 * einer Flutung über das Gelände — alles, was tiefer liegt und mit dem Saatpunkt zusammenhängt, ist
 * Weiher. Stromauf ist die Seite, auf der das Gelände höher liegt (der Bach läuft bergab).
 *
 * Die Wasserfläche reicht eine Zelle über den Rand hinaus und endet dort unter dem Gelände; die
 * Uferkante bekommt ihre Weichheit aus der Tiefe je Ecke (`uv.x` = halbe Tiefe/0,5 m, siehe
 * `bandmaterial.ts` Form `weiher`). Renderfrei bis auf den Geometrietyp; die Höhenfunktion kommt
 * von aussen.
 */
import * as THREE from 'three';

export interface Weiher {
  /** Spiegelhöhe im Raum der Höhenfunktion. */
  spiegel: number;
  geometrie: THREE.BufferGeometry;
  /** Zahl der gefluteten Zellen (ohne Randring). */
  zellen: number;
}

const UNTER_KRONE = 0.04;
const SICHERHEIT = 0.03;
/** Tiefe, ab der die Wasserfläche voll deckt (Meter). */
const TIEFE_VOLL = 0.5;

/**
 * @param box   Weltbox (oder Gruppenraum) des Objekts `Wehr`; derselbe Raum wie `hoehe`.
 * @param hoehe Geländehöhe, **wie sie gezeichnet wird** (inkl. Bachbett).
 */
export function baueWeiher(
  box: THREE.Box3, hoehe: (x: number, z: number) => number, zelle = 1, radius = 45,
): Weiher | null {
  const spiegel = box.max.y - UNTER_KRONE;
  const groesse = box.getSize(new THREE.Vector3());
  // Die dünne Achse ist die Stromachse (Mauerdicke), die lange liegt quer zum Bach.
  const stromX = groesse.x < groesse.z;
  const mitte = box.getCenter(new THREE.Vector3());
  const dick = (stromX ? groesse.x : groesse.z) / 2;
  const lang0 = stromX ? box.min.z : box.min.x, lang1 = stromX ? box.max.z : box.max.x;
  const a = (stromX ? mitte.x : mitte.z);
  const bei = (strom: number, quer: number) => (stromX ? hoehe(strom, quer) : hoehe(quer, strom));

  // Stromauf = höheres Gelände, gemittelt über die Mauerlänge 8 m vor und hinter der Mauer.
  let hoch = 0, tief = 0, n = 0;
  for (let q = lang0; q <= lang1; q += 2) { hoch += bei(a + dick + 8, q); tief += bei(a - dick - 8, q); n++; }
  const vorzeichen = hoch >= tief ? 1 : -1;
  void n;

  // Saat: tiefster Punkt an der Mauer auf der Stromaufseite.
  let saatQuer = (lang0 + lang1) / 2, saatH = Infinity;
  for (let q = lang0; q <= lang1; q += 0.5) {
    const h = bei(a + vorzeichen * (dick + 1.5), q);
    if (h < saatH) { saatH = h; saatQuer = q; }
  }
  if (!(saatH < spiegel - SICHERHEIT)) return null;
  const saatStrom = a + vorzeichen * (dick + 1.5);

  // Gitter um die Saat; Zelle (i, j) hat ihre Mitte bei (x0 + (i + 0.5) * zelle, z0 + (j + 0.5) * zelle).
  const sx = stromX ? saatStrom : saatQuer, sz = stromX ? saatQuer : saatStrom;
  const x0 = Math.floor((sx - radius) / zelle) * zelle, z0 = Math.floor((sz - radius) / zelle) * zelle;
  const N = Math.ceil(2 * radius / zelle);
  const nass = new Uint8Array(N * N);
  const stromauf = (x: number, z: number) => (stromX ? (x - a) : (z - a)) * vorzeichen > dick;
  const mitteX = (i: number) => x0 + (i + 0.5) * zelle, mitteZ = (j: number) => z0 + (j + 0.5) * zelle;
  const gut = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= N || j >= N || nass[j * N + i]) return false;
    const x = mitteX(i), z = mitteZ(j);
    return stromauf(x, z) && Math.hypot(x - sx, z - sz) <= radius && hoehe(x, z) < spiegel - SICHERHEIT;
  };
  const i0 = Math.floor((sx - x0) / zelle), j0 = Math.floor((sz - z0) / zelle);
  const stapel: number[] = [];
  if (gut(i0, j0)) { nass[j0 * N + i0] = 1; stapel.push(i0, j0); }
  let zellen = 0;
  while (stapel.length) {
    const j = stapel.pop()!, i = stapel.pop()!;
    zellen++;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nj = j + dj;
      if (gut(ni, nj)) { nass[nj * N + ni] = 1; stapel.push(ni, nj); }
    }
  }
  if (zellen < 20) return null;

  // Randring: jede Zelle, die eine nasse berührt (8er-Nachbarschaft), kommt als Fläche dazu.
  const flaeche = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!nass[j * N + i]) continue;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && nj >= 0 && ni < N && nj < N) flaeche[nj * N + ni] = 1;
    }
  }

  // Indizierte Fläche: eine Ecke je Gitterpunkt, nur wo gebraucht.
  const M = N + 1;
  const ecke = new Int32Array(M * M).fill(-1);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const nimm = (i: number, j: number) => {
    const k = j * M + i;
    if (ecke[k] >= 0) return ecke[k];
    const x = x0 + i * zelle, z = z0 + j * zelle;
    const tiefe = spiegel - hoehe(x, z);
    ecke[k] = pos.length / 3;
    pos.push(x, spiegel, z);
    // u = halbe Tiefe in 0,5-m-Schritten (0 am Ufer, 0,5 ab TIEFE_VOLL); v neutral.
    uv.push(0.5 * Math.min(1, Math.max(0, tiefe / TIEFE_VOLL)), 0.5);
    return ecke[k];
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!flaeche[j * N + i]) continue;
    const a0 = nimm(i, j), b0 = nimm(i + 1, j), c0 = nimm(i, j + 1), d0 = nimm(i + 1, j + 1);
    idx.push(a0, c0, b0, b0, c0, d0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return { spiegel, geometrie: g, zellen };
}
