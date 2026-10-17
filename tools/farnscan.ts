/**
 * BRACHLAND — Gescannte Farne aus Poly Haven `fern_02` (D229, ADR-0013)
 *
 *   npx tsx tools/farnscan.ts
 *
 * Quelle (CC0, Rob Tuytel Scan / Rico Cilliers Modell): `.cache/phmodelle/fern_02/` — glTF in 1K
 * samt `textures/` und Alpha-Karte, geladen über `api.polyhaven.com/files/fern_02`. Der Satz hat
 * vier Farne mit zusammen 6.232 Dreiecken und einem gemeinsamen Material.
 *
 * Ausgabe:
 * - `public/props/farn_scan_{a,b,c,d}.glb` — je ein Farn, Fuss auf y = 0, mittig, ×1,6 (die Scans
 *   stehen 0,2–0,4 m, Wurmfarn 0,5–1,2 m), Attribute POSITION, NORMAL, TEXCOORD_0 und `_WIND`
 *   (Höhe², wie `windAusHoehe`). Kein Material: Gezeichnet wird mit `farnWind` (RegionsSzene).
 * - `public/material/farn-farbe.webp` — RGB **Modulation** (linear durch den Mittelwert der
 *   sichtbaren Blattpixel, Mittel 0,5), A die Alphamaske. Der Farbton kommt aus der Palette
 *   (`attrappe.farn`), wie beim Boden (D223) — Art Direction bleibt, der Scan bringt Struktur.
 * - `public/material/farn-normal.webp` — `nor_gl` verkleinert.
 */
import { NodeIO, Document } from '@gltf-transform/core';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const QUELLE = '.cache/phmodelle/fern_02';
const SKALA = 1.6;
const NAMEN: Record<string, string> = { fern_02_a: 'a', fern_02_b: 'b', fern_02_c: 'c', fern_02_d: 'd' };

const io = new NodeIO();
const doc = await io.read(join(QUELLE, 'fern_02_1k.gltf'));

for (const knoten of doc.getRoot().listNodes()) {
  const kurz = NAMEN[knoten.getName()];
  const mesh = knoten.getMesh();
  if (!kurz || !mesh) continue;
  const prim = mesh.listPrimitives()[0];
  const pos = prim.getAttribute('POSITION')!.getArray() as Float32Array;
  const nor = prim.getAttribute('NORMAL')!.getArray() as Float32Array;
  const uv = prim.getAttribute('TEXCOORD_0')!.getArray() as Float32Array;
  const idx = prim.getIndices()!.getArray()!;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
    minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
    minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, hoehe = (maxY - minY) * SKALA;
  const neu = new Float32Array(pos.length);
  const wind = new Float32Array(pos.length / 3);
  for (let i = 0, k = 0; i < pos.length; i += 3, k++) {
    neu[i] = (pos[i] - cx) * SKALA;
    neu[i + 1] = (pos[i + 1] - minY) * SKALA - 0.02; // 2 cm eingegraben: kein Spalt am Hang
    neu[i + 2] = (pos[i + 2] - cz) * SKALA;
    const t = Math.max(0, (pos[i + 1] - minY) / (maxY - minY));
    wind[k] = t * t;
  }

  const aus = new Document();
  const puffer = aus.createBuffer();
  const p = aus.createPrimitive()
    .setAttribute('POSITION', aus.createAccessor().setType('VEC3').setArray(neu).setBuffer(puffer))
    .setAttribute('NORMAL', aus.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(puffer))
    .setAttribute('TEXCOORD_0', aus.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(puffer))
    .setAttribute('_WIND', aus.createAccessor().setType('SCALAR').setArray(wind).setBuffer(puffer))
    .setIndices(aus.createAccessor().setType('SCALAR').setArray(new Uint16Array(idx)).setBuffer(puffer));
  const m = aus.createMesh(`farn_scan_${kurz}`).addPrimitive(p);
  aus.createScene().addChild(aus.createNode(`farn_scan_${kurz}`).setMesh(m));
  const datei = `public/props/farn_scan_${kurz}.glb`;
  await io.write(datei, aus);
  console.log(`${datei}: ${idx.length / 3} Dreiecke, Höhe ${hoehe.toFixed(2)} m, Breite ${((maxX - minX) * SKALA).toFixed(2)} m`);
}

// Texturen: Modulation + Alpha, Normale. Python/PIL, wie beim Boden (D223) — kein neues npm-Paket.
const packer = `
import sys, numpy as np
from PIL import Image
q, z = sys.argv[1], sys.argv[2]
N = 1024
f = np.asarray(Image.open(q + '/textures/fern_02_diff_1k.jpg').convert('RGB').resize((N, N), Image.LANCZOS), dtype=np.float32) / 255
a = np.asarray(Image.open(q + '/textures/alpha_1k.png').convert('L').resize((N, N), Image.LANCZOS), dtype=np.float32) / 255
lin = np.where(f <= 0.04045, f / 12.92, ((f + 0.055) / 1.055) ** 2.4)
sicht = a > 0.5
mittel = lin[sicht].mean(0)
mod = np.clip(lin / mittel * 0.5, 0, 1)
# Ausserhalb der Maske den Mittelwert, damit Mipmaps am Blattrand nicht abdunkeln.
mod[~sicht] = 0.5
rgba = np.dstack([(mod * 255 + 0.5).astype(np.uint8), (a * 255 + 0.5).astype(np.uint8)])
Image.fromarray(rgba, 'RGBA').save(z + '/farn-farbe.webp', quality=85, method=6)
Image.open(q + '/textures/fern_02_nor_gl_1k.jpg').convert('RGB').resize((N, N), Image.LANCZOS).save(z + '/farn-normal.webp', quality=85, method=6)
print('Mittel (linear, Blatt):', np.round(mittel, 4))
`;
const skript = join(QUELLE, '..', 'farnpack.py');
writeFileSync(skript, packer);
console.log(execFileSync('python3', ['-I', skript, QUELLE, 'public/material'], { encoding: 'utf8' }).trim());
