/**
 * Stämme der Blender-Szenen als Kollisionskreise (G-136).
 *
 * `baueKollision` kennt nur die Engine-Props. Im Freihalte-Radius einer Szene (150 m) stehen aber die
 * Bäume aus Blender — Heldenbäume als `*_Holz`, der Wald als **ein** verschmolzenes Netz `WaldHolz`
 * (rund 180 Stämme). Ohne Kreise für sie läuft man durch sie hindurch, und die Lock-On-Sicht (D192)
 * sieht sie nicht: belegt im Headless-Video vom 07.10.2026, Ziel hinter einem Stauwehr-Stamm.
 *
 * Verfahren, ohne Blender: Die Holznetze in Weltlage, jede Dreieckskante geschnitten mit einer Ebene
 * `SCHNITT` über dem tiefsten Punkt der Umgebung (1-m-Raster, 3×3 Nachbarn), damit Stämme am Hang
 * ihren eigenen Boden haben. Die Schnittpunkte werden in einem feinen Raster zu Gruppen verbunden;
 * jede Gruppe mit Stammdicke ist ein Kreis (Mittelpunkt = Schwerpunkt, Radius = Median-Abstand).
 * Dünnes (Ruten der Weiden, Äste, die tief hängen) fällt über `R_MIN` heraus.
 *
 *   npx tsx tools/staemme.ts            schreibt public/bauten/staemme.json für alle Szenen im Register
 *
 * Nach jedem `szenenexport.py` neu laufen lassen; `tests/staemme.test.ts` prüft, dass jede Szene
 * Kreise hat.
 */
import { NodeIO, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BAUTEN = 'public/bauten';
/** Höhe des Schnitts über dem örtlichen Boden, Meter (Hüfte). */
const SCHNITT = 1.1;
/** Rasterweite für die Bodenhöhe und für das Verbinden der Schnittpunkte. */
const BODEN_ZELLE = 1.0;
/**
 * 0,5 m: Ein grober Stamm hat in Hüfthöhe nur 6 Schnittpunkte, 0,4 m auseinander — ein feineres
 * Raster zerlegte ihn in Bruchstücke (erster Lauf: 359 statt rund 190). Bäume stehen im Szenenbau
 * mindestens 5,5 m auseinander (`wald(..., abstand=5.5)`), zwei verschmelzen also nicht.
 */
const VERBINDE_ZELLE = 0.5;
/** Dünner als das ist kein Stamm, sondern Rute oder Ast. Dicker als das ist ein Fehler im Schnitt. */
const R_MIN = 0.1, R_MAX = 1.6;

type Kreis = [number, number, number];

/** Ecken in Weltlage plus Dreiecke (Indizes in dieselbe Liste). */
interface Netz { ecken: number[]; dreiecke: number[] }

function netzInWelt(node: Node, ux: number, uz: number, netz: Netz): void {
  const m = node.getWorldMatrix();
  for (const prim of node.getMesh()!.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const basis = netz.ecken.length / 3;
    const v: number[] = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      // gltf-transform rechnet normalisierte Ganzzahlen (Quantisierung, D157) selbst auf −1…1 um.
      const [x, y, z] = pos.getElement(i, v);
      netz.ecken.push(m[0] * x + m[4] * y + m[8] * z + m[12] + ux,
                      m[1] * x + m[5] * y + m[9] * z + m[13],
                      m[2] * x + m[6] * y + m[10] * z + m[14] + uz);
    }
    const idx = prim.getIndices();
    const n = idx ? idx.getCount() : pos.getCount();
    for (let i = 0; i < n; i++) netz.dreiecke.push(basis + (idx ? idx.getScalar(i) : i));
  }
}

/**
 * Schnittpunkte der Dreieckskanten mit der Ebene `SCHNITT` über dem örtlichen Boden.
 *
 * Kanten statt Ecken: Ferne Stämme sind grob aufgelöst (`resolution_u = 3` im Export) und haben in
 * Hüfthöhe **keine** Ecke — der erste Lauf über Ecken fand 136 von wohl über 180 Stämmen.
 */
export function schnittpunkte({ ecken: e, dreiecke: t }: Netz): number[] {
  const k = (a: number, b: number) => `${a},${b}`;
  const boden = new Map<string, number>();
  for (let i = 0; i < e.length; i += 3) {
    const s = k(Math.floor(e[i] / BODEN_ZELLE), Math.floor(e[i + 2] / BODEN_ZELLE));
    if (!(boden.get(s)! <= e[i + 1])) boden.set(s, e[i + 1]);
  }
  const hoehe = new Float64Array(e.length / 3);
  for (let j = 0; j < hoehe.length; j++) {
    const bx = Math.floor(e[3 * j] / BODEN_ZELLE), bz = Math.floor(e[3 * j + 2] / BODEN_ZELLE);
    let b = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) b = Math.min(b, boden.get(k(bx + dx, bz + dz)) ?? Infinity);
    hoehe[j] = e[3 * j + 1] - b - SCHNITT;
  }
  const aus: number[] = [];
  for (let i = 0; i < t.length; i += 3)
    for (const [a, b] of [[t[i], t[i + 1]], [t[i + 1], t[i + 2]], [t[i + 2], t[i]]]) {
      const ha = hoehe[a], hb = hoehe[b];
      if ((ha > 0) === (hb > 0) || ha === hb) continue;
      const f = ha / (ha - hb);
      aus.push(e[3 * a] + (e[3 * b] - e[3 * a]) * f, e[3 * a + 2] + (e[3 * b + 2] - e[3 * a + 2]) * f);
    }
  return aus;
}

/** Schnittpunkte (x, z paarweise) zu Kreisen: Nachbarzellen verbinden, Dickes behalten. */
export function kreiseAusPunkten(p: number[]): Kreis[] {
  const k = (a: number, b: number) => `${a},${b}`;
  const zellen = new Map<string, number[]>();
  for (let i = 0; i < p.length; i += 2) {
    const s = k(Math.floor(p[i] / VERBINDE_ZELLE), Math.floor(p[i + 1] / VERBINDE_ZELLE));
    (zellen.get(s) ?? zellen.set(s, []).get(s)!).push(p[i], p[i + 1]);
  }
  const gesehen = new Set<string>();
  const kreise: Kreis[] = [];
  for (const start of zellen.keys()) {
    if (gesehen.has(start)) continue;
    const punkte: number[] = [];
    const stapel = [start]; gesehen.add(start);
    while (stapel.length) {
      const s = stapel.pop()!;
      for (const c of zellen.get(s)!) punkte.push(c);
      const [x, z] = s.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const n = k(x + dx, z + dz);
        if (zellen.has(n) && !gesehen.has(n)) { gesehen.add(n); stapel.push(n); }
      }
    }
    // Ein Ring um einen Stamm hat mindestens so viele Kantenschnitte wie Seiten (grob: 3·2).
    if (punkte.length < 2 * 5) continue;
    let mx = 0, mz = 0;
    for (let i = 0; i < punkte.length; i += 2) { mx += punkte[i]; mz += punkte[i + 1]; }
    mx /= punkte.length / 2; mz /= punkte.length / 2;
    const d: number[] = [];
    for (let i = 0; i < punkte.length; i += 2) d.push(Math.hypot(punkte[i] - mx, punkte[i + 1] - mz));
    d.sort((a, b) => a - b);
    // Median: Auf dem Ring liegen alle Punkte gleich weit weg; ein tief ansetzender Ast nur wenige.
    const r = d[Math.floor(d.length * 0.5)];
    if (r < R_MIN || r > R_MAX) continue;
    kreise.push([+mx.toFixed(2), +mz.toFixed(2), +r.toFixed(2)]);
  }
  return kreise.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Alle Szenen im Register → Kreise je Szene. Ohne Schreiben, damit der Test vergleichen kann. */
export async function berechneStaemme(log = false): Promise<Record<string, Kreis[]>> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const register = JSON.parse(readFileSync(`${BAUTEN}/register.json`, 'utf8')).bauwerke as
    { name: string; ursprung: { x: number; z: number } }[];
  const aus: Record<string, Kreis[]> = {};
  for (const b of register) {
    const netz: Netz = { ecken: [], dreiecke: [] };
    for (const teil of ['bauten', 'gruen']) {
      const pfad = `${BAUTEN}/${b.name}-${teil}.glb`;
      if (!existsSync(pfad)) continue;
      const doc = await io.read(pfad);
      for (const n of doc.getRoot().listNodes())
        if (n.getMesh() && /Holz$/.test(n.getName())) netzInWelt(n, b.ursprung.x, b.ursprung.z, netz);
    }
    aus[b.name] = kreiseAusPunkten(schnittpunkte(netz));
    if (log) console.log(`${b.name}: ${aus[b.name].length} Stämme aus ${netz.dreiecke.length / 3} Dreiecken`);
  }
  return aus;
}

if (process.argv[1]?.endsWith('staemme.ts'))
  writeFileSync(`${BAUTEN}/staemme.json`, JSON.stringify(await berechneStaemme(true)) + '\n');
