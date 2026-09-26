/**
 * BRACHLAND — Himmelsanteil fürs Gelände um die Set-Pieces (D171)
 *
 *   npx tsx tools/himmelboden.ts felsmulde stauwehr
 *
 * `tools/himmel.ts` (D170) gibt Mauern und Kronen einen Himmelsanteil je Ecke. Der Boden darunter
 * ist aber **Gelände** — keine Ecken des Set-Pieces, sondern Kacheln der Engine, 2 m und gröber.
 * Am Stauwehr ist das der grösste Teil des Bildes: Waldboden unter 105 Kronen, der dasselbe
 * Fülllicht bekam wie eine freie Wiese (MESSLAUF D170: „Stauwehr zu hell, der Boden ist Gelände").
 *
 * Hier ein Raster von 0,5 m über die Grundfläche des Set-Pieces (plus 3 m Rand): je Zelle 16
 * cosinusverteilte Strahlen nach oben, vom Gelände (`baueHoehenfeld`, dieselbe Höhe wie die Szene)
 * aus, gegen dieselben Verdecker wie `himmel.ts` (Laub halb, Stein und Holz ganz). Das Gelände
 * selbst verdeckt nicht — wie dort.
 *
 * Ausgabe: `public/bauten/<name>-himmel.bin` (8 Bit je Zelle, Zeilen entlang +z) und die Lage in
 * `public/bauten/<name>-himmel.json`. Kein Bild-Asset im Sinne von ADR-0002 — eine Messgrösse wie
 * `_HIMMEL`, nur auf ein Raster statt auf Ecken gelegt; `bodenmaterial.ts` liest sie als Datentextur.
 */
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { readFileSync, writeFileSync } from 'node:fs';
import { entpackeWelt, type Weltdaten } from '../src/world/osm.js';
import { baueHoehenfeld } from '../src/world/lod.js';
import { BAUWERKE } from '../src/world/bauwerke.js';

const LAUB = /Krone|Nadeln|Farn|Efeu|Laub/;
const SCHRITT = 0.5, RAND = 3, MAX_SEITE = 200, STRAHLEN = 16, LAENGE = 20, UEBER_BODEN = 0.05;

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const welt: Weltdaten = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const feld = baueHoehenfeld(welt);

function halbkugel(n: number): THREE.Vector3[] {
  const r: THREE.Vector3[] = [];
  const gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const y = Math.sqrt(1 - u), s = Math.sqrt(u), a = i * gold;
    r.push(new THREE.Vector3(Math.cos(a) * s, y, Math.sin(a) * s));   // um +Y (glTF oben)
  }
  return r;
}

function dreiecke(doc: Document, laubErkennen: boolean, pos: number[], gewicht: number[]) {
  const v = new THREE.Vector3();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = new THREE.Matrix4().fromArray(node.getWorldMatrix());
    const laub = laubErkennen && LAUB.test(node.getName() + ' ' + mesh.getName());
    for (const prim of mesh.listPrimitives()) {
      const p = prim.getAttribute('POSITION')!;
      const idx = prim.getIndices();
      const n = idx ? idx.getCount() : p.getCount();
      const e: number[] = [];
      for (let i = 0; i < n; i++) {
        p.getElement(idx ? idx.getScalar(i) : i, e);
        v.set(e[0], e[1], e[2]).applyMatrix4(m);
        pos.push(v.x, v.y, v.z);
        if (i % 3 === 0) gewicht.push(laub ? 0.5 : 1);
      }
    }
  }
}

async function raster(name: string) {
  const b = BAUWERKE.find(x => x.name === name);
  if (!b) throw new Error(`${name}: kein Bauwerk im Register`);
  const pos: number[] = [], gewicht: number[] = [];
  dreiecke(await io.read(`public/bauten/${name}-bauten.glb`), false, pos, gewicht);
  if (b.dateien.includes('gruen')) dreiecke(await io.read(`public/bauten/${name}-gruen.glb`), true, pos, gewicht);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const bvh = new MeshBVH(geo);
  // Grundfläche (lokal) aus den Verdeckern, begrenzt.
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); z0 = Math.min(z0, pos[i + 2]); z1 = Math.max(z1, pos[i + 2]);
  }
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const bx = Math.min(MAX_SEITE, x1 - x0 + 2 * RAND), bz = Math.min(MAX_SEITE, z1 - z0 + 2 * RAND);
  const nx = Math.ceil(bx / SCHRITT), nz = Math.ceil(bz / SCHRITT);
  const lx = mx - (nx * SCHRITT) / 2, lz = mz - (nz * SCHRITT) / 2;
  const richt = halbkugel(STRAHLEN);
  const werte = new Uint8Array(nx * nz);
  const ray = new THREE.Ray(), o = new THREE.Vector3();
  const t0 = Date.now();
  let summe = 0, unter = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = lx + (i + 0.5) * SCHRITT, z = lz + (j + 0.5) * SCHRITT;
    const y = feld.hoehe(b.ursprung.x + x, b.ursprung.z + z) - b.h0;
    o.set(x, y + UEBER_BODEN, z);
    let sicht = 0;
    for (const r of richt) {
      ray.set(o, r);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, LAENGE);
      sicht += hit ? 1 - gewicht[Math.floor((hit.face?.a ?? 0) / 3)] : 1;
    }
    const s = sicht / STRAHLEN;
    werte[j * nx + i] = Math.round(s * 255);
    summe += s; if (s < 0.6) unter++;
  }
  writeFileSync(`public/bauten/${name}-himmel.bin`, werte);
  const meta = {
    // Weltlage der Zellmitten-Ecke (x0, z0) und Zellgrösse — `bodenmaterial.ts` rechnet damit.
    x0: b.ursprung.x + lx, z0: b.ursprung.z + lz, schritt: SCHRITT, breite: nx, tiefe: nz,
    mittel: Number((summe / (nx * nz)).toFixed(3)),
  };
  writeFileSync(`public/bauten/${name}-himmel.json`, JSON.stringify(meta, null, 1) + '\n');
  console.log(`${name}: ${nx}×${nz} Zellen à ${SCHRITT} m (${(nx * SCHRITT).toFixed(0)}×${(nz * SCHRITT).toFixed(0)} m), `
    + `${gewicht.length} Verdecker, Mittel ${meta.mittel}, unter 0,6: ${((unter / (nx * nz)) * 100).toFixed(0)} %, `
    + `${((Date.now() - t0) / 1000).toFixed(1)} s, ${(werte.length / 1024).toFixed(0)} KB`);
}

for (const name of process.argv.slice(2)) await raster(name);
