/**
 * Prozedurale Attrappen — sechs Arten, je sechs Varianten, als GLB unter
 * `public/props`.
 *
 * ## Warum nicht mehr Kenney (D120)
 *
 * Bis zum 07.09.2026 kamen die 36 Props aus dem Kenney Nature Kit (D74), umgefärbt
 * und verschmolzen. Drei Dinge liessen sich damit nicht erreichen:
 *
 *   1. **Der Korridor.** D111 verlangt 150–800 Dreiecke je Prop, weil G-111
 *      gemessen hat, dass Dreiecke auf dem Zielgerät fast nichts kosten und die
 *      Stilreferenz Findlinge mit Facetten zeigt, nicht mit 16 Dreiecken. Kenney
 *      baut für ein anderes Ziel: Median 76, Findling 37, Busch 39.
 *   2. **Eine Farbe je Fläche.** Ein Kenney-Busch ist eine Rolle in einer Farbe.
 *      Die Referenz lebt von Tonwechseln innerhalb einer Fläche — helle Ober-,
 *      dunkle Unterseite, Facetten, die sich um 5–10 % unterscheiden. Das lässt
 *      sich nachträglich nur über die Höhe einbacken, nicht über die Form.
 *   3. **Herkunft.** Ein Generator im Repo hat keine Lizenzfrage, kein Kit zum
 *      Entpacken und ändert sich mit der Palette, nicht gegen sie.
 *
 * Jede Art hat hier ein **Bauplan**: Findlinge aus einer Ikosphäre mit
 * Rauschen und Schnittebenen (Facetten), Büsche aus überlappenden Knollen mit
 * Ober-/Unterseitenton, Totholz aus gebogenen Zylindern mit Rinde und
 * Stirnholz, Gras und Blumen aus Halmen mit Farbverlauf, Pilze als Drehkörper.
 * Alle Farben kommen aus `PALETTE` (D117); die Bodenkontakt-Abdunklung und der
 * Höhenverlauf werden wie zuvor eingebacken.
 *
 * Determinismus: jede Variante würfelt aus ihrem Namen — derselbe Name ergibt
 * dasselbe Modell, bei jedem Lauf, auf jeder Maschine.
 *
 * Umlaufrichtung (G-128): Das Prop-Material ist einseitig. Jedes Teil richtet
 * seine Dreiecke nach dem Bau von seinem Zentrum weg; `pruefeUmlauf` misst es
 * am Ende noch einmal über das ganze Modell.
 *
 * `npm run props:bau`
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, quantize, weld } from '@gltf-transform/functions';
import { mkdirSync, statSync } from 'node:fs';
import { VARIANTEN, mulberry, type PropArt } from '../src/world/props.js';
import { PALETTE } from '../src/world/palette.js';

type V3 = [number, number, number];
const ZIEL = 'public/props';
mkdirSync(ZIEL, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** sRGB-Hex zu linearem Float — three.js rechnet Vertexfarben linear. */
function linear(hex: string): V3 {
  const n = parseInt(hex.slice(1), 16);
  const kanal = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [kanal((n >> 16) & 255), kanal((n >> 8) & 255), kanal(n & 255)];
}
const mix = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mal = (a: V3, f: number): V3 => [a[0] * f, a[1] * f, a[2] * f];

/** Die Rollen der Palette, linear. */
const K = PALETTE.kenney;
const F = {
  stein: linear(K.stone), steinDunkel: linear(K.stoneDark), moos: linear(K.grass),
  laubHell: linear(K.leafsGreen), laub: linear(K.grass), laubDunkel: linear(K.leafsDark),
  rinde: linear(K.woodBark), rindeDunkel: linear(K.woodBarkDark), holz: linear(K.woodInner), holzDunkel: linear(K.woodDark),
  grasFuss: linear(PALETTE.streu.grasFuss), grasSpitze: linear(PALETTE.streu.grasSpitze),
  gelb: linear(K.colorYellow), rot: linear(K.colorRed), rotDunkel: linear(K.colorRedDark),
  violett: linear(K.colorPurple), weiss: linear(K.colorWhite), tan: linear(K.colorTan),
  erde: linear(K.dirtDark),
};

// ----------------------------------------------------------------- Werkzeuge

/** Wertrauschen in drei Dimensionen, glatt, in −1…1. */
function rauschen(x: number, y: number, z: number, saat: number): number {
  const h = (i: number, j: number, k: number) => {
    let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ Math.imul(saat | 0, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1103515245);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296 * 2 - 1;
  };
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const g = (t: number) => t * t * (3 - 2 * t);
  const fx = g(x - x0), fy = g(y - y0), fz = g(z - z0);
  let s = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++)
    s += h(x0 + i, y0 + j, z0 + k) * (i ? fx : 1 - fx) * (j ? fy : 1 - fy) * (k ? fz : 1 - fz);
  return s;
}
const fbm = (p: V3, f: number, saat: number) =>
  rauschen(p[0] * f, p[1] * f, p[2] * f, saat) * 0.65 + rauschen(p[0] * f * 2.1, p[1] * f * 2.1, p[2] * f * 2.1, saat + 7) * 0.35;

/** Dreiecke mit Farbe je Ecke. */
class Netz {
  pos: number[] = [];
  farbe: number[] = [];
  tri(a: V3, b: V3, c: V3, fa: V3, fb: V3 = fa, fc: V3 = fa) {
    this.pos.push(...a, ...b, ...c);
    this.farbe.push(...fa, ...fb, ...fc);
  }
  quad(a: V3, b: V3, c: V3, d: V3, f: V3, f2: V3 = f) { this.tri(a, b, c, f, f, f2); this.tri(a, c, d, f, f2, f2); }
  get dreiecke() { return this.pos.length / 9; }
  /**
   * Alle Dreiecke ab `ab` von `zentrum` weg richten — die Sichtseite ist die
   * Aussenseite (G-128). `zentrum` bekommt den Schwerpunkt und liefert den
   * Punkt, von dem weg gezeigt werden soll: bei einer Knolle ihre Mitte, bei
   * einem Stamm der Punkt auf seiner Achse.
   */
  richte(ab: number, zentrum: (c: V3) => V3) {
    for (let t = ab; t < this.pos.length; t += 9) {
      const P = this.pos;
      const c: V3 = [(P[t] + P[t + 3] + P[t + 6]) / 3, (P[t + 1] + P[t + 4] + P[t + 7]) / 3, (P[t + 2] + P[t + 5] + P[t + 8]) / 3];
      const z = zentrum(c);
      const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2];
      const vx = P[t + 6] - P[t], vy = P[t + 7] - P[t + 1], vz = P[t + 8] - P[t + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * (c[0] - z[0]) + ny * (c[1] - z[1]) + nz * (c[2] - z[2]) < 0) {
        for (let i = 0; i < 3; i++) {
          const tmp = P[t + 3 + i]; P[t + 3 + i] = P[t + 6 + i]; P[t + 6 + i] = tmp;
          const Fa = this.farbe; const tf = Fa[t + 3 + i]; Fa[t + 3 + i] = Fa[t + 6 + i]; Fa[t + 6 + i] = tf;
        }
      }
    }
  }
}

/** Ikosphäre: Ecken auf der Einheitskugel, Flächen gegen den Uhrzeigersinn von aussen. */
function ikosphaere(stufen: number): { v: V3[]; f: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  let v: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
                 [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  let f: [number, number, number][] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
    [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const norm = (p: V3): V3 => { const l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l]; };
  v = v.map(norm);
  for (let s = 0; s < stufen; s++) {
    const mitte = new Map<string, number>();
    const m = (a: number, b: number) => {
      const k = a < b ? `${a}:${b}` : `${b}:${a}`;
      let i = mitte.get(k);
      if (i === undefined) { i = v.length; v.push(norm(mix(v[a], v[b], 0.5))); mitte.set(k, i); }
      return i;
    };
    const neu: [number, number, number][] = [];
    for (const [a, b, c] of f) {
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      neu.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    f = neu;
  }
  return { v, f };
}

/** Zufällige Richtung auf der Einheitskugel. */
const richtung = (w: () => number, yMax = 1): V3 => {
  for (;;) {
    const y = w() * 2 - 1;
    if (Math.abs(y) > yMax) continue;
    const a = w() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  }
};

// ------------------------------------------------------------------ Baupläne

/**
 * Findling: Ikosphäre, verrauscht, gestaucht, von Schnittebenen facettiert.
 *
 * Die Schnittebenen sind das, was einen Fels von einer Kartoffel unterscheidet:
 * Wo eine Ebene die Kugel schneidet, entsteht eine plane Facette mit einer
 * harten Kante, und genau diese Kanten liest die Kontur (D115) als Fels.
 * Die Unterseite wird abgeflacht, damit der Stein auf dem Boden **steht**.
 */
function findling(n: Netz, w: () => number, s: { sx: number; sy: number; sz: number; kanten: number; rau: number; moos: number }) {
  const saat = Math.floor(w() * 1e6);
  const { v, f } = ikosphaere(2);
  const p: V3[] = v.map(q => {
    const r = 1 + s.rau * fbm(q, 1.6, saat);
    return [q[0] * r * s.sx, q[1] * r * s.sy, q[2] * r * s.sz];
  });
  for (let k = 0; k < s.kanten; k++) {
    const nrm = richtung(w, 0.75);
    const spann = Math.hypot(nrm[0] * s.sx, nrm[1] * s.sy, nrm[2] * s.sz);
    const d = spann * (0.55 + 0.3 * w());
    for (const q of p) {
      const e = q[0] * nrm[0] + q[1] * nrm[1] + q[2] * nrm[2];
      if (e > d) { q[0] -= (e - d) * nrm[0]; q[1] -= (e - d) * nrm[1]; q[2] -= (e - d) * nrm[2]; }
    }
  }
  const boden = -0.55 * s.sy;
  for (const q of p) if (q[1] < boden) q[1] = boden;
  const ab = n.pos.length;
  for (const [a, b, c] of f) {
    const m: V3 = [(p[a][0] + p[b][0] + p[c][0]) / 3, (p[a][1] + p[b][1] + p[c][1]) / 3, (p[a][2] + p[b][2] + p[c][2]) / 3];
    const ux = p[b][0] - p[a][0], uy = p[b][1] - p[a][1], uz = p[b][2] - p[a][2];
    const vx = p[c][0] - p[a][0], vy = p[c][1] - p[a][1], vz = p[c][2] - p[a][2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    const oben = ny / l;
    let farbe = mix(F.steinDunkel, F.stein, 0.5 + 0.5 * fbm(m, 2.3, saat + 3));
    farbe = mal(farbe, 0.93 + 0.14 * ((fbm(m, 9, saat + 5) + 1) / 2));
    if (oben > 0.45) farbe = mal(farbe, 1.10);
    if (oben > 0.35 && s.moos > 0 && fbm(m, 3.1, saat + 11) > 0.5 - s.moos) farbe = mix(farbe, F.moos, 0.75);
    n.tri(p[a], p[b], p[c], farbe);
  }
  n.richte(ab, () => [0, -0.1 * s.sy, 0]);
}

/**
 * Busch: überlappende Knollen, jede eine grob verrauschte Ikosphäre.
 *
 * Ton nach Blickrichtung der Fläche — Oberseite hell, Flanke mittel,
 * Unterseite dunkel — plus ein Ton je Knolle. Das ist die billigste Form
 * von Volumen: Ein Busch, dessen Unterseite dunkler ist als seine Oberseite,
 * liest sich als Körper, auch wenn er aus 80-Dreieck-Kugeln besteht.
 */
function busch(n: Netz, w: () => number, s: { knollen: number; breite: number; hoehe: number; r: number; rau: number; kegel: number }) {
  const { v, f } = ikosphaere(1);
  for (let i = 0; i < s.knollen; i++) {
    const saat = Math.floor(w() * 1e6);
    const a = w() * Math.PI * 2, d = Math.sqrt(w()) * s.breite;
    const yAnteil = 0.3 + 0.5 * w();
    // Kegelform: je höher die Knolle, desto näher an der Achse.
    const ein = 1 - s.kegel * yAnteil;
    const z: V3 = [Math.cos(a) * d * ein, yAnteil * s.hoehe, Math.sin(a) * d * ein];
    const r = s.r * (0.75 + 0.5 * w()) * (1 - 0.35 * s.kegel * yAnteil);
    const ton = 0.88 + 0.24 * w();
    const p: V3[] = v.map(q => {
      const rr = r * (1 + s.rau * fbm(q, 1.4, saat));
      return [z[0] + q[0] * rr, z[1] + q[1] * rr * 0.85, z[2] + q[2] * rr];
    });
    const ab = n.pos.length;
    for (const [a1, b, c] of f) {
      const m: V3 = [(p[a1][0] + p[b][0] + p[c][0]) / 3, (p[a1][1] + p[b][1] + p[c][1]) / 3, (p[a1][2] + p[b][2] + p[c][2]) / 3];
      const oben = (m[1] - z[1]) / (r * 0.85);
      let farbe = oben > 0.3 ? mix(F.laub, F.laubHell, (oben - 0.3) / 0.7) : oben < -0.2 ? mix(F.laub, F.laubDunkel, (-0.2 - oben) / 0.8) : F.laub;
      farbe = mal(farbe, ton * (0.94 + 0.12 * ((fbm(m, 6, saat + 2) + 1) / 2)));
      n.tri(p[a1], p[b], p[c], farbe);
    }
    n.richte(ab, () => z);
  }
}

/**
 * Ein Rohr entlang einer Kurve: `achse(t)` gibt die Mitte, `radius(t)` die Dicke,
 * `seg` Kanten im Umfang, `ringe` Querschnitte. Rinde mit Facettenton, Unterseite
 * dunkler; optional Stirnholz an beiden Enden.
 */
function rohr(n: Netz, w: () => number, s: {
  achse: (t: number) => V3; radius: (t: number) => number; seg: number; ringe: number;
  rinde: V3; rindeDunkel: V3; stirn?: V3; rau: number; saat: number;
}) {
  const ringP: V3[][] = [];
  for (let i = 0; i <= s.ringe; i++) {
    const t = i / s.ringe;
    const c = s.achse(t), c2 = s.achse(Math.min(1, t + 0.01)), c1 = s.achse(Math.max(0, t - 0.01));
    const ax: V3 = [c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]];
    const al = Math.hypot(...ax) || 1; ax[0] /= al; ax[1] /= al; ax[2] /= al;
    // Zwei Senkrechte zur Achse.
    const hilfe: V3 = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1: V3 = [ax[1] * hilfe[2] - ax[2] * hilfe[1], ax[2] * hilfe[0] - ax[0] * hilfe[2], ax[0] * hilfe[1] - ax[1] * hilfe[0]];
    const l1 = Math.hypot(...e1) || 1; e1[0] /= l1; e1[1] /= l1; e1[2] /= l1;
    const e2: V3 = [ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]];
    const ring: V3[] = [];
    for (let k = 0; k < s.seg; k++) {
      const a = k / s.seg * Math.PI * 2;
      const r = s.radius(t) * (1 + s.rau * rauschen(Math.cos(a) * 2 + t * 5, Math.sin(a) * 2, t * 3, s.saat));
      ring.push([c[0] + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * r,
                 c[1] + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * r,
                 c[2] + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * r]);
    }
    ringP.push(ring);
  }
  const ab = n.pos.length;
  for (let i = 0; i < s.ringe; i++) {
    for (let k = 0; k < s.seg; k++) {
      const k2 = (k + 1) % s.seg;
      const a = ringP[i][k], b = ringP[i][k2], c = ringP[i + 1][k2], d = ringP[i + 1][k];
      const my = (a[1] + b[1] + c[1] + d[1]) / 4, cy = s.achse((i + 0.5) / s.ringe)[1];
      const unten = my < cy - 0.3 * s.radius((i + 0.5) / s.ringe);
      const ton = 0.92 + 0.16 * w();
      const farbe = mal(unten ? s.rindeDunkel : s.rinde, ton);
      n.quad(a, b, c, d, farbe);
    }
  }
  n.richte(ab, c => {
    // Nächster Achspunkt: grob über t aus der Lage längs der Achse.
    let best = s.achse(0), bd = Infinity;
    for (let i = 0; i <= 8; i++) { const q = s.achse(i / 8); const d = Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]); if (d < bd) { bd = d; best = q; } }
    return best;
  });
  if (s.stirn) {
    for (const [ring, t] of [[ringP[0], 0], [ringP[s.ringe], 1]] as const) {
      const c = s.achse(t);
      const ab2 = n.pos.length;
      const innen = mal(s.stirn, 0.8);
      for (let k = 0; k < s.seg; k++) {
        const k2 = (k + 1) % s.seg;
        const mk: V3 = mix(ring[k], c, 0.55), mk2: V3 = mix(ring[k2], c, 0.55);
        n.quad(ring[k], ring[k2], mk2, mk, s.stirn);
        n.tri(mk, mk2, c, innen);
      }
      const aussen = s.achse(t === 0 ? 1 : 0);
      n.richte(ab2, () => aussen);
    }
  }
}

/** Liegender Stamm mit Biegung, Verjüngung und Aststummeln. */
function stamm(n: Netz, w: () => number, s: { laenge: number; r: number; biegung: number; aeste: number; lage?: V3; drehung?: number }) {
  const saat = Math.floor(w() * 1e6);
  const L = s.lage ?? [0, 0, 0], dr = s.drehung ?? 0;
  const cosD = Math.cos(dr), sinD = Math.sin(dr);
  const achse = (t: number): V3 => {
    const x = (t - 0.5) * s.laenge, z = s.biegung * Math.sin(t * Math.PI) * s.laenge * 0.12;
    return [L[0] + x * cosD - z * sinD, L[1] + s.r * 0.95, L[2] + x * sinD + z * cosD];
  };
  rohr(n, w, { achse, radius: t => s.r * (1.06 - 0.22 * t), seg: 8, ringe: 6, rinde: F.rinde, rindeDunkel: F.rindeDunkel, stirn: F.holz, rau: 0.12, saat });
  for (let i = 0; i < s.aeste; i++) {
    const t = 0.2 + 0.6 * w();
    const fuss = achse(t);
    const ri = richtung(w, 0.95); if (ri[1] < 0.2) ri[1] = 0.2 + w() * 0.5;
    const laenge = s.r * (1.2 + 1.2 * w());
    const ende: V3 = [fuss[0] + ri[0] * laenge, fuss[1] + ri[1] * laenge, fuss[2] + ri[2] * laenge];
    rohr(n, w, { achse: u => mix(fuss, ende, u), radius: u => s.r * 0.32 * (1 - 0.4 * u), seg: 6, ringe: 2,
                 rinde: F.rinde, rindeDunkel: F.rindeDunkel, stirn: F.holz, rau: 0.08, saat: saat + i });
  }
}

/** Stehender Stumpf mit Wurzelanläufen und Stirnholz mit dunklem Kern. */
function stumpf(n: Netz, w: () => number, s: { r: number; hoehe: number; wurzeln: number; wurzelLaenge: number }) {
  const saat = Math.floor(w() * 1e6);
  rohr(n, w, { achse: t => [0, t * s.hoehe, 0], radius: t => s.r * (t < 0.3 ? 1.3 - t : 1 - 0.05 * t), seg: 9, ringe: 4,
               rinde: F.rinde, rindeDunkel: F.rindeDunkel, rau: 0.1, saat });
  // Stirnholz oben: Ring hell, Kern dunkel.
  const ab = n.pos.length;
  const c: V3 = [0, s.hoehe, 0], seg = 9;
  for (let k = 0; k < seg; k++) {
    const a1 = k / seg * Math.PI * 2, a2 = (k + 1) / seg * Math.PI * 2, r = s.r * 0.95;
    const p1: V3 = [Math.cos(a1) * r, s.hoehe, Math.sin(a1) * r], p2: V3 = [Math.cos(a2) * r, s.hoehe, Math.sin(a2) * r];
    n.quad(p1, p2, mix(p2, c, 0.6), mix(p1, c, 0.6), F.holz);
    n.tri(mix(p1, c, 0.6), mix(p2, c, 0.6), c, F.holzDunkel);
  }
  n.richte(ab, () => [0, 0, 0]);
  for (let i = 0; i < s.wurzeln; i++) {
    const a = (i + 0.3 * w()) / s.wurzeln * Math.PI * 2;
    const d: V3 = [Math.cos(a), 0, Math.sin(a)];
    const fuss: V3 = [d[0] * s.r * 0.9, s.hoehe * 0.35, d[2] * s.r * 0.9];
    const ende: V3 = [d[0] * (s.r + s.wurzelLaenge), 0.02, d[2] * (s.r + s.wurzelLaenge)];
    rohr(n, w, { achse: u => mix(fuss, ende, u), radius: u => s.r * 0.3 * (1 - 0.6 * u), seg: 5, ringe: 2,
                 rinde: F.rinde, rindeDunkel: F.rindeDunkel, rau: 0.1, saat: saat + 3 + i });
  }
}

/**
 * Halm: ein Streifen aus drei Vierecken, der sich nach aussen biegt und zur
 * Spitze schmaler wird. Farbe als Verlauf Fuss → Spitze je Ecke — das ist
 * die eine Stelle, an der Vertexfarbe **mehr** kann als eine Textur je Fläche.
 * Sichtseite nach aussen (Halme lehnen vom Büschel weg; die abgewandte Hälfte
 * eines Büschels ist von jedem Standpunkt aus ohnehin verdeckt).
 */
function halm(n: Netz, s: { fuss: V3; winkel: number; neigung: number; hoehe: number; breite: number; fussFarbe: V3; spitzenFarbe: V3; biegung: number }) {
  const d: V3 = [Math.cos(s.winkel), 0, Math.sin(s.winkel)];
  const q: V3 = [-d[2], 0, d[0]];   // quer zum Halm
  const P = (t: number, seite: number): V3 => {
    const lean = s.neigung * t + s.biegung * t * t;
    const br = s.breite * (1 - 0.85 * t) * seite;
    return [s.fuss[0] + d[0] * lean * s.hoehe + q[0] * br, s.fuss[1] + s.hoehe * t * (1 - 0.35 * t * t * s.neigung), s.fuss[2] + d[2] * lean * s.hoehe + q[2] * br];
  };
  const ab = n.pos.length;
  for (let i = 0; i < 3; i++) {
    const t0 = i / 3, t1 = (i + 1) / 3;
    const f0 = mix(s.fussFarbe, s.spitzenFarbe, t0), f1 = mix(s.fussFarbe, s.spitzenFarbe, t1);
    n.tri(P(t0, -1), P(t0, 1), P(t1, 1), f0, f0, f1);
    n.tri(P(t0, -1), P(t1, 1), P(t1, -1), f0, f1, f1);
  }
  n.richte(ab, () => [s.fuss[0] - d[0], s.fuss[1], s.fuss[2] - d[2]]);
}

function grasbuschel(n: Netz, w: () => number, s: { halme: number; hoehe: number; breite: number; neigung: number; fussR: number }) {
  for (let i = 0; i < s.halme; i++) {
    const a = w() * Math.PI * 2, r = Math.sqrt(w()) * s.fussR;
    halm(n, { fuss: [Math.cos(a) * r, 0, Math.sin(a) * r], winkel: a + (w() - 0.5) * 0.6, neigung: s.neigung * (0.6 + 0.8 * w()),
              hoehe: s.hoehe * (0.55 + 0.45 * w()), breite: s.breite * (0.7 + 0.6 * w()),
              fussFarbe: mal(F.grasFuss, 0.9 + 0.2 * w()), spitzenFarbe: mal(F.grasSpitze, 0.9 + 0.2 * w()), biegung: 0.2 });
  }
}

/**
 * Farn (D212): Wedel aus einer gebogenen Mittelrippe mit Fiederpaaren, die zur Spitze kürzer
 * werden. Ein Wedel steigt steil auf und hängt aussen über — die Silhouette, an der man Farn
 * erkennt. Fiedern als je ein schmales Dreieck: Aus der Nähe genügt das Zackenprofil, aus 20 m
 * liest sich ohnehin nur der Umriss des Wedels. Sichtseite nach oben.
 */
function farn(n: Netz, w: () => number, s: { wedel: number; laenge: number; fiedern: number; breite: number; steil: number }) {
  for (let i = 0; i < s.wedel; i++) {
    const a = (i / s.wedel) * Math.PI * 2 + (w() - 0.5) * 0.7;
    const d: V3 = [Math.cos(a), 0, Math.sin(a)];
    const q: V3 = [-d[2], 0, d[0]];
    const laenge = s.laenge * (0.7 + 0.3 * w());
    const steil = s.steil * (0.8 + 0.4 * w());
    // Mittelrippe als Bogen: aufsteigend, dann überhängend.
    const P = (t: number): V3 => {
      const aus = t * laenge, hoch = Math.sin(t * Math.PI * 0.62) * laenge * steil - t * t * laenge * 0.25;
      return [d[0] * aus, Math.max(0.02, hoch), d[2] * aus];
    };
    const ab = n.pos.length;
    // Zweiter Render (D212): helle Töne lasen sich auf dem Waldboden grau — Farn ist satt und dunkel.
    const fuss = mal(F.laubDunkel, 0.6), mitte = mix(F.laubDunkel, F.laub, 0.35), spitze = F.laub;
    for (let k = 0; k < s.fiedern; k++) {
      const t = 0.14 + (k / s.fiedern) * 0.82, t2 = t + 0.82 / s.fiedern;
      const p = P(t), p2 = P(t2);
      const lang = s.breite * laenge * Math.sin(Math.min(1, t * 1.35) * Math.PI) * (0.85 + 0.3 * w());
      const farbe = mix(mitte, spitze, t);
      for (const seite of [-1, 1]) {
        // Fieder als Blättchen: schräg nach vorn, leicht hängend, mit Breite entlang der Rippe —
        // ein Dreieck allein las sich als Stachel.
        const spitzeF: V3 = [p[0] + (q[0] * seite + d[0] * 0.45) * lang, p[1] - lang * 0.18, p[2] + (q[2] * seite + d[2] * 0.45) * lang];
        const spitzeG: V3 = [p2[0] + (q[0] * seite + d[0] * 0.35) * lang * 0.8, p2[1] - lang * 0.16, p2[2] + (q[2] * seite + d[2] * 0.35) * lang * 0.8];
        n.tri(p, p2, spitzeF, mix(fuss, farbe, 0.6), farbe, mal(farbe, 1.06));
        n.tri(p2, spitzeG, spitzeF, farbe, mal(farbe, 1.04), mal(farbe, 1.06));
      }
    }
    // Rippe selbst als schmaler Streifen bis zur ersten Fieder.
    const r0 = P(0), r1 = P(0.14);
    const b = 0.012 * laenge;
    n.quad([r0[0] - q[0] * b, r0[1], r0[2] - q[2] * b], [r0[0] + q[0] * b, r0[1], r0[2] + q[2] * b],
           [r1[0] + q[0] * b, r1[1], r1[2] + q[2] * b], [r1[0] - q[0] * b, r1[1], r1[2] - q[2] * b], fuss, mitte);
    n.richte(ab, (c) => [c[0], c[1] - 10, c[2]]);
  }
}

/** Ein kleiner Doppelkegel als Blütenkopf. */
function knospe(n: Netz, z: V3, r: number, h: number, oben: V3, unten: V3) {
  const ab = n.pos.length;
  const seg = 5;
  for (let k = 0; k < seg; k++) {
    const a1 = k / seg * Math.PI * 2, a2 = (k + 1) / seg * Math.PI * 2;
    const p1: V3 = [z[0] + Math.cos(a1) * r, z[1], z[2] + Math.sin(a1) * r], p2: V3 = [z[0] + Math.cos(a2) * r, z[1], z[2] + Math.sin(a2) * r];
    n.tri(p1, p2, [z[0], z[1] + h, z[2]], oben);
    n.tri(p2, p1, [z[0], z[1] - h * 0.6, z[2]], unten);
  }
  n.richte(ab, () => z);
}

function blume(n: Netz, w: () => number, s: { stiele: number; hoehe: number; bluete: V3; blueteDunkel: V3; blaetter: number; breite: number }) {
  for (let i = 0; i < s.blaetter; i++) {
    const a = w() * Math.PI * 2;
    halm(n, { fuss: [Math.cos(a) * 0.02, 0, Math.sin(a) * 0.02], winkel: a, neigung: 0.9 + 0.6 * w(), hoehe: s.hoehe * (0.35 + 0.25 * w()),
              breite: s.hoehe * 0.09, fussFarbe: F.laubDunkel, spitzenFarbe: F.laub, biegung: 0.4 });
  }
  for (let i = 0; i < s.stiele; i++) {
    const a = w() * Math.PI * 2, r = Math.sqrt(w()) * s.breite;
    const h = s.hoehe * (0.7 + 0.3 * w());
    const fuss: V3 = [Math.cos(a) * r, 0, Math.sin(a) * r];
    const lean = 0.1 + 0.2 * w();
    const kopf: V3 = [fuss[0] + Math.cos(a) * lean * h, h, fuss[2] + Math.sin(a) * lean * h];
    rohr(n, w, { achse: t => mix(fuss, kopf, t), radius: () => s.hoehe * 0.018, seg: 3, ringe: 1,
                 rinde: F.laub, rindeDunkel: F.laubDunkel, rau: 0, saat: i });
    knospe(n, kopf, s.hoehe * (0.09 + 0.05 * w()), s.hoehe * 0.07, s.bluete, s.blueteDunkel);
  }
}

/** Pilz als Drehkörper: Hut mit Rand, Lamellenunterseite, Stiel. */
function pilz(n: Netz, w: () => number, s: { r: number; hoehe: number; stielR: number; hut: V3; hutDunkel: V3; stiel: V3; lage?: V3 }) {
  const L = s.lage ?? [0, 0, 0];
  const seg = 9, h = s.hoehe;
  // Profil (Radius, Höhe, Farbe) von der Hutspitze bis zum Stielfuss.
  const profil: [number, number, V3][] = [
    [0, h, s.hut], [s.r * 0.5, h * 0.93, s.hut], [s.r * 0.88, h * 0.78, mix(s.hut, s.hutDunkel, 0.5)], [s.r, h * 0.62, s.hutDunkel],
    [s.r * 0.9, h * 0.57, mal(s.stiel, 0.9)], [s.stielR * 1.2, h * 0.55, mal(s.stiel, 0.8)],
    [s.stielR, h * 0.5, s.stiel], [s.stielR * 1.15, 0, mal(s.stiel, 0.75)],
  ];
  const ab = n.pos.length;
  const P = (i: number, k: number): V3 => {
    const a = k / seg * Math.PI * 2;
    const [r, y] = profil[i];
    const rr = r * (1 + 0.06 * rauschen(Math.cos(a) * 3, y * 7, Math.sin(a) * 3, 17));
    return [L[0] + Math.cos(a) * rr, L[1] + y, L[2] + Math.sin(a) * rr];
  };
  for (let i = 0; i < profil.length - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const k2 = (k + 1) % seg;
      const f = profil[i][2], f2 = profil[i + 1][2];
      if (profil[i][0] === 0) n.tri(P(i, 0), P(i + 1, k), P(i + 1, k2), f, f2, f2);
      else n.quad(P(i, k), P(i, k2), P(i + 1, k2), P(i + 1, k), f, f2);
    }
  }
  // Hut: vom Hutinneren weg (Oberseite nach oben, Lamellen nach unten); Stiel: von der Achse weg.
  n.richte(ab, c => c[1] > L[1] + h * 0.5 ? [L[0], L[1] + h * 0.8, L[2]] : [L[0], c[1], L[2]]);
}

// ------------------------------------------------------------ Die 36 Baupläne

type Bauplan = (n: Netz, w: () => number) => void;
const dunkler = (f: V3) => mal(f, 0.72);
const BAUPLAN: Record<string, Bauplan> = {
  findling_flach: (n, w) => findling(n, w, { sx: 1.3, sy: 0.5, sz: 1.0, kanten: 4, rau: 0.18, moos: 0.2 }),
  findling_klein: (n, w) => findling(n, w, { sx: 1.0, sy: 0.85, sz: 0.9, kanten: 5, rau: 0.22, moos: 0.15 }),
  findling_kant:  (n, w) => findling(n, w, { sx: 1.0, sy: 1.0, sz: 0.8, kanten: 8, rau: 0.12, moos: 0 }),
  findling_hoch:  (n, w) => findling(n, w, { sx: 0.8, sy: 1.4, sz: 0.75, kanten: 6, rau: 0.16, moos: 0.1 }),
  findling_block: (n, w) => findling(n, w, { sx: 1.2, sy: 1.0, sz: 0.9, kanten: 9, rau: 0.10, moos: 0.05 }),
  findling_gross: (n, w) => findling(n, w, { sx: 1.3, sy: 1.0, sz: 1.1, kanten: 6, rau: 0.20, moos: 0.25 }),

  busch_klein:   (n, w) => busch(n, w, { knollen: 3, breite: 0.35, hoehe: 0.7, r: 0.40, rau: 0.15, kegel: 0.2 }),
  busch_dreieck: (n, w) => busch(n, w, { knollen: 5, breite: 0.40, hoehe: 1.0, r: 0.42, rau: 0.15, kegel: 0.8 }),
  busch_mittel:  (n, w) => busch(n, w, { knollen: 5, breite: 0.50, hoehe: 0.9, r: 0.50, rau: 0.15, kegel: 0.3 }),
  busch_dicht:   (n, w) => busch(n, w, { knollen: 7, breite: 0.55, hoehe: 1.0, r: 0.42, rau: 0.12, kegel: 0.3 }),
  busch_breit:   (n, w) => busch(n, w, { knollen: 6, breite: 0.90, hoehe: 0.8, r: 0.55, rau: 0.15, kegel: 0.2 }),
  busch_gross:   (n, w) => busch(n, w, { knollen: 8, breite: 0.80, hoehe: 1.2, r: 0.60, rau: 0.15, kegel: 0.4 }),

  totholz_stamm:  (n, w) => stamm(n, w, { laenge: 4, r: 0.5, biegung: 0.5, aeste: 1 }),
  totholz_dick:   (n, w) => stamm(n, w, { laenge: 4, r: 0.75, biegung: 0.3, aeste: 2 }),
  totholz_stapel: (n, w) => {
    stamm(n, w, { laenge: 3.6, r: 0.42, biegung: 0.1, aeste: 0, lage: [0, 0, -0.45] });
    stamm(n, w, { laenge: 3.4, r: 0.42, biegung: 0.1, aeste: 0, lage: [0.2, 0, 0.45] });
    stamm(n, w, { laenge: 3.2, r: 0.40, biegung: 0.1, aeste: 1, lage: [0.1, 0.72, 0] });
  },
  totholz_stumpf: (n, w) => stumpf(n, w, { r: 0.6, hoehe: 1.0, wurzeln: 4, wurzelLaenge: 0.5 }),
  totholz_wurzel: (n, w) => stumpf(n, w, { r: 0.5, hoehe: 1.3, wurzeln: 6, wurzelLaenge: 1.1 }),
  totholz_kante:  (n, w) => {
    stumpf(n, w, { r: 0.7, hoehe: 0.8, wurzeln: 3, wurzelLaenge: 0.4 });
    stamm(n, w, { laenge: 1.8, r: 0.3, biegung: 0, aeste: 0, lage: [1.3, 0, 0.4], drehung: 0.5 });
  },

  // Halme breiter als echte: Ein Halm von 6 mm ist auf 10 m ein Subpixel, und
  // ein Büschel aus Subpixeln ist unsichtbar (G-117, G-125). 12–20 % der Höhe.
  // Erster Lauf im Spiel: Halme mit Neigung 0,35–1,3 lasen sich von oben als
  // Seesterne. Jetzt aufrechter und halb so breit gestreut. Farbverlauf wie die
  // Streuung (`streu.grasFuss` → `grasSpitze`), damit Büschel und gestreutes
  // Gras dieselbe Pflanze sind — zwei Grüntöne nebeneinander lesen sich als
  // zwei Systeme.
  gras_matte:  (n, w) => grasbuschel(n, w, { halme: 30, hoehe: 1, breite: 0.16, neigung: 0.9, fussR: 0.35 }),
  gras_kurz:   (n, w) => grasbuschel(n, w, { halme: 26, hoehe: 1, breite: 0.13, neigung: 0.35, fussR: 0.2 }),
  gras_halme:  (n, w) => grasbuschel(n, w, { halme: 28, hoehe: 1, breite: 0.10, neigung: 0.28, fussR: 0.16 }),
  gras_hoch:   (n, w) => grasbuschel(n, w, { halme: 26, hoehe: 1, breite: 0.10, neigung: 0.25, fussR: 0.16 }),
  gras_blatt:  (n, w) => grasbuschel(n, w, { halme: 20, hoehe: 1, breite: 0.18, neigung: 0.45, fussR: 0.16 }),
  gras_staude: (n, w) => grasbuschel(n, w, { halme: 30, hoehe: 1, breite: 0.11, neigung: 0.22, fussR: 0.2 }),

  // D212: Farn im Waldunterwuchs. Wurmfarn steht 0,5–1,2 m, Adlerfarn bis 1,5 m.
  farn_klein:  (n, w) => farn(n, w, { wedel: 8, laenge: 1, fiedern: 10, breite: 0.2, steil: 1.1 }),
  farn_mittel: (n, w) => farn(n, w, { wedel: 9, laenge: 1, fiedern: 10, breite: 0.21, steil: 1.25 }),
  farn_breit:  (n, w) => farn(n, w, { wedel: 10, laenge: 1, fiedern: 10, breite: 0.23, steil: 0.95 }),
  farn_hoch:   (n, w) => farn(n, w, { wedel: 9, laenge: 1, fiedern: 11, breite: 0.19, steil: 1.5 }),

  blume_gelb:     (n, w) => blume(n, w, { stiele: 6, hoehe: 1, bluete: F.gelb, blueteDunkel: dunkler(F.gelb), blaetter: 6, breite: 0.25 }),
  blume_gelb2:    (n, w) => blume(n, w, { stiele: 9, hoehe: 1, bluete: F.gelb, blueteDunkel: dunkler(F.gelb), blaetter: 5, breite: 0.32 }),
  blume_rot:      (n, w) => blume(n, w, { stiele: 6, hoehe: 1, bluete: F.rot, blueteDunkel: F.rotDunkel, blaetter: 6, breite: 0.25 }),
  blume_rot2:     (n, w) => blume(n, w, { stiele: 9, hoehe: 1, bluete: F.rot, blueteDunkel: F.rotDunkel, blaetter: 5, breite: 0.32 }),
  blume_violett:  (n, w) => blume(n, w, { stiele: 6, hoehe: 1, bluete: F.violett, blueteDunkel: dunkler(F.violett), blaetter: 6, breite: 0.25 }),
  blume_violett2: (n, w) => blume(n, w, { stiele: 9, hoehe: 1, bluete: F.violett, blueteDunkel: dunkler(F.violett), blaetter: 5, breite: 0.32 }),

  pilz_rot:        (n, w) => pilz(n, w, { r: 0.5, hoehe: 1, stielR: 0.13, hut: F.rot, hutDunkel: F.rotDunkel, stiel: F.weiss }),
  pilz_rot_hoch:   (n, w) => pilz(n, w, { r: 0.33, hoehe: 1, stielR: 0.09, hut: F.rot, hutDunkel: F.rotDunkel, stiel: F.weiss }),
  pilz_rot_gruppe: (n, w) => {
    pilz(n, w, { r: 0.45, hoehe: 1, stielR: 0.12, hut: F.rot, hutDunkel: F.rotDunkel, stiel: F.weiss, lage: [0, 0, 0] });
    pilz(n, w, { r: 0.32, hoehe: 0.7, stielR: 0.09, hut: F.rot, hutDunkel: F.rotDunkel, stiel: F.weiss, lage: [0.6, 0, 0.25] });
    pilz(n, w, { r: 0.26, hoehe: 0.5, stielR: 0.08, hut: F.rot, hutDunkel: F.rotDunkel, stiel: F.weiss, lage: [-0.4, 0, 0.45] });
  },
  pilz_hell:       (n, w) => pilz(n, w, { r: 0.5, hoehe: 1, stielR: 0.14, hut: F.tan, hutDunkel: dunkler(F.tan), stiel: mal(F.weiss, 0.9) }),
  pilz_hell_hoch:  (n, w) => pilz(n, w, { r: 0.33, hoehe: 1, stielR: 0.1, hut: F.tan, hutDunkel: dunkler(F.tan), stiel: mal(F.weiss, 0.9) }),
  pilz_hell_grupp: (n, w) => {
    pilz(n, w, { r: 0.45, hoehe: 1, stielR: 0.13, hut: F.tan, hutDunkel: dunkler(F.tan), stiel: mal(F.weiss, 0.9), lage: [0, 0, 0] });
    pilz(n, w, { r: 0.3, hoehe: 0.65, stielR: 0.09, hut: F.tan, hutDunkel: dunkler(F.tan), stiel: mal(F.weiss, 0.9), lage: [0.55, 0, -0.3] });
    pilz(n, w, { r: 0.25, hoehe: 0.5, stielR: 0.08, hut: F.tan, hutDunkel: dunkler(F.tan), stiel: mal(F.weiss, 0.9), lage: [-0.45, 0, 0.35] });
  },
};

/**
 * Helligkeit über die Höhe — Bodenkontakt und Verlauf, eingebacken wie bisher:
 * die untersten 12 % gehen auf 58 %, darüber von 0,88 am Fuss auf 1,06 an der
 * Spitze. Zur Laufzeit gratis.
 */
function schattierung(t: number): number {
  const kontakt = 0.58 + 0.42 * Math.min(1, t / 0.12);
  return (0.88 + 0.18 * t) * kontakt;
}

/** Saat aus dem Dateinamen — derselbe Name, dasselbe Modell. */
function saatAus(name: string): number {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

let gesamtKB = 0, gesamtTris = 0, gebaut = 0;
console.log('Prozedurale Attrappen (D120)\n');
for (const [art, varianten] of Object.entries(VARIANTEN) as [PropArt, typeof VARIANTEN[PropArt]][]) {
  if (!varianten.length) continue;
  console.log(art);
  for (const v of varianten) {
    const plan = BAUPLAN[v.datei];
    if (!plan) { console.log(`  ✗ ${v.datei}: kein Bauplan`); continue; }
    const netz = new Netz();
    plan(netz, mulberry(saatAus(v.datei)));
    const { pos, farbe } = netz;
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      minX = Math.min(minX, pos[i]);     maxX = Math.max(maxX, pos[i]);
      minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
      minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
    }
    const spanne = Math.max(1e-6, maxY - minY), faktor = v.hoehe / spanne;
    const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2;
    for (let i = 0; i < pos.length; i += 3) {
      const t = (pos[i + 1] - minY) / spanne;
      pos[i] = (pos[i] - mx) * faktor; pos[i + 1] = (pos[i + 1] - minY) * faktor; pos[i + 2] = (pos[i + 2] - mz) * faktor;
      const s = schattierung(t);
      farbe[i] *= s; farbe[i + 1] *= s; farbe[i + 2] *= s;
    }
    const raus = new Document();
    const puffer = raus.createBuffer();
    const prim = raus.createPrimitive()
      .setAttribute('POSITION', raus.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(puffer))
      .setAttribute('COLOR_0', raus.createAccessor().setType('VEC3').setArray(new Float32Array(farbe)).setBuffer(puffer))
      .setMaterial(raus.createMaterial('prop').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0));
    // Gras bekommt Normalen senkrecht nach oben (D121), wie die Streuung: Ein
    // Halm mit seiner Flächennormale steht halb im Eigenschatten und war im
    // Bild dunkler als das gestreute Gras daneben — dieselbe Pflanze in zwei
    // Helligkeiten. Die Szene zeichnet Gras deshalb glatt statt flach schattiert.
    if (art === 'grasbuschel' || art === 'farn') {
      const hoch = new Float32Array(pos.length);
      for (let i = 1; i < hoch.length; i += 3) hoch[i] = 1;
      prim.setAttribute('NORMAL', raus.createAccessor().setType('VEC3').setArray(hoch).setBuffer(puffer));
    }
    const mesh = raus.createMesh(v.datei).addPrimitive(prim);
    raus.createScene().addChild(raus.createNode(v.datei).setMesh(mesh));
    // Quantisieren (KHR_mesh_quantization, three.js liest es nativ): Position
    // 14 Bit, Farbe 8 Bit — halbiert die Datei, und 8 Bit Farbe ist genau das,
    // was der Bildschirm ohnehin zeigt.
    await raus.transform(weld(), quantize({ quantizePosition: 14, quantizeColor: 8, quantizeNormal: 8, quantizeTexcoord: 12 }), prune());
    const ziel = `${ZIEL}/${v.datei}.glb`;
    await io.write(ziel, raus);
    const kb = statSync(ziel).size / 1024, tris = pos.length / 9;
    gesamtKB += kb; gesamtTris += tris; gebaut++;
    const breite = Math.max(maxX - minX, maxZ - minZ) * faktor;
    console.log(`  ${v.datei.padEnd(16)} ${String(tris).padStart(4)} Tris · ${v.hoehe.toFixed(2).padStart(5)} m hoch · ${breite.toFixed(2).padStart(5)} m breit · ${kb.toFixed(1).padStart(5)} KB`);
  }
}
console.log(`\n${gebaut} Modelle · ${gesamtTris} Dreiecke · ${gesamtKB.toFixed(0)} KB gesamt`);
