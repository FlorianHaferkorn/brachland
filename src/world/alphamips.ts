/**
 * BRACHLAND — Mip-Ketten mit Deckungserhalt für Alpha-Test-Karten (D273)
 *
 * Eine Karte mit dünnen Strukturen (Halme, Nadeln, Blattränder) verliert beim Verkleinern ihre Fläche: Das
 * Mittel der Alphawerte sinkt unter die Schwelle des Alpha-Tests, die Struktur zerfällt in ausgefranste
 * Flecken (Stauwehr, 13.11.2026: Weide, Laub, Gras im Mittelfeld). Hier wird die Kette von Hand gebaut und
 * jede Stufe so skaliert, dass dieselbe Fläche den Schwellwert übersteigt wie bei voller Auflösung — mit
 * Deckel (`HOCH`), damit aus Rauschen keine Blobs werden. Die Farbe unter dem Rand wird nach aussen gefüllt
 * (Canvas speichert vormultipliziert, die Farbe unter Alpha 0 ginge sonst verloren: dunkle Säume).
 * Genutzt von `grashorst.ts` (Atlas) und `laubkarten.ts` (Laub-/Nadelkarten). Ohne Browser nie erfüllt.
 */
import * as THREE from 'three';

/** Obergrenze der Alpha-Skalierung je Stufe. */
const HOCH = 4;

/** Anteil der Texel mit Alpha ≥ Schwelle, optional mit Alpha-Skalierung `s`. */
function deckung(a: Uint8Array, schwelle: number, s = 1): number {
  const t = schwelle * 255;
  let n = 0;
  for (let i = 3; i < a.length; i += 4) if (a[i] * s >= t) n++;
  return n / (a.length / 4);
}

/** Eine Stufe (2×2-Mittel, Farbe nach Alpha gewichtet). */
function halbiere(src: Uint8Array, b: number, h: number): Uint8Array<ArrayBuffer> {
  const kb = Math.max(1, b >> 1), kh = Math.max(1, h >> 1), out = new Uint8Array(kb * kh * 4);
  for (let y = 0; y < kh; y++) for (let x = 0; x < kb; x++) {
    let a = 0, r = 0, g = 0, bl = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const sx = Math.min(b - 1, 2 * x + dx), sy = Math.min(h - 1, 2 * y + dy);
      const i = (sy * b + sx) * 4, al = src[i + 3];
      a += al; r += src[i] * al; g += src[i + 1] * al; bl += src[i + 2] * al;
    }
    const o = (y * kb + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = bl / a; }
    out[o + 3] = a / 4;
  }
  return out;
}

/** Farbe der durchsichtigen Pixel nach aussen füllen (4er-Nachbarschaft, `runden` Schritte). */
function fuelleFarbe(d: Uint8Array, b: number, h: number, runden: number): void {
  const deck = new Uint8Array(b * h);
  for (let i = 0; i < b * h; i++) deck[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  const nachbarn = [-1, 1, -b, b];
  for (let r = 0; r < runden; r++) {
    const neu: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < b; x++) {
      const i = y * b + x;
      if (deck[i]) continue;
      let n = 0, rr = 0, gg = 0, bb = 0;
      for (let k = 0; k < 4; k++) {
        const j = i + nachbarn[k];
        if (j < 0 || j >= b * h || (k < 2 && Math.floor(j / b) !== y) || !deck[j]) continue;
        n++; rr += d[j * 4]; gg += d[j * 4 + 1]; bb += d[j * 4 + 2];
      }
      if (n) { d[i * 4] = rr / n; d[i * 4 + 1] = gg / n; d[i * 4 + 2] = bb / n; neu.push(i); }
    }
    for (const i of neu) deck[i] = 1;
  }
}

export interface AlphaMipOptionen {
  /** Schwelle des Alpha-Tests im Material (0…1) — die Kette erhält die Deckung für genau sie. */
  schwelle: number;
  /** Anzahl Stufen (1 = nur volle Auflösung). 0 = vollständige Kette bis 1×1. */
  stufen?: number;
  /** Zeile 0 unten statt oben (wie `flipY` bei geladenen Texturen). */
  spiegelY?: boolean;
}

/** Ein Bild laden und als RGBA lesen, Farbe nach aussen gefüllt. */
export async function ladeRgba(url: string): Promise<{ data: Uint8Array<ArrayBuffer>; b: number; h: number }> {
  const bild = await fetch(url).then((r) => r.blob()).then((bl) => createImageBitmap(bl, { premultiplyAlpha: 'none' }));
  const c = document.createElement('canvas');
  c.width = bild.width; c.height = bild.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bild, 0, 0);
  const data = new Uint8Array(c.width * c.height * 4);
  data.set(g.getImageData(0, 0, c.width, c.height).data);
  fuelleFarbe(data, c.width, c.height, 4);
  bild.close();
  return { data, b: c.width, h: c.height };
}

/** Mip-Kette bauen und in `ziel` einsetzen (Grösse darf von der des Platzhalters abweichen). */
export function setzeAlphaMips(
  ziel: THREE.DataTexture, roh: Uint8Array<ArrayBuffer>, b: number, h: number, opt: AlphaMipOptionen,
): void {
  let ist = roh;
  if (opt.spiegelY) {
    ist = new Uint8Array(roh.length);
    for (let y = 0; y < h; y++) ist.set(roh.subarray(y * b * 4, (y + 1) * b * 4), (h - 1 - y) * b * 4);
  }
  const volle = Math.floor(Math.log2(Math.min(b, h))) + 1;
  const stufen = Math.min(opt.stufen || volle, volle);
  const sollDeckung = deckung(ist, opt.schwelle);
  const kette: { data: Uint8Array<ArrayBuffer>; width: number; height: number }[] = [];
  let bb = b, hh = h;
  for (let s = 0; s < stufen; s++) {
    let aus = ist;
    if (s > 0) {
      let lo = 1, hi = HOCH;
      for (let k = 0; k < 12; k++) { const mid = (lo + hi) / 2; if (deckung(ist, opt.schwelle, mid) < sollDeckung) lo = mid; else hi = mid; }
      aus = new Uint8Array(ist);
      for (let i = 3; i < aus.length; i += 4) aus[i] = Math.min(255, ist[i] * hi);
    }
    kette.push({ data: aus, width: bb, height: hh });
    ist = halbiere(ist, bb, hh); bb = Math.max(1, bb >> 1); hh = Math.max(1, hh >> 1);
  }
  ziel.dispose();   // andere Grösse als der 1×1-Platzhalter: der GPU-Speicher wird neu angelegt
  ziel.image = { data: kette[0].data, width: b, height: h };
  ziel.mipmaps = kette;
  ziel.generateMipmaps = false;
  ziel.minFilter = THREE.LinearMipmapLinearFilter;
  ziel.magFilter = THREE.LinearFilter;
  ziel.needsUpdate = true;
}

/** Durchsichtiger 1×1-Platzhalter: bis das Bild da ist, bleibt die Karte unsichtbar statt kaputt. */
export function leereKarte(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}
