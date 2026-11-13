/**
 * BRACHLAND — Grashorst-Karte: echte, feine Halme statt breiter Einzelhalme (D272, `?gras=3`)
 *
 * Flo 13.11.2026: „die Grashalme sind so unrealistisch, zu gross und nicht dicht genug“. Messung an
 * CC0-Fotos echten Grases (Poly Haven `leafy_grass`, `sparse_grass`, `grass_ground`, `withered_grass`) und
 * unserem Teppich: Echte Halme sind 3–8 mm breit und stehen zu tausenden je m²; unsere waren 17–48 mm
 * breit bei ~490 je m² im Nahfeld. Einzelne Halme als Geometrie wären bei echter Dichte ~5 Mio Dreiecke
 * allein im 8-m-Ring — das trägt der M1 nicht. Der übliche Weg im Spiel: ein **Horst** = Karte mit 30–45
 * gezeichneten Halmen (Alpha), zwei gekreuzte Karten je Instanz.
 *
 * Die Karte entsteht zur Laufzeit per Canvas (kein Bild im Paket): schmale, verjüngte Halme aus einer
 * Wurzel, Mitte hoch und aufrecht, aussen kürzer und nach aussen geneigt, mit Biegung. Der Farbwert
 * trägt nur eine **Multiplikation** auf die Halmfarbe des Teppichs (Grün/Stroh/Boden bleiben dort):
 * unten dunkler, zur Spitze heller, ein Teil der Halme gelblich oder trocken.
 *
 * Mip-Kette von Hand mit Deckungserhalt: Dünne Halme verschwinden beim Verkleinern sonst im Alpha-Test
 * (Horst auf 8 m ~23 Pixel, 256 Texel) — jede Stufe wird so skaliert, dass dieselbe Fläche den
 * Schwellwert übersteigt wie bei voller Auflösung.
 */
import * as THREE from 'three';
import { zufall } from './pinsel.js';

/** Alpha-Schwelle, die der Material-Alpha-Test benutzt (und die Mip-Kette erhält). */
export const HORST_SCHWELLE = 0.4;
const KANTE = 256;
/** Wert 1,0 im Texel entspricht dieser Farbmultiplikation im Shader. */
export const HORST_FARBFAKTOR = 1.6;

let horst: THREE.DataTexture | null = null;

/** Normalverteilung (Box–Muller) aus dem deterministischen Zufall. */
function gauss(z: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, z()))) * Math.cos(6.2831853 * z());
}

/** Ein Halm als verjüngtes Band von (bx,by) mit Biegung zur Spitze. */
function zeichneHalm(g: CanvasRenderingContext2D, z: () => number): void {
  const bx = Math.max(40, Math.min(216, 128 + gauss(z) * 26)), by = KANTE - 1;
  const seite = Math.max(-1, Math.min(1, (bx - 128) / 60));
  // Mitte hoch und aufrecht, aussen kürzer und nach aussen geneigt.
  const laenge = (150 + z() * 100) * (1 - 0.45 * Math.pow(Math.abs(seite), 1.5));
  const winkel = seite * 0.5 + (z() - 0.5) * 0.35;
  const biegung = ((z() - 0.35) * 0.6 + seite * 0.3) * laenge * 0.35;
  const tx = bx + Math.sin(winkel) * laenge + biegung, ty = by - Math.cos(winkel) * laenge * 0.92;
  const cx = bx + Math.sin(winkel) * laenge * 0.45, cy = by - Math.cos(winkel) * laenge * 0.5;
  const w = 3.4 + z() * 3.2;
  // Farbe als Multiplikator: 80 % grün, 12 % gelblich, 8 % dunkel/trocken-braun.
  const r = z();
  const b = 0.75 + z() * 0.35;
  let m: [number, number, number];
  if (r < 0.8) m = [b * (0.9 + z() * 0.2), b, b * (0.75 + z() * 0.25)];
  else if (r < 0.92) m = [b * 1.2, b * 1.1, b * 0.55];
  else m = [b * 0.8, b * 0.65, b * 0.4];
  const v = (f: number) => m.map((c) => Math.max(0, Math.min(255, Math.round((c * f / HORST_FARBFAKTOR) * 255)))).join(',');
  const gr = g.createLinearGradient(bx, by, tx, ty);
  gr.addColorStop(0, `rgb(${v(0.5)})`);
  gr.addColorStop(0.6, `rgb(${v(1.0)})`);
  gr.addColorStop(1, `rgb(${v(1.1)})`);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(bx - w / 2, by);
  g.quadraticCurveTo(cx - w * 0.3, cy, tx, ty);
  g.quadraticCurveTo(cx + w * 0.3, cy, bx + w / 2, by);
  g.closePath();
  g.fill();
}

/** Anteil der Texel mit Alpha ≥ Schwelle (0…1), optional mit Alpha-Skalierung `s`. */
function deckung(a: Uint8ClampedArray | Uint8Array, s = 1): number {
  const t = HORST_SCHWELLE * 255;
  let n = 0;
  for (let i = 3; i < a.length; i += 4) if (a[i] * s >= t) n++;
  return n / (a.length / 4);
}

/** Eine Stufe der Mip-Kette (2×2-Mittel, Farbe nach Alpha gewichtet). */
function halbiere(src: Uint8Array, kante: number): Uint8Array<ArrayBuffer> {
  const k = kante >> 1, out = new Uint8Array(k * k * 4);
  for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) {
    let a = 0, r = 0, gg = 0, bb = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = ((2 * y + dy) * kante + 2 * x + dx) * 4, al = src[i + 3];
      a += al; r += src[i] * al; gg += src[i + 1] * al; bb += src[i + 2] * al;
    }
    const o = (y * k + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = gg / a; out[o + 2] = bb / a; }
    out[o + 3] = a / 4;
  }
  return out;
}

/** Die Karte: 256² RGBA (Farbmultiplikator, Alpha), Mip-Kette mit Deckungserhalt. */
export function horstTextur(): THREE.DataTexture {
  if (horst) return horst;
  if (typeof document === 'undefined') {
    horst = new THREE.DataTexture(new Uint8Array([102, 102, 102, 255]), 1, 1, THREE.RGBAFormat);
    horst.needsUpdate = true;
    return horst;
  }
  const c = document.createElement('canvas');
  c.width = c.height = KANTE;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.clearRect(0, 0, KANTE, KANTE);
  const z = zufall(20261113);
  for (let i = 0; i < 44; i++) zeichneHalm(g, z);
  const roh: Uint8Array<ArrayBuffer> = new Uint8Array(KANTE * KANTE * 4);
  roh.set(g.getImageData(0, 0, KANTE, KANTE).data);
  const ziel = deckung(roh);
  // Mip-Kette aus dem ungestauchten Satz, dann je Stufe Alpha so skalieren, dass die Deckung gleich bleibt.
  const stufen: { data: Uint8Array<ArrayBuffer>; width: number; height: number }[] = [];
  let ist: Uint8Array<ArrayBuffer> = roh, kante = KANTE;
  while (kante >= 1) {
    let aus: Uint8Array<ArrayBuffer> = ist;
    if (kante < KANTE) {
      let lo = 1, hi = 8;
      for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (deckung(ist, mid) < ziel) lo = mid; else hi = mid; }
      aus = new Uint8Array(ist);
      for (let i = 3; i < aus.length; i += 4) aus[i] = Math.min(255, ist[i] * hi);
    }
    stufen.push({ data: aus, width: kante, height: kante });
    if (kante === 1) break;
    ist = halbiere(ist, kante); kante >>= 1;
  }
  horst = new THREE.DataTexture(stufen[0].data, KANTE, KANTE, THREE.RGBAFormat, THREE.UnsignedByteType);
  horst.mipmaps = stufen;
  horst.generateMipmaps = false;
  horst.minFilter = THREE.LinearMipmapLinearFilter;
  horst.magFilter = THREE.LinearFilter;
  horst.wrapS = horst.wrapT = THREE.ClampToEdgeWrapping;
  horst.anisotropy = 4;
  horst.flipY = false;
  horst.needsUpdate = true;
  return horst;
}
