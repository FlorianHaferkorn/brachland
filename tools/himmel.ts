/**
 * BRACHLAND — Himmelsanteil je Ecke für die Set-Pieces (D170)
 *
 *   npx tsx tools/himmel.ts felsmulde [stauwehr …]
 *
 * Schreibt in `public/bauten/<name>-bauten.glb` und `-gruen.glb` ein Attribut `_HIMMEL` (0…1, 8 Bit):
 * wie viel Himmel eine Ecke sieht, cosinusgewichtet über die Halbkugel ihrer Normale. Die Szene
 * dämpft damit **nur das Fülllicht** (Hemisphäre), nicht die Sonne (`windmaterial.ts`, `himmel`).
 *
 * ## Warum
 *
 * D169: Gegen den Render stimmte das obere Bilddrittel, der Schatten nicht (dunkel 32 gegen 58 %,
 * 16 gegen 44 %). Ohne Fülllicht (`?umgebung=0`) trifft die Felsmulde den Render fast genau —
 * dunkel 58 %, Drittel 0,208/0,124/0,043 gegen 0,225/0,123/0,044 —, aber die sonnenabgewandte
 * Mauer wird schwarz (D159). Das Fülllicht ist also richtig, nur **überall gleich stark**: Der Hof
 * zwischen drei Mauern bekommt dasselbe Himmelslicht wie die freie Mauerkrone. Cycles rechnet das
 * mit Bounces; hier wird es einmal vorab gerechnet und als Zahl je Ecke mitgeliefert.
 *
 * ## Wie
 *
 * Alle Dreiecke beider Dateien in Weltkoordinaten in eine BVH (three-mesh-bvh). Je Ecke N Strahlen
 * (Fibonacci-Halbkugel, cosinusverteilt, fest — gleiche Eingabe, gleiche Datei), 15 m lang, 3 cm
 * über der Fläche gestartet. Ein Strahl, der **Laub** trifft, zählt halb (Kronen haben Löcher,
 * D158); Stein, Holz und Stämme ganz. Das Gelände verdeckt nicht mit — offen, siehe MESSLAUF.
 *
 * Die Datei wird verlustfrei zurückgeschrieben (nur der Meshopt-Codec, `bautenpack.ts`). Zweimal
 * laufen lassen ist harmlos: Ein vorhandenes `_HIMMEL` wird ersetzt, nicht als Verdecker gezählt.
 */
import { NodeIO, type Document, type Node, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { statSync } from 'node:fs';

const LAUB = /Krone|Nadeln|Farn|Efeu|Laub/;
const STRAHLEN = { bauten: 24, gruen: 12 } as const;
const LAENGE = 15;
const ABSTAND = 0.03;

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});

/** Feste cosinusverteilte Richtungen um +Z (Fibonacci). */
function halbkugel(n: number): THREE.Vector3[] {
  const r: THREE.Vector3[] = [];
  const gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;             // cosinusverteilt: z = sqrt(1-u)
    const z = Math.sqrt(1 - u), s = Math.sqrt(u), a = i * gold;
    r.push(new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, z));
  }
  return r;
}

interface Teil { prim: Primitive; node: Node; laub: boolean; welt: THREE.Matrix4 }

function teile(doc: Document, laubErkennen: boolean): Teil[] {
  const r: Teil[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const welt = new THREE.Matrix4().fromArray(node.getWorldMatrix());
    const laub = laubErkennen && LAUB.test(node.getName() + ' ' + mesh.getName());
    for (const prim of mesh.listPrimitives()) r.push({ prim, node, laub, welt });
  }
  return r;
}

async function rechne(name: string) {
  const pfade = { bauten: `public/bauten/${name}-bauten.glb`, gruen: `public/bauten/${name}-gruen.glb` };
  const docs = { bauten: await io.read(pfade.bauten), gruen: await io.read(pfade.gruen) };
  const alle = { bauten: teile(docs.bauten, false), gruen: teile(docs.gruen, true) };

  // ---- Verdecker: eine Geometrie, je Dreieck ein Gewicht (Laub 0,5, sonst 1).
  const pos: number[] = [];
  const gewicht: number[] = [];
  const v = new THREE.Vector3();
  for (const liste of [alle.bauten, alle.gruen]) for (const t of liste) {
    const p = t.prim.getAttribute('POSITION')!;
    const idx = t.prim.getIndices();
    const n = idx ? idx.getCount() : p.getCount();
    const e: number[] = [];
    for (let i = 0; i < n; i++) {
      const k = idx ? idx.getScalar(i) : i;
      p.getElement(k, e);
      v.set(e[0], e[1], e[2]).applyMatrix4(t.welt);
      pos.push(v.x, v.y, v.z);
      if (i % 3 === 0) gewicht.push(t.laub ? 0.5 : 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const t0 = Date.now();
  const bvh = new MeshBVH(geo);
  console.log(`${name}: ${gewicht.length} Verdecker-Dreiecke, BVH in ${Date.now() - t0} ms`);

  const ray = new THREE.Ray();
  const nm = new THREE.Matrix3();
  const q = new THREE.Quaternion();
  const z = new THREE.Vector3(0, 0, 1);
  const d = new THREE.Vector3();
  for (const art of ['bauten', 'gruen'] as const) {
    const richt = halbkugel(STRAHLEN[art]);
    let ecken = 0, summe = 0;
    const t1 = Date.now();
    for (const t of alle[art]) {
      const p = t.prim.getAttribute('POSITION')!;
      const nAttr = t.prim.getAttribute('NORMAL');
      if (!nAttr) { console.warn(`  ${t.node.getName()}: keine Normalen — übersprungen`); continue; }
      nm.getNormalMatrix(t.welt);
      const werte = new Uint8Array(p.getCount());
      const e: number[] = [], f: number[] = [];
      for (let i = 0; i < p.getCount(); i++) {
        p.getElement(i, e); nAttr.getElement(i, f);
        const o = new THREE.Vector3(e[0], e[1], e[2]).applyMatrix4(t.welt);
        const n = new THREE.Vector3(f[0], f[1], f[2]).applyMatrix3(nm).normalize();
        if (!Number.isFinite(n.x) || n.lengthSq() < 0.5) { werte[i] = 255; continue; }
        q.setFromUnitVectors(z, n);
        o.addScaledVector(n, ABSTAND);
        let sicht = 0;
        for (const r of richt) {
          d.copy(r).applyQuaternion(q);
          ray.set(o, d);
          const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, LAENGE);
          // `faceIndex` zeigt in den umsortierten Index der BVH; `face.a` auf die Ecke der Eingabe, und
          // ohne Index ist das Dreieck die Ecke durch drei.
          sicht += hit ? 1 - gewicht[Math.floor((hit.face?.a ?? 0) / 3)] : 1;
        }
        const s = sicht / richt.length;
        werte[i] = Math.round(s * 255);
        summe += s; ecken++;
      }
      const doc = docs[art];
      const alt = t.prim.getAttribute('_HIMMEL');
      const acc = doc.createAccessor(`${t.node.getName()}_himmel`)
        .setType('SCALAR').setArray(werte).setNormalized(true)
        .setBuffer(doc.getRoot().listBuffers()[0]);
      t.prim.setAttribute('_HIMMEL', acc);
      if (alt && alt.listParents().length <= 1) alt.dispose();
    }
    console.log(`  ${art}: ${ecken} Ecken, ${STRAHLEN[art]} Strahlen, Mittel ${(summe / Math.max(1, ecken)).toFixed(3)}, ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  }

  for (const art of ['bauten', 'gruen'] as const) {
    const doc = docs[art];
    doc.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const vorher = statSync(pfade[art]).size;
    await io.write(pfade[art], doc);
    console.log(`  ${pfade[art]}: ${(vorher / 1e6).toFixed(2)} → ${(statSync(pfade[art]).size / 1e6).toFixed(2)} MB`);
  }
}

for (const name of process.argv.slice(2)) await rechne(name);
