/**
 * BRACHLAND — Der Flussvater als Modell (D241)
 *
 *   npx tsx tools/welsbau.ts
 *
 * Story-Bibel §5: Riesenwels × Kläranlagen-Organik. Bis D241 stand der Regent als Silhouette
 * (`bauSchlange`: sieben Kisten) in Welt und Kampf. Ein freies Modell gibt es nicht —
 * poly.pizza, die Quelle der übrigen Tiere, ist aus der Arbeitsumgebung gesperrt, Poly Haven
 * hat keine Tiere. Deshalb prozedural, wie die Attrappen (D120), und damit eigene Arbeit (CC0).
 *
 * Bau: Rumpf als Querschnitt-Loft von der Nase (−Z) zum Schwanz — breiter, flacher Kopf,
 * seitlich gestauchter Schwanz, wie beim Wels. Dazu sechs Barteln, Brust-, Rücken-, After- und
 * Schwanzflosse. Das Merkmal (Kläranlagen-Organik): eingewachsene Rohre mit Rostringen an
 * den Flanken und Baumpilz-Fächer auf dem Rücken, die Signalfarbe nur als Punkt (ADR-0002).
 *
 * Ausgabe `public/creatures/flussvater.glb`: POSITION + COLOR_0, keine Normalen (D107, das
 * Material schattiert flach), Bauch auf y = 0, Nase nach −Z, Länge 1,6, Höhe ≈ 0,35 — die
 * Szene skaliert mit `REGENT_HOEHE`. Saat fest: Dasselbe Skript liefert dieselbe Datei.
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { weld } from '@gltf-transform/functions';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../src/world/palette.js';

const L = 1.6;
const W = PALETTE.wels;
const farbe = (hex: string) => new THREE.Color(hex);

/** Fester Zufall (mulberry32) — reproduzierbare Datei. */
function zufall(saat: number) {
  return () => {
    saat |= 0; saat = (saat + 0x6d2b79f5) | 0;
    let t = Math.imul(saat ^ (saat >>> 15), 1 | saat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = zufall(7341);

/** Geometrie ohne Index, mit einer Farbe je Ecke. */
function einfaerben(g: THREE.BufferGeometry, f: (x: number, y: number, z: number) => THREE.Color): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('normal');
  n.deleteAttribute('uv');
  const p = n.getAttribute('position');
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = f(p.getX(i), p.getY(i), p.getZ(i));
    c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b;
  }
  n.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return n;
}

// ------------------------------------------------------------------ Rumpf

/** Breite, Höhe und Mittelhöhe des Querschnitts bei t (0 Nase, 1 Schwanzwurzel). */
function querschnitt(t: number): { b: number; h: number } {
  // max(0, …): bei t = 1 rundet 1 − 0,58/0,58 leicht negativ, und pow(<0, 1,25) ist NaN.
  const b = t < 0.16 ? 0.32 * (0.55 + 0.45 * Math.sin((t / 0.16) * Math.PI / 2))
    : t < 0.42 ? 0.32 - (t - 0.16) * 0.2
    : 0.268 * Math.pow(Math.max(0, 1 - (t - 0.42) / 0.58), 1.25) + 0.025;
  const h = t < 0.35 ? 0.15 + (t / 0.35) * 0.13
    : 0.28 * Math.pow(Math.max(0, 1 - (t - 0.35) / 0.65), 0.9) + 0.05;
  return { b, h };
}
const STATIONEN = 30, RING = 16;
const schwung = (t: number) => Math.sin(t * Math.PI * 1.4) * 0.035 * t;

function rumpf(): THREE.BufferGeometry {
  const pos: number[] = [];
  const ring: THREE.Vector3[][] = [];
  for (let s = 0; s <= STATIONEN; s++) {
    const t = s / STATIONEN;
    const { b, h } = querschnitt(t);
    const z = -L / 2 + t * L * 0.86;
    const cy = h / 2 + 0.01;
    const r: THREE.Vector3[] = [];
    for (let k = 0; k < RING; k++) {
      const a = (k / RING) * Math.PI * 2;
      const sx = Math.cos(a), sy = Math.sin(a);
      // Kantig-runder Querschnitt (Superellipse), Bauch abgeflacht.
      const qx = Math.sign(sx) * Math.pow(Math.abs(sx), 0.8);
      const qy = Math.sign(sy) * Math.pow(Math.abs(sy), 0.9) * (sy < 0 ? 0.75 : 1);
      // Leichtes Höckern der Haut, damit die Flanke nicht glatt wie ein Rohr ist.
      const haut = 1 + (rnd() - 0.5) * 0.04;
      r.push(new THREE.Vector3(qx * b / 2 * haut + schwung(t), cy + qy * h / 2 * haut, z));
    }
    ring.push(r);
  }
  const drei = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let s = 0; s < STATIONEN; s++)
    for (let k = 0; k < RING; k++) {
      const a = ring[s][k], b = ring[s][(k + 1) % RING], c = ring[s + 1][k], d = ring[s + 1][(k + 1) % RING];
      drei(a, c, b); drei(b, c, d);
    }
  // Nase: stumpf, ein Mittelpunkt leicht vor dem ersten Ring.
  const nase = new THREE.Vector3(schwung(0), 0.085, -L / 2 - 0.03);
  for (let k = 0; k < RING; k++) drei(nase, ring[0][k], ring[0][(k + 1) % RING]);
  const ende = ring[STATIONEN], mitte = ende.reduce((m, v) => m.add(v), new THREE.Vector3()).divideScalar(RING);
  for (let k = 0; k < RING; k++) drei(mitte, ende[(k + 1) % RING], ende[k]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const rueckenF = farbe(W.ruecken), fleckF = farbe(W.flecken), bauchF = farbe(W.bauch), maulF = farbe(W.maul);
  return einfaerben(g, (x, y, z) => {
    const t = (z + L / 2) / (L * 0.86);
    const { h } = querschnitt(Math.min(1, Math.max(0, t)));
    const oben = (y - 0.01) / Math.max(0.01, h);
    // Maul: breite dunkle Spalte vorn unten.
    if (t < 0.05 && oben < 0.45) return maulF;
    if (oben < 0.32) return bauchF;
    // Flecken: grobes Muster aus der Lage, nicht je Dreieck zufällig.
    const fleck = Math.sin(x * 31 + z * 17) * Math.sin(z * 23 - x * 11) > 0.35;
    return fleck ? fleckF : rueckenF;
  });
}

// ---------------------------------------------------------------- Anhänge

/** Spitz zulaufende Röhre entlang einer Kurve. */
function roehre(punkte: THREE.Vector3[], r0: number, r1: number, f: THREE.Color, seiten = 5): THREE.BufferGeometry {
  const kurve = new THREE.CatmullRomCurve3(punkte);
  const g = new THREE.TubeGeometry(kurve, 6, 1, seiten, false);
  const p = g.getAttribute('position');
  // Radius über die Länge verjüngen: Ecken sind je Segment in Ringen abgelegt.
  for (let s = 0; s <= 6; s++) {
    const r = r0 + (r1 - r0) * (s / 6);
    const mitte = kurve.getPointAt(s / 6);
    for (let k = 0; k <= seiten; k++) {
      const i = s * (seiten + 1) + k;
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).sub(mitte).multiplyScalar(r).add(mitte);
      p.setXYZ(i, v.x, v.y, v.z);
    }
  }
  return einfaerben(g, () => f);
}

/** Flosse als doppelseitiger Fächer aus Dreiecken: Wurzel a→b, Spitzen dazwischen. */
function flosse(wurzel: THREE.Vector3[], spitzen: THREE.Vector3[], f: THREE.Color): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < spitzen.length; i++) {
    const a = wurzel[i], b = wurzel[i + 1], c = spitzen[i];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return einfaerben(g, () => f);
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const zBei = (t: number) => -L / 2 + t * L * 0.86;

function barteln(): THREE.BufferGeometry[] {
  const f = farbe(W.maul);
  const teile: THREE.BufferGeometry[] = [];
  for (const seite of [-1, 1]) {
    // Das lange Paar vom Mundwinkel, geschwungen nach aussen und hinten.
    const a = v(seite * 0.13, 0.07, zBei(0.02));
    teile.push(roehre([a, v(seite * 0.24, 0.06, zBei(0.03)), v(seite * 0.32, 0.025, zBei(0.12)), v(seite * 0.36, 0.0, zBei(0.24))], 0.012, 0.003, f));
    // Zwei kurze unter dem Kinn.
    for (const dx of [0.04, 0.08]) {
      const b = v(seite * dx, 0.03, zBei(0.04));
      teile.push(roehre([b, v(seite * (dx + 0.02), 0.0, zBei(0.02)), v(seite * (dx + 0.04), -0.02, zBei(0.0))], 0.007, 0.002, f));
    }
  }
  return teile;
}

function flossen(): THREE.BufferGeometry[] {
  const f = farbe(W.flosse);
  const teile: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    // Brustflossen: flach, schräg nach aussen und hinten.
    teile.push(flosse(
      [v(s * 0.14, 0.04, zBei(0.2)), v(s * 0.15, 0.04, zBei(0.25)), v(s * 0.14, 0.04, zBei(0.3))],
      [v(s * 0.3, 0.0, zBei(0.31)), v(s * 0.26, 0.01, zBei(0.38))], f));
  }
  // Rückenflosse: klein und hoch, wie beim Wels.
  const rt = 0.36, rh = querschnitt(rt).h + 0.01;
  teile.push(flosse([v(schwung(rt), rh, zBei(rt)), v(schwung(rt + 0.03), rh - 0.005, zBei(rt + 0.04)), v(schwung(rt + 0.06), rh - 0.015, zBei(rt + 0.08))],
    [v(schwung(rt), rh + 0.11, zBei(rt + 0.03)), v(schwung(rt), rh + 0.06, zBei(rt + 0.09))], f));
  // Afterflosse: lang und niedrig unter dem hinteren Rumpf.
  const wurzel: THREE.Vector3[] = [], spitzen: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = 0.52 + i * 0.055;
    wurzel.push(v(schwung(t), 0.015 + i * 0.002, zBei(t)));
    if (i < 8) spitzen.push(v(schwung(t + 0.03), -0.035 + i * 0.002, zBei(t + 0.04)));
  }
  teile.push(flosse(wurzel, spitzen, f));
  // Schwanzflosse: gerundeter senkrechter Fächer am Ende.
  const ze = zBei(1), xe = schwung(1), ye = querschnitt(1).h / 2 + 0.01;
  const fw: THREE.Vector3[] = [], fs: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) fw.push(v(xe, ye + (i / 6 - 0.5) * 0.06, ze));
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6 - 0.5) * Math.PI * 0.9;
    fs.push(v(xe + 0.01, ye + Math.sin(a) * 0.13, ze + Math.cos(a) * 0.19));
  }
  teile.push(flosse(fw, fs, f));
  return teile;
}

/** Kläranlagen-Organik: Rohre, halb in der Flanke versenkt, mit Rostringen. */
function rohre(): THREE.BufferGeometry[] {
  const rohrF = farbe(W.rohr), ringF = farbe(W.rohrRing);
  const teile: THREE.BufferGeometry[] = [];
  const lagen: [number, number, number, number][] = [[1, 0.4, 0.62, 0.55], [-1, 0.46, 0.7, 0.6], [1, 0.66, 0.82, 0.7]];
  for (const [s, t0, t1, hoehe] of lagen) {
    const punkt = (t: number) => {
      const { b, h } = querschnitt(t);
      return v(s * b / 2 * 0.92 + schwung(t), h * hoehe, zBei(t));
    };
    const a = punkt(t0), e = punkt(t1);
    const r = 0.022;
    teile.push(roehre([a, a.clone().lerp(e, 0.5).add(v(s * 0.012, 0.01, 0)), e], r, r, rohrF, 7));
    for (const u of [0.2, 0.55, 0.85]) {
      const m = a.clone().lerp(e, u);
      const ring = new THREE.TorusGeometry(r * 1.15, r * 0.35, 4, 8);
      ring.lookAt(e.clone().sub(a));
      ring.translate(m.x, m.y, m.z);
      teile.push(einfaerben(ring, () => ringF));
    }
  }
  return teile;
}

/** Baumpilz-Fächer auf dem Rücken (Stilreferenz), Signalfarbe nur als Punkt. */
function pilze(): THREE.BufferGeometry[] {
  const hell = farbe(PALETTE.befall.pilzHell), dunkel = farbe(PALETTE.befall.pilzDunkel), signal = farbe(PALETTE.befall.signal);
  const teile: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const t = 0.42 + rnd() * 0.32, s = rnd() < 0.5 ? -1 : 1;
    const { b, h } = querschnitt(t);
    const x = s * b * (0.15 + rnd() * 0.25) + schwung(t), y = h * (0.9 + rnd() * 0.12) + 0.01;
    const r = 0.025 + rnd() * 0.03;
    // Halbe flache Scheibe, nach aussen geneigt: ein Konsolenpilz.
    const hut = new THREE.CylinderGeometry(r, r * 0.8, r * 0.28, 10, 1, false, 0, Math.PI);
    hut.rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    hut.rotateZ(-s * (0.25 + rnd() * 0.3));
    hut.translate(x, y, zBei(t));
    teile.push(einfaerben(hut, (_, yy) => (yy > y ? hell : dunkel)));
    if (i % 3 === 0) {
      const punkt = new THREE.IcosahedronGeometry(0.006, 0);
      punkt.translate(x + s * r * 0.8, y + 0.01, zBei(t));
      teile.push(einfaerben(punkt, () => signal));
    }
  }
  return teile;
}

const alles = mergeGeometries([rumpf(), ...barteln(), ...flossen(), ...rohre(), ...pilze()], false)!;
// Bauch auf y = 0: Flossen und Barteln hängen tiefer als der Rumpf.
alles.computeBoundingBox();
alles.translate(0, -alles.boundingBox!.min.y, 0);
alles.computeBoundingBox();
const bb = alles.boundingBox!;

const pos = alles.getAttribute('position').array as Float32Array;
const col = alles.getAttribute('color').array as Float32Array;
// Farben linear speichern, wie glTF es verlangt (COLOR_0 ist linear).
const lin = new Float32Array(col.length);
for (let i = 0; i < col.length; i++) lin[i] = col[i];
const index = new Uint32Array(pos.length / 3).map((_, i) => i);

const doc = new Document();
const puffer = doc.createBuffer();
const prim = doc.createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(puffer))
  .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(lin).setBuffer(puffer))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(index).setBuffer(puffer));
const mesh = doc.createMesh('flussvater').addPrimitive(prim);
doc.createScene().addChild(doc.createNode('flussvater').setMesh(mesh));
// Gleiche Ecken (Lage + Farbe) zusammenlegen: ohne Normalen verlustfrei, drittelt die Datei.
await doc.transform(weld());
await new NodeIO().write('public/creatures/flussvater.glb', doc);
const ecken = prim.getAttribute('POSITION')!.getCount();
console.log(`public/creatures/flussvater.glb: ${index.length / 3} Dreiecke, ${ecken} Ecken, `
  + `Länge ${(bb.max.z - bb.min.z).toFixed(2)}, Höhe ${(bb.max.y - bb.min.y).toFixed(2)}, Breite ${(bb.max.x - bb.min.x).toFixed(2)}`);
