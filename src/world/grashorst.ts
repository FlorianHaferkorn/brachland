/**
 * BRACHLAND — Grashorst-Atlas: Foto-Büschel statt gezeichneter Halme (D272, `?gras=3`)
 *
 * Flo 13.11.2026: „die Grashalme sind so unrealistisch, zu gross und nicht dicht genug … gibt es nicht
 * schon fertige Assets?“ — Ja: Poly Haven (CC0) `grass_medium_01` und `grass_medium_02` sind Foto-Scans
 * einzelner Büschel (0,12–0,36 m), als Blattkarten mit der Silhouette der Halme geschnitten. Roh sind sie
 * bis 25.000 Dreiecke je Büschel — zu schwer für 20–100 Büschel je m². Sie wurden deshalb einmal je Netz
 * seitlich mit orthografischer Kamera in ein Bild gerendert (`tools/grashorste.mjs`) und zu einem Atlas
 * gepackt: 19 Kacheln à 384² (7 grün, 5 trocken, 4 Kraut, 3 Blüten), Alpha aus der Silhouette, Farbe unter dem Rand nach aussen gefüllt (keine
 * dunklen Säume). `public/material/gras-horste.json` hält je Kachel das Rechteck im Atlas und die Kantenlänge
 * der Kachel in Metern; Herkunft in `assets/HERKUNFT.md`.
 *
 * Laufzeit: Atlas laden, Mip-Kette von Hand mit Deckungserhalt — dünne Halme verschwinden beim Verkleinern
 * sonst im Alpha-Test (ein Büschel auf 8 m ~25 Pixel gegen 384 Texel). Jede Stufe wird so skaliert, dass
 * dieselbe Fläche den Schwellwert übersteigt wie bei voller Auflösung. Nur 6 Stufen, damit Nachbarkacheln
 * nicht ineinander laufen.
 */
import * as THREE from 'three';

/** Alpha-Schwelle, die der Material-Alpha-Test benutzt (und die Mip-Kette erhält). */
export const HORST_SCHWELLE = 0.3;
/** Kacheln je Art im Atlas (Reihenfolge: grün, trocken, Kraut, Blume); wird beim Laden gegen die JSON geprüft. */
export const HORST_GRUEN = 7;
export const HORST_STROH = 5;
export const HORST_KRAUT = 4;
export const HORST_BLUME = 3;
export const HORST_ZAHL = HORST_GRUEN + HORST_STROH + HORST_KRAUT + HORST_BLUME;
const MIP_STUFEN = 6;

export interface HorstKachel {
  art: 'gruen' | 'stroh' | 'kraut' | 'blume';
  /** Rechteck im Atlas in UV (x, y, Breite, Höhe), unten links. */
  rect: [number, number, number, number];
  /** Kantenlänge der quadratischen Kachel in Metern. */
  groesse: number;
}
export interface HorstAtlas {
  textur: THREE.DataTexture;
  kacheln: HorstKachel[];
}

/** Durchsichtige 1×1-Platzhalter, bis der Atlas da ist: der Teppich bleibt kurz leer, statt zu brechen. */
export function leereHorstTextur(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

/** Anteil der Texel mit Alpha ≥ Schwelle, optional mit Alpha-Skalierung `s`. */
function deckung(a: Uint8Array, s = 1): number {
  const t = HORST_SCHWELLE * 255;
  let n = 0;
  for (let i = 3; i < a.length; i += 4) if (a[i] * s >= t) n++;
  return n / (a.length / 4);
}

/** Eine Stufe der Mip-Kette (2×2-Mittel, Farbe nach Alpha gewichtet). */
function halbiere(src: Uint8Array, b: number, h: number): Uint8Array<ArrayBuffer> {
  const kb = b >> 1, kh = h >> 1, out = new Uint8Array(kb * kh * 4);
  for (let y = 0; y < kh; y++) for (let x = 0; x < kb; x++) {
    let a = 0, r = 0, g = 0, bl = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = ((2 * y + dy) * b + 2 * x + dx) * 4, al = src[i + 3];
      a += al; r += src[i] * al; g += src[i + 1] * al; bl += src[i + 2] * al;
    }
    const o = (y * kb + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = bl / a; }
    out[o + 3] = a / 4;
  }
  return out;
}

/**
 * Farbe der durchsichtigen Pixel nach aussen füllen. Canvas speichert vormultipliziert, die Farbe unter
 * Alpha 0 geht beim Auslesen verloren — ohne diese Füllung zieht das lineare Filtern dunkle Säume in den Rand.
 */
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

let atlas: Promise<HorstAtlas> | null = null;

/** Atlas und Kachelliste laden (einmal, geteilt von allen Ringen); ohne Browser nie erfüllt. */
export function ladeHorstAtlas(): Promise<HorstAtlas> {
  if (atlas) return atlas;
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return (atlas = new Promise(() => {}));
  atlas = (async () => {
    const [daten, bild] = await Promise.all([
      fetch('/material/gras-horste.json').then((r) => r.json()) as Promise<{ kacheln: HorstKachel[] }>,
      fetch('/material/gras-horste.webp').then((r) => r.blob()).then((b) => createImageBitmap(b, { premultiplyAlpha: 'none' })),
    ]);
    const zahl = (a: string) => daten.kacheln.filter((k) => k.art === a).length;
    if (zahl('gruen') !== HORST_GRUEN || zahl('stroh') !== HORST_STROH || zahl('kraut') !== HORST_KRAUT || zahl('blume') !== HORST_BLUME)
      console.warn(`[grashorst] Atlas hat ${zahl('gruen')}/${zahl('stroh')}/${zahl('kraut')}/${zahl('blume')} Kacheln, erwartet ${HORST_GRUEN}/${HORST_STROH}/${HORST_KRAUT}/${HORST_BLUME}`);
    const c = document.createElement('canvas');
    c.width = bild.width; c.height = bild.height;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(bild, 0, 0);
    const roh = new Uint8Array(c.width * c.height * 4);
    roh.set(g.getImageData(0, 0, c.width, c.height).data);
    fuelleFarbe(roh, c.width, c.height, 4);
    const ziel = deckung(roh);
    const stufen: { data: Uint8Array<ArrayBuffer>; width: number; height: number }[] = [];
    let ist: Uint8Array<ArrayBuffer> = roh, b = c.width, h = c.height;
    for (let s = 0; s < MIP_STUFEN; s++) {
      let aus: Uint8Array<ArrayBuffer> = ist;
      if (s > 0) {
        let lo = 1, hi = 4;   // Deckel 4: darüber werden aus Rauschen ausgefranste Flecken
        for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (deckung(ist, mid) < ziel) lo = mid; else hi = mid; }
        aus = new Uint8Array(ist);
        for (let i = 3; i < aus.length; i += 4) aus[i] = Math.min(255, ist[i] * hi);
      }
      stufen.push({ data: aus, width: b, height: h });
      ist = halbiere(ist, b, h); b >>= 1; h >>= 1;
    }
    const t = new THREE.DataTexture(stufen[0].data, c.width, c.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.mipmaps = stufen;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    t.flipY = false;
    t.needsUpdate = true;
    bild.close();
    return { textur: t, kacheln: daten.kacheln };
  })();
  return atlas;
}
