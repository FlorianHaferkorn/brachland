/**
 * BRACHLAND — Bodenpflanzen als gebackene Karten (D366): Waldboden in Schichten wie im verwilderten Wald.
 *
 * Unten liegt die Streu (`streukarten.ts`, unter der Krone geschlossen), darüber stehen hier die kleinen Pflanzen:
 * Sauerklee, Waldmeister, Kräuter und Keimlinge, Moospolster als flache Felder (1 × 1 m, von oben gebacken), junge
 * Brombeeren, Jungbuchen, Jungfichten und Waldmeister-Büschel als gekreuzte Karten (0,8 × 0,8 m, von der Seite).
 * Gebacken in Blender (`tools/bodenkarten.py`), Grössen aus `content/massstab.json` (`messung: boden`), Kantenlänge
 * und gemessene Höhe je Kachel in `public/material/boden-karten.json`.
 *
 * Verteilung je Meter-Zelle aus dem Seed der Zelle (erzeugt, nicht gespeichert) nach
 * - **Biom**: Wald voll, Gebüsch mit mehr Brombeere, Moor nur Moos; Wiese, Siedlung, Wasser frei.
 * - **Licht**: Schatten aus der Nähe zum nächsten Kronenrand (`naechsteKrone`). Im tiefen Schatten Sauerklee,
 *   Waldmeister (unter Laub) und Moos, im Halbschatten Keimlinge und Jungwuchs, am Kronenrand und in Lücken Brombeere.
 * - **Gelände**: Moos auf Erhebungen (Befund Foto: 50–60 % auf Buckeln und Wurzelanläufen).
 * - **Farn**: wo ein Farnbestand steht (`farnBestand`, D216), tritt der übrige Unterwuchs zurück — kein Doppeln.
 * Gezeichnet wird nur im Nahbereich (`BODEN_NAH`), zum Rand hin schrumpfen die Pflanzen im Shader auf null.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import KARTEN from '../../public/material/boden-karten.json';
import type { Biom } from './osm.js';
import { farnBestand } from './props.js';
import { haeufung, kronenDeckung, naechsteKrone, type BaumRaster } from './streukarten.js';
import { kachelGeometrie, kartenMaterial } from './efeukarten.js';

/** Radius, in dem Bodenpflanzen stehen; ab 75 % davon schrumpfen sie zum Rand hin. */
export const BODEN_NAH = 40;

/** Kacheln der beiden Atlanten (Reihenfolge wie `tools/bodenkarten.py`). */
export const FLACH = { sauerklee: 0, moos: 1, waldmeister: 2, kraeuter: 3 } as const;
export const BUSCH = { waldmeister: 0, brombeere: 1, buche: 2, fichte: 3 } as const;

/** Kantenlänge und gebackene Pflanzenhöhe je Kachel (Meter, bei Instanzskalierung 1). */
export const KACHELN = KARTEN as { bodenflach: KachelInfo[]; bodenbusch: KachelInfo[] };
export interface KachelInfo { kachel: number; name: string; kante: number; hoehe: number }

/** Biomfaktor für den Unterwuchs; fehlende Biome tragen keinen. */
const BIOM: Partial<Record<Biom, { flach: number; busch: number; brombeere: number; nurMoos?: boolean }>> = {
  wald: { flach: 1, busch: 1, brombeere: 1 },
  gebuesch: { flach: 0.6, busch: 0.8, brombeere: 2.2 },
  moor: { flach: 0.5, busch: 0, brombeere: 0, nurMoos: true },
};

/** Ganzzahl-Hash einer Zelle — dieselbe Zelle gibt immer dieselben Pflanzen. */
function zellHash(ix: number, iz: number, salz: number): number {
  let h = (ix * 73856093) ^ (iz * 19349663) ^ (salz * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Instanzmatrizen: `flach[kachel]` (liegende Felder) und `busch[kachel]` (stehende Büschel). */
export interface BodenMatrizen { flach: THREE.Matrix4[][]; busch: THREE.Matrix4[][] }

/** Glatte Stufe zwischen `a` und `b`. */
function glatt(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Gewichte auf höchstens 0,95 Summe kürzen — ein Wurf darf auch leer ausgehen. */
function deckeln(g: number[]): number[] {
  const summe = g.reduce((a, b) => a + b, 0);
  return summe > 0.95 ? g.map(v => v * 0.95 / summe) : g;
}

/** Wählt aus gewichteten Möglichkeiten eine (oder keine, wenn der Wurf über der Summe liegt). */
function waehle(wurf: number, gewichte: readonly number[]): number {
  let summe = 0;
  for (let i = 0; i < gewichte.length; i++) { summe += gewichte[i]; if (wurf < summe) return i; }
  return -1;
}

/** Nur Zellen im aktuellen Suchquadrat behalten. Gespeichert werden die unveränderten
 * Matrizen der ortsfesten Saat. Die Auswahl im Kreis und die Zeichenreihenfolge bleiben gleich. */
type Zellpflanze = { art: keyof BodenMatrizen; kachel: number; matrix: THREE.Matrix4 };
export type BodenpflanzenCache = Map<number, Map<number, Zellpflanze[]>>;

export function bodenMatrizen(
  mx: number, mz: number, radius: number,
  hoeheAn: (x: number, z: number) => number, biomAn: (x: number, z: number) => Biom,
  baeume: BaumRaster, cache?: BodenpflanzenCache, tritt?: (x: number, z: number) => number,
): BodenMatrizen {
  const flach: THREE.Matrix4[][] = [[], [], [], []], busch: THREE.Matrix4[][] = [[], [], [], []];
  const z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), q = new THREE.Quaternion(), dreh = new THREE.Quaternion();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0);
  const x0 = Math.floor(mx - radius), x1 = Math.ceil(mx + radius), z0 = Math.floor(mz - radius), z1 = Math.ceil(mz + radius);
  const ergebnis = { flach, busch };
  if (cache) for (const [ix, zeile] of cache) {
    if (ix < x0 || ix > x1) cache.delete(ix);
    else for (const iz of zeile.keys()) if (iz < z0 || iz > z1) zeile.delete(iz);
  }
  for (let ix = x0; ix <= x1; ix++) {
    let zeile = cache?.get(ix);
    if (cache && !zeile) { zeile = new Map(); cache.set(ix, zeile); }
    for (let iz = z0; iz <= z1; iz++) {
      let h = zellHash(ix, iz, 366);
      const wurf = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
      const x = ix + wurf(), zz = iz + wurf();
      if ((x - mx) ** 2 + (zz - mz) ** 2 > radius * radius) continue;
      const vorhanden = zeile?.get(iz);
      if (vorhanden) {
        for (const pflanze of vorhanden) ergebnis[pflanze.art][pflanze.kachel].push(pflanze.matrix);
        continue;
      }
      const neu: Zellpflanze[] | undefined = zeile ? [] : undefined;
      if (neu) zeile!.set(iz, neu);
      const regel = BIOM[biomAn(x, zz)];
      if (!regel) continue;
      const krone = naechsteKrone(baeume, x, zz);
      // Schatten: unter der Krone voll, am Rand über 1,5 m auslaufend; in Lücken bis 6 m vom Rand noch Halbschatten.
      const schatten = krone ? Math.max(kronenDeckung(krone.rand), 0.5 * (1 - Math.min(1, Math.max(0, krone.rand) / 6))) : 0;
      const licht = 1 - schatten, nadel = krone?.nadel ?? false;
      const farn = 1 - 0.75 * farnBestand(x, zz);
      const hier = hoeheAn(x, zz);
      // Erhebung: Höhe gegen das Mittel im 1,5-m-Kreuz (Buckel, Wurzelanlauf).
      const buckel = hier - (hoeheAn(x - 1.5, zz) + hoeheAn(x + 1.5, zz) + hoeheAn(x, zz - 1.5) + hoeheAn(x, zz + 1.5)) / 4;

      // D366 (Stilreferenz Flo): Unterwuchs wächst in dichten, zusammenhängenden Polstern, nicht als verstreute
      // Einzelpflanzen. Ein weiches Rauschen (7 m und 2,5 m) legt die Polster; darin bis zu 2 Felder und 3 Büschel je m²,
      // dazwischen fast nichts. Am Kronenrand (Wald- und Wegrand, Lücken) stehen die Polster am dichtesten.
      const polsterRauschen = 0.65 * haeufung(x + 17.3, zz - 9.1, 7) + 0.35 * haeufung(x - 4.2, zz + 3.7, 2.5);
      const polster = 0.15 + 2.2 * glatt(0.38, 0.68, polsterRauschen);
      const rand = krone ? Math.max(0, 1 - Math.abs(krone.rand - 2) / 4) : 0;

      // 1. Flache Felder: zwei Würfe je Zelle (versetzt), damit Polster lückenlos überlappen.
      const moos = Math.min(0.6, Math.max(0, buckel * 12)) + (nadel ? 0.15 : 0.05) * schatten;
      const gewichteFlach = deckeln(regel.nurMoos ? [0, moos, 0, 0] : [
        (nadel ? 0.32 : 0.22) * schatten,                    // Sauerklee: Schatten, Fichten- und Buchenwald
        moos,
        (nadel ? 0.04 : 0.26) * schatten,                    // Waldmeister: Buchenwald, Schatten
        0.18 * Math.min(1, 2 * Math.min(schatten, licht)) + 0.06, // Kräuter und Keimlinge: Halbschatten
      ].map(g => g * regel.flach * farn * polster));
      for (let versuch = 0; versuch < 2; versuch++) {
        const kf = waehle(wurf(), gewichteFlach);
        if (kf < 0) continue;
        const fx = x + versuch * (wurf() - 0.5), fz = zz + versuch * (wurf() - 0.5);
        const e = 0.4;
        n.set(hoeheAn(fx - e, fz) - hoeheAn(fx + e, fz), 2 * e, hoeheAn(fx, fz - e) - hoeheAn(fx, fz + e)).normalize();
        q.setFromUnitVectors(z, n);
        dreh.setFromAxisAngle(z, wurf() * Math.PI * 2);
        const k = KACHELN.bodenflach[kf].kante * (0.85 + 0.3 * wurf());
        p.set(fx, hoeheAn(fx, fz) + 0.03, fz);
        s.set(k, k, 1);
        if (tritt && tritt(p.x, p.z) > .25) continue;
        const matrix = new THREE.Matrix4().compose(p, q.multiply(dreh), s);
        flach[kf].push(matrix);
        neu?.push({ art: 'flach', kachel: kf, matrix });
      }

      // 2. Stehende Büschel: drei Würfe je Zelle, eigene Gewichte, am Kronenrand bis 2,5-fach.
      const gewichteBusch = deckeln([
        (nadel ? 0.03 : 0.16) * schatten,                    // Waldmeister-Büschel
        0.32 * licht * regel.brombeere * (krone ? 1 : 0.4),  // Brombeere: Kronenrand und Lücken
        (nadel ? 0.03 : 0.12) * Math.min(1, 2 * Math.min(schatten + 0.2, licht + 0.2)), // Jungbuche: Halbschatten
        (nadel ? 0.12 : 0.03) * Math.min(1, 2 * Math.min(schatten + 0.2, licht + 0.2)), // Jungfichte
      ].map(g => g * regel.busch * farn * polster * (1 + 1.5 * rand)));
      for (let versuch = 0; versuch < 3; versuch++) {
        const kb = waehle(wurf(), gewichteBusch);
        if (kb < 0) continue;
        const k = KACHELN.bodenbusch[kb].kante * (0.8 + 0.4 * wurf());
        p.set(x + (wurf() - 0.5) * 0.9, 0, zz + (wurf() - 0.5) * 0.9);
        p.y = hoeheAn(p.x, p.z) - 0.02;                       // 2 cm eingesenkt: kein Spalt am Hang
        dreh.setFromAxisAngle(y, wurf() * Math.PI);
        s.set(k, k, k);
        if (tritt && tritt(p.x, p.z) > .25) continue;
        const matrix = new THREE.Matrix4().compose(p, dreh, s);
        busch[kb].push(matrix);
        neu?.push({ art: 'busch', kachel: kb, matrix });
      }
    }
  }
  return ergebnis;
}

/** Liegende Karte 1 × 1 (Ebene z = 0, wie die Streu). */
export const flachGeometrie = kachelGeometrie;

/** Zwei gekreuzte, stehende Karten 1 × 1 mit dem Fuss bei y = 0 — Höhe und Breite skaliert die Instanz. */
export function buschGeometrie(kachel: number): THREE.BufferGeometry {
  const a = kachelGeometrie(kachel); a.translate(0, 0.5, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const g = mergeGeometries([a, b], false)!;
  a.dispose(); b.dispose();
  return g;
}

/**
 * Material der Bodenpflanzen: Kartenmaterial (D361) plus Ausblendung zum Rand des Nahbereichs — jede Pflanze schrumpft
 * zwischen 75 % und 100 % von `BODEN_NAH` (Abstand zur Kamera) auf ihren Fuss zusammen, statt hart zu verschwinden.
 */
export function bodenMaterial(atlas: 'bodenflach' | 'bodenbusch'): THREE.MeshStandardMaterial {
  const m = kartenMaterial(atlas, atlas === 'bodenflach' ? 0.5 : 0.6);
  const karten = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    karten.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', /* glsl */ `
#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 bodenOrt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  transformed *= 1.0 - smoothstep(${(BODEN_NAH * 0.75).toFixed(1)}, ${BODEN_NAH.toFixed(1)}, distance(bodenOrt, cameraPosition));
#endif`);
  };
  m.customProgramCacheKey = () => `boden-${atlas}`;
  m.alphaToCoverage = true;
  return m;
}
