/**
 * BRACHLAND — Props aus Poly-Haven-Scans (D230, ADR-0013; Vorbild `farnscan.ts`, D229)
 *
 *   python3 -I .cache/phladen.py <asset> …     # 1K-glTF nach .cache/phmodelle/<asset>/ (einmalig)
 *   npx tsx tools/phprops.ts
 *
 * Je Eintrag in `SATZ` ein Prop `public/props/<datei>.glb`: ein Knoten aus dem Poly-Haven-Satz,
 * Fuss auf y = 0, mittig, auf `hoehe` skaliert, mit meshoptimizer auf `dreiecke` reduziert
 * (UV- und Normalennähte bleiben, `simplifyWithAttributes`). Blattkarten (`karten`) werden **nicht**
 * reduziert — eine Karte hat zwei Dreiecke, weniger ist kein Blatt. Wer sich biegt (`wind`), bekommt
 * `_WIND` (Höhe²) wie die Farne.
 *
 * Je Textursatz `public/material/<textur>-farbe.webp` (Modulation, Mittel 0,5, A = Alpha oder 1)
 * und `-normal.webp`. Den Farbton gibt die Palette (`attrappe.<art>`), wie bei Boden und Farn.
 * Herkunft: `assets/HERKUNFT.md`. Geprüft und verworfen: `shrub_02` (dünne Ruten, kein dichter Busch),
 * `moss_01` (Moosstängel von 1–3 cm zum Streuen, kein Polster).
 */
import { NodeIO, Document, type Node as GltfKnoten } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

interface Eintrag {
  quelle: string; knoten: string; datei: string; textur: string;
  hoehe: number; dreiecke: number; wind?: boolean; karten?: boolean;
}

/** Textursätze: Quelle (Materialname im glTF) → Name in `public/material/`, Kantenlänge. */
const TEXTUREN: Record<string, { quelle: string; material: string; groesse: number }> = {
  'fels-moos-1': { quelle: 'rock_moss_set_01', material: 'rock_moss_set_01', groesse: 1024 },
  'fels-moos-2': { quelle: 'rock_moss_set_02', material: 'rock_moss_set_02', groesse: 1024 },
  'stumpf-1':    { quelle: 'tree_stump_01', material: 'tree_stump_01', groesse: 512 },
  'stumpf-2':    { quelle: 'tree_stump_02', material: 'tree_stump_02', groesse: 512 },
  'ast':         { quelle: 'dry_branches_medium_01', material: 'dry_branches_medium_01', groesse: 512 },
  'wurzel-a':    { quelle: 'pine_roots', material: 'pine_roots_a', groesse: 512 },
  'wurzel-b':    { quelle: 'pine_roots', material: 'pine_roots_b', groesse: 512 },
};

/** Höhen wie die prozeduralen Varianten, die sie ersetzen (`props.ts` `VARIANTEN`). */
const SATZ: Eintrag[] = [
  { quelle: 'rock_moss_set_02', knoten: 'rock_moss_set_02_rock08', datei: 'findling_scan_a', textur: 'fels-moos-2', hoehe: 0.45, dreiecke: 1500 },
  { quelle: 'rock_moss_set_02', knoten: 'rock_moss_set_02_rock10', datei: 'findling_scan_b', textur: 'fels-moos-2', hoehe: 0.7, dreiecke: 1500 },
  { quelle: 'rock_moss_set_02', knoten: 'rock_moss_set_02_rock11', datei: 'findling_scan_c', textur: 'fels-moos-2', hoehe: 0.9, dreiecke: 1800 },
  { quelle: 'rock_moss_set_01', knoten: 'rock_moss_set_01_rock02', datei: 'findling_scan_d', textur: 'fels-moos-1', hoehe: 1.7, dreiecke: 2200 },
  { quelle: 'rock_moss_set_01', knoten: 'rock_moss_set_01_rock03', datei: 'findling_scan_e', textur: 'fels-moos-1', hoehe: 2.2, dreiecke: 2400 },
  { quelle: 'rock_moss_set_01', knoten: 'rock_moss_set_01_rock04', datei: 'findling_scan_f', textur: 'fels-moos-1', hoehe: 3.0, dreiecke: 2400 },
  { quelle: 'dry_branches_medium_01', knoten: 'dry_branches_medium_01_a', datei: 'totholz_scan_ast', textur: 'ast', hoehe: 0.5, dreiecke: 1200 },
  { quelle: 'tree_stump_02', knoten: 'tree_stump_02', datei: 'totholz_scan_dick', textur: 'stumpf-2', hoehe: 0.8, dreiecke: 2400 },
  { quelle: 'dry_branches_medium_01', knoten: 'dry_branches_medium_01_b', datei: 'totholz_scan_zweig', textur: 'ast', hoehe: 0.3, dreiecke: 1000 },
  { quelle: 'tree_stump_01', knoten: 'tree_stump_01', datei: 'totholz_scan_stumpf', textur: 'stumpf-1', hoehe: 0.6, dreiecke: 2400 },
  { quelle: 'pine_roots', knoten: 'pine_roots_a', datei: 'totholz_scan_wurzel', textur: 'wurzel-a', hoehe: 0.2, dreiecke: 2400 },
  { quelle: 'pine_roots', knoten: 'pine_roots_b', datei: 'totholz_scan_wurzel2', textur: 'wurzel-b', hoehe: 0.2, dreiecke: 2400 },
];

await MeshoptSimplifier.ready;
const io = new NodeIO();
const dokumente = new Map<string, Document>();
const lies = async (quelle: string) => {
  if (!dokumente.has(quelle)) dokumente.set(quelle, await io.read(join('.cache/phmodelle', quelle, `${quelle}_1k.gltf`)));
  return dokumente.get(quelle)!;
};

for (const e of SATZ) {
  const doc = await lies(e.quelle);
  const knoten = doc.getRoot().listNodes().find((n: GltfKnoten) => n.getName() === e.knoten);
  if (!knoten?.getMesh()) throw new Error(`${e.quelle}: Knoten ${e.knoten} fehlt`);
  const prim = knoten.getMesh()!.listPrimitives()[0];
  // Knotendrehung/-skala einrechnen (Büsche liegen gedreht im Satz), Verschiebung nicht — wir zentrieren.
  const welt = knoten.getWorldMatrix();
  const roh = prim.getAttribute('POSITION')!.getArray() as Float32Array;
  const rohN = prim.getAttribute('NORMAL')!.getArray() as Float32Array;
  const uv = new Float32Array(prim.getAttribute('TEXCOORD_0')!.getArray() as Float32Array);
  const n = roh.length / 3;
  const pos = new Float32Array(roh.length), nor = new Float32Array(roh.length);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = [roh[i * 3], roh[i * 3 + 1], roh[i * 3 + 2]];
    pos[i * 3] = welt[0] * x + welt[4] * y + welt[8] * z;
    pos[i * 3 + 1] = welt[1] * x + welt[5] * y + welt[9] * z;
    pos[i * 3 + 2] = welt[2] * x + welt[6] * y + welt[10] * z;
    const [a, b, c] = [rohN[i * 3], rohN[i * 3 + 1], rohN[i * 3 + 2]];
    const nx = welt[0] * a + welt[4] * b + welt[8] * c, ny = welt[1] * a + welt[5] * b + welt[9] * c, nz = welt[2] * a + welt[6] * b + welt[10] * c;
    const l = Math.hypot(nx, ny, nz) || 1;
    nor[i * 3] = nx / l; nor[i * 3 + 1] = ny / l; nor[i * 3 + 2] = nz / l;
  }
  let idx: Uint32Array = new Uint32Array(prim.getIndices()!.getArray()!);
  const vorher = idx.length / 3;

  if (!e.karten && e.dreiecke > 0 && vorher > e.dreiecke) {
    // Attribute: Normale (Gewicht 0,5) und UV (Gewicht 1) — Nähte und Kanten bleiben.
    const attr = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) attr.set([nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], uv[i * 2], uv[i * 2 + 1]], i * 5);
    const [neu] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, attr, 5, [0.5, 0.5, 0.5, 1, 1], null, e.dreiecke * 3, 0.05);
    idx = new Uint32Array(neu);
  }

  // Nur benutzte Ecken behalten, Fuss auf 0, mittig, auf Zielhöhe skalieren.
  const benutzt = new Int32Array(n).fill(-1);
  let k = 0;
  for (const i of idx) if (benutzt[i] < 0) benutzt[i] = k++;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) if (benutzt[i] >= 0) {
    minX = Math.min(minX, pos[i * 3]); maxX = Math.max(maxX, pos[i * 3]);
    minY = Math.min(minY, pos[i * 3 + 1]); maxY = Math.max(maxY, pos[i * 3 + 1]);
    minZ = Math.min(minZ, pos[i * 3 + 2]); maxZ = Math.max(maxZ, pos[i * 3 + 2]);
  }
  const s = e.hoehe / (maxY - minY), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const P = new Float32Array(k * 3), N = new Float32Array(k * 3), U = new Float32Array(k * 2), W = new Float32Array(k);
  for (let i = 0; i < n; i++) {
    const j = benutzt[i]; if (j < 0) continue;
    P[j * 3] = (pos[i * 3] - cx) * s;
    P[j * 3 + 1] = (pos[i * 3 + 1] - minY) * s - 0.03 * Math.min(1, e.hoehe); // leicht eingegraben
    P[j * 3 + 2] = (pos[i * 3 + 2] - cz) * s;
    N.set([nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]], j * 3);
    U.set([uv[i * 2], uv[i * 2 + 1]], j * 2);
    const t = (pos[i * 3 + 1] - minY) / (maxY - minY);
    W[j] = t * t;
  }
  const I = k > 65535 ? new Uint32Array(idx.length) : new Uint16Array(idx.length);
  idx.forEach((v, i) => { I[i] = benutzt[v]; });

  const aus = new Document();
  const puffer = aus.createBuffer();
  const p = aus.createPrimitive()
    .setAttribute('POSITION', aus.createAccessor().setType('VEC3').setArray(P).setBuffer(puffer))
    .setAttribute('NORMAL', aus.createAccessor().setType('VEC3').setArray(N).setBuffer(puffer))
    .setAttribute('TEXCOORD_0', aus.createAccessor().setType('VEC2').setArray(U).setBuffer(puffer))
    .setAttribute('_WIND', aus.createAccessor().setType('SCALAR').setArray(e.wind ? W : new Float32Array(k)).setBuffer(puffer))
    .setIndices(aus.createAccessor().setType('SCALAR').setArray(I).setBuffer(puffer));
  aus.createScene().addChild(aus.createNode(e.datei).setMesh(aus.createMesh(e.datei).addPrimitive(p)));
  await io.write(`public/props/${e.datei}.glb`, aus);
  console.log(`${e.datei}: ${vorher} → ${idx.length / 3} Dreiecke, ${(maxX - minX) * s | 0}.${Math.round(((maxX - minX) * s % 1) * 10)} × ${e.hoehe} × ${((maxZ - minZ) * s).toFixed(1)} m`);
}

// Texturen packen (Python/PIL wie D223/D229).
const packer = `
import sys, json, glob, numpy as np
from PIL import Image
quelle, material, ziel, name, N = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5])
def bild(muster):
    t = glob.glob(quelle + '/textures/' + muster)
    return t[0] if t else None
f = np.asarray(Image.open(bild(material + '_diff_1k.*')).convert('RGB').resize((N, N), Image.LANCZOS), dtype=np.float32) / 255
ap = bild('alpha_1k.*')
a = np.asarray(Image.open(ap).convert('L').resize((N, N), Image.LANCZOS), dtype=np.float32) / 255 if ap else np.ones((N, N), np.float32)
lin = np.where(f <= 0.04045, f / 12.92, ((f + 0.055) / 1.055) ** 2.4)
sicht = a > 0.5
mittel = lin[sicht].mean(0)
mod = np.clip(lin / mittel * 0.5, 0, 1)
mod[~sicht] = 0.5
rgba = np.dstack([(mod * 255 + 0.5).astype(np.uint8), (a * 255 + 0.5).astype(np.uint8)])
Image.fromarray(rgba, 'RGBA').save(ziel + '/' + name + '-farbe.webp', quality=82, method=6)
Image.open(bild(material + '_nor_gl_1k.*')).convert('RGB').resize((N, N), Image.LANCZOS).save(ziel + '/' + name + '-normal.webp', quality=82, method=6)
print(name, 'Mittel (linear):', np.round(mittel, 4))
`;
const skript = join('.cache', 'phmodelle', 'phpack.py');
writeFileSync(skript, packer);
for (const [name, t] of Object.entries(TEXTUREN))
  console.log(execFileSync('python3', ['-I', skript, join('.cache/phmodelle', t.quelle), t.material, 'public/material', name, String(t.groesse)], { encoding: 'utf8' }).trim());
