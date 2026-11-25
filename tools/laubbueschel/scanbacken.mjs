// D480: Lokale Projektion der Original-Scan-Kronen in Büschelkarten. Aufruf in tools/_INDEX.md.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { instance, compactPrimitive, dedup, prune, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [lagenPfad, scanOrdner, ausgabe] = process.argv.slice(2);
if (!ausgabe || existsSync(ausgabe)) throw Error('Aufruf: node scanbacken.mjs lagen.json scanordner neue.glb');
const lagen = JSON.parse(readFileSync(lagenPfad, 'utf8'));
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const doc = new Document();
doc.createExtension(EXTTextureWebP).setRequired(true);
const puffer = doc.createBuffer();
const szene = doc.createScene();
const feld = (typ, daten) => doc.createAccessor().setBuffer(puffer).setType(typ).setArray(daten);
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const kachel = 128;
const kacheln = 16;
const kante = kacheln * kachel;

async function bild(pfad, grau = false) {
  const pipeline = sharp(pfad);
  return (grau ? pipeline.greyscale() : pipeline.removeAlpha()).raw().toBuffer({ resolveWithObject: true });
}

// Dreiecke räumlich bündeln. Die Karte hat die tatsächliche Breite und Höhe ihres Kronenteils.
function buendeln(teile, lo, hi) {
  const gruppen = new Map();
  for (const teil of teile) {
    const { pos, ind } = teil;
    for (let i = 0; i < ind.length; i += 3) {
      const a = ind[i] * 3,
        b = ind[i + 1] * 3,
        c = ind[i + 2] * 3;
      let schluessel = 0;
      for (let d = 0; d < 3; d++) {
        const mitte = (pos[a + d] + pos[b + d] + pos[c + d]) / 3;
        const zelle = Math.max(0, Math.min(5, Math.floor((6 * (mitte - lo[d])) / (hi[d] - lo[d]))));
        schluessel = schluessel * 6 + zelle;
      }
      if (!gruppen.has(schluessel))
        gruppen.set(
          schluessel,
          teile.map(() => []),
        );
      gruppen.get(schluessel)[teil.nr].push(i);
    }
  }
  return gruppen;
}

// Tiefentest und Original-UV je Blatt/Zweig; transparente Texel geben den Blick auf die dahinterliegende Schicht frei.
function zeichne(teil, dreiecke, projektion, rahmen, atlas, platz, tiefe) {
  const { ind, uv, farbe, alpha, faktor, versatz } = teil;
  const { daten, breite, hoehe } = farbe;
  const [links, oben, sx, sy] = rahmen;
  for (const i of dreiecke) {
    const ia = ind[i],
      ib = ind[i + 1],
      ic = ind[i + 2];
    const a = ia * 3,
      b = ib * 3,
      c = ic * 3;
    const ax = (projektion[a] - links) * sx + 2,
      ay = (oben - projektion[a + 1]) * sy + 2;
    const bx = (projektion[b] - links) * sx + 2,
      by = (oben - projektion[b + 1]) * sy + 2;
    const cx = (projektion[c] - links) * sx + 2,
      cy = (oben - projektion[c + 1]) * sy + 2;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-8) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))),
      x1 = Math.min(kachel - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))),
      y1 = Math.min(kachel - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const wa = ((by - cy) * (x + 0.5 - cx) + (cx - bx) * (y + 0.5 - cy)) / det;
        const wb = ((cy - ay) * (x + 0.5 - cx) + (ax - cx) * (y + 0.5 - cy)) / det,
          wc = 1 - wa - wb;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const z = wa * projektion[a + 2] + wb * projektion[b + 2] + wc * projektion[c + 2];
        const pixel = y * kachel + x;
        if (z <= tiefe[pixel]) continue;
        const u = (wa * uv[ia * 2] + wb * uv[ib * 2] + wc * uv[ic * 2]) * faktor[0] + versatz[0];
        const v = (wa * uv[ia * 2 + 1] + wb * uv[ib * 2 + 1] + wc * uv[ic * 2 + 1]) * faktor[1] + versatz[1];
        const tx = Math.floor((u - Math.floor(u)) * breite),
          ty = Math.floor((v - Math.floor(v)) * hoehe);
        const texel = ty * breite + tx;
        if (alpha && alpha[texel] < 128) continue;
        const aus = 4 * ((platz[1] + y) * kante + platz[0] + x);
        atlas[aus] = daten[3 * texel];
        atlas[aus + 1] = daten[3 * texel + 1];
        atlas[aus + 2] = daten[3 * texel + 2];
        atlas[aus + 3] = 255;
        tiefe[pixel] = z;
      }
  }
}

// UV-Nähte trennen oft die Ecken desselben Zweigs. Räumlich deckungsgleiche Ecken vereinen,
// bevor die volle Länge jedes zusammenhängenden Zweigs gemessen wird.
function trenneZweige(pos, index) {
  const eltern = MeshoptSimplifier.generatePositionRemap(pos, 3);
  function wurzel(i) {
    while (i !== eltern[i]) {
      eltern[i] = eltern[eltern[i]];
      i = eltern[i];
    }
    return i;
  }
  for (let i = 0; i < index.length; i += 3) {
    const erste = wurzel(index[i]);
    eltern[wurzel(index[i + 1])] = erste;
    eltern[wurzel(index[i + 2])] = erste;
  }
  const grenzen = new Map();
  for (const ecke of index) {
    const nr = wurzel(ecke);
    if (!grenzen.has(nr))
      grenzen.set(nr, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
    const { min, max } = grenzen.get(nr);
    for (let d = 0; d < 3; d++) {
      min[d] = Math.min(min[d], pos[ecke * 3 + d]);
      max[d] = Math.max(max[d], pos[ecke * 3 + d]);
    }
  }
  const langeZweige = new Set(
    [...grenzen]
      .filter(([, { min, max }]) => Math.hypot(...max.map((v, d) => v - min[d])) >= 0.48)
      .map(([nr]) => nr),
  );
  const leit = [],
    fein = [];
  for (let i = 0; i < index.length; i += 3) {
    const liste = langeZweige.has(wurzel(index[i])) ? leit : fein;
    liste.push(index[i], index[i + 1], index[i + 2]);
  }
  return { leit: new Uint32Array(leit), fein: new Uint32Array(fein) };
}

async function holzteil(mesh, original, eingabe, basis, fehlergrenze, texturkante, trafo) {
  const name = original.getMaterial().getName();
  const pos = original.getAttribute('POSITION').getArray();
  const [index, fehler] = MeshoptSimplifier.simplify(new Uint32Array(eingabe), pos, 3, 5400, fehlergrenze, [
    'ErrorAbsolute',
    'Permissive',
  ]);
  const uv = original.getAttribute('TEXCOORD_0').getArray();
  const skala = trafo?.scale ?? [1, 1],
    versatz = trafo?.offset ?? [0, 0];
  const holz = doc
    .createPrimitive()
    .setIndices(feld('SCALAR', index))
    .setAttribute(
      'POSITION',
      feld(
        'VEC3',
        pos.map((v, i) => v - basis[i % 3]),
      ),
    )
    .setAttribute('NORMAL', feld('VEC3', original.getAttribute('NORMAL').getArray()))
    .setAttribute(
      'TEXCOORD_0',
      feld(
        'VEC2',
        uv.map((v, i) => v * skala[i % 2] + versatz[i % 2]),
      ),
    );
  const rinde = doc
    .createTexture(name + '-Rinde')
    .setMimeType('image/webp')
    .setImage(
      await sharp(original.getMaterial().getBaseColorTexture().getImage())
        .resize(texturkante)
        .webp({ quality: 85 })
        .toBuffer(),
    );
  holz.setMaterial(
    doc
      .createMaterial(name + '-Holz')
      .setMetallicFactor(0)
      .setRoughnessFactor(0.92)
      .setBaseColorTexture(rinde),
  );
  compactPrimitive(holz);
  mesh.addPrimitive(holz);
  console.log(name, index.length / 3, 'Holzdreiecke, Fehler im Scanmaß', fehler);
}

async function vorlage(art) {
  const ordner = join(scanOrdner, art);
  const pfad = join(ordner, art + '_2k.gltf');
  const quelle = await io.read(pfad);
  const roh = JSON.parse(readFileSync(pfad, 'utf8'));
  const primitive = quelle.getRoot().listMeshes()[0].listPrimitives();
  const lo = [Infinity, Infinity, Infinity],
    hi = lo.map(() => -Infinity);
  for (const p of primitive) {
    const pos = p.getAttribute('POSITION');
    const min = pos.getMin([]),
      max = pos.getMax([]);
    for (let d = 0; d < 3; d++) {
      lo[d] = Math.min(lo[d], min[d]);
      hi[d] = Math.max(hi[d], max[d]);
    }
  }
  // Gleicher Nullpunkt wie scan_modelle() im Blender-Szenenbau.
  const basis = [(hi[0] + lo[0]) / 2, lo[1], (hi[2] + lo[2]) / 2];
  const mesh = doc.createMesh(art);
  const holz = primitive.find((p) => p.getMaterial().getName() === art);
  const stammTrafo = roh.materials.find((m) => m.name === art).pbrMetallicRoughness.baseColorTexture.extensions
    ?.KHR_texture_transform;
  await holzteil(mesh, holz, holz.getIndices().getArray(), basis, 0.005, 1024, stammTrafo);
  const teile = [];
  for (const p of primitive.filter((p) => p !== holz)) {
    const name = p.getMaterial().getName();
    const mat = roh.materials.find((m) => m.name === name);
    const tex = mat.pbrMetallicRoughness.baseColorTexture;
    const farbe = await bild(join(ordner, roh.images[roh.textures[tex.index].source].uri));
    const maskiert = name.includes('_leaves');
    const alpha = maskiert ? await bild(join(ordner, 'textures', art + '_leaves_alpha_2k.png'), true) : null;
    if (alpha && (alpha.info.width !== farbe.info.width || alpha.info.height !== farbe.info.height))
      throw Error('Alphakarte passt nicht zur Farbe.');
    const trafo = tex.extensions?.KHR_texture_transform;
    let zweige = p.getIndices().getArray();
    if (!maskiert) {
      const { leit, fein } = trenneZweige(p.getAttribute('POSITION').getArray(), zweige);
      if (leit.length) await holzteil(mesh, p, leit, basis, 0.004, 512, trafo);
      zweige = fein;
    }
    teile.push({
      nr: teile.length,
      pos: p.getAttribute('POSITION').getArray(),
      ind: zweige,
      uv: p.getAttribute('TEXCOORD_0').getArray(),
      farbe: { daten: farbe.data, breite: farbe.info.width, hoehe: farbe.info.height },
      alpha: alpha?.data,
      faktor: trafo?.scale ?? [1, 1],
      versatz: trafo?.offset ?? [0, 0],
    });
  }
  const atlas = Buffer.alloc(kante * kante * 4);
  const ecken = [],
    normalen = [],
    uvs = [],
    indices = [];
  const gruppen = buendeln(teile, lo, hi);
  for (const [schluessel, listen] of gruppen) {
    const nr = ecken.length / 12,
      platz = [(nr % kacheln) * kachel, Math.floor(nr / kacheln) * kachel];
    const winkel = schluessel * 2.399963,
      neigung = 0.35 + 0.21 * Math.sin(schluessel);
    const normal = [Math.sin(winkel) * Math.cos(neigung), Math.sin(neigung), Math.cos(winkel) * Math.cos(neigung)];
    const rechts = [Math.cos(winkel), 0, -Math.sin(winkel)],
      hoch = kreuz(normal, rechts);
    let links = Infinity,
      re = -Infinity,
      unten = Infinity,
      oben = -Infinity,
      zmin = Infinity,
      zmax = -Infinity;
    // Nur von dieser Zelle benutzte Ecken projizieren. Puffer einmal je Vorlage anlegen.
    for (const teil of teile) {
      teil.proj ??= new Float32Array(teil.pos.length);
      for (const i of listen[teil.nr])
        for (let j = i; j < i + 3; j++) {
          const a = teil.ind[j] * 3,
            x = teil.pos[a],
            y = teil.pos[a + 1],
            z = teil.pos[a + 2];
          const u = x * rechts[0] + z * rechts[2],
            v = x * hoch[0] + y * hoch[1] + z * hoch[2],
            t = x * normal[0] + y * normal[1] + z * normal[2];
          teil.proj[a] = u;
          teil.proj[a + 1] = v;
          teil.proj[a + 2] = t;
          links = Math.min(links, u);
          re = Math.max(re, u);
          unten = Math.min(unten, v);
          oben = Math.max(oben, v);
          zmin = Math.min(zmin, t);
          zmax = Math.max(zmax, t);
        }
    }
    const tiefe = new Float32Array(kachel * kachel).fill(-Infinity);
    for (const teil of teile)
      zeichne(
        teil,
        listen[teil.nr],
        teil.proj,
        [links, oben, (kachel - 4) / (re - links), (kachel - 4) / (oben - unten)],
        atlas,
        platz,
        tiefe,
      );
    const beginn = nr * 4;
    for (const [a, b] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      const u = a ? re : links,
        v = b ? oben : unten,
        t = (zmin + zmax) / 2;
      for (let d = 0; d < 3; d++) ecken.push(u * rechts[d] + v * hoch[d] + t * normal[d] - basis[d]);
      normalen.push(...normal);
      uvs.push((platz[0] + 2 + a * (kachel - 4)) / kante, (platz[1] + 2 + (1 - b) * (kachel - 4)) / kante);
    }
    indices.push(beginn, beginn + 1, beginn + 2, beginn, beginn + 2, beginn + 3);
  }
  // Beim Mipmapping robuste Randfarbe: transparente Nachbarpixel erhalten die lokale Laubfarbe.
  for (let y = 1; y < kante - 1; y++)
    for (let x = 1; x < kante - 1; x++) {
      const a = 4 * (kante * y + x);
      if (atlas[a + 3]) continue;
      const n = [a - 4, a + 4, a - 4 * kante, a + 4 * kante].find((i) => atlas[i + 3]);
      for (let d = 0; d < 3; d++) atlas[a + d] = n === undefined ? [84, 89, 48][d] : atlas[n + d];
    }
  const textur = doc
    .createTexture(art + '-Büschel')
    .setMimeType('image/webp')
    .setImage(
      await sharp(atlas, { raw: { width: kante, height: kante, channels: 4 } })
        .webp({ quality: 88, alphaQuality: 100 })
        .toBuffer(),
    );
  const laub = doc
    .createMaterial(art + '-leaves')
    .setMetallicFactor(0)
    .setRoughnessFactor(1)
    .setAlphaMode('MASK')
    .setAlphaCutoff(0.48)
    .setDoubleSided(true)
    .setBaseColorTexture(textur);
  mesh.addPrimitive(
    doc
      .createPrimitive()
      .setAttribute('POSITION', feld('VEC3', new Float32Array(ecken)))
      .setAttribute('NORMAL', feld('VEC3', new Float32Array(normalen)))
      .setAttribute('TEXCOORD_0', feld('VEC2', new Float32Array(uvs)))
      .setIndices(feld('SCALAR', new Uint16Array(indices)))
      .setMaterial(laub),
  );
  console.log(art, gruppen.size, 'Büschel');
  return mesh;
}

for (const art of new Set(lagen.map((o) => o.art))) {
  const mesh = await vorlage(art);
  for (const { matrix: m, name } of lagen.filter((o) => o.art === art)) {
    // Blender Z-aufwärts → glTF Y-aufwärts. Die Meshkoordinaten stammen bereits aus glTF.
    const matrix = [
      m[0][0],
      m[2][0],
      -m[1][0],
      0,
      m[0][2],
      m[2][2],
      -m[1][2],
      0,
      -m[0][1],
      -m[2][1],
      m[1][1],
      0,
      m[0][3],
      m[2][3],
      -m[1][3],
      1,
    ];
    szene.addChild(doc.createNode(name).setMesh(mesh).setMatrix(matrix));
  }
}
await doc.transform(
  instance({ min: 2 }),
  weld(),
  quantize({ quantizePosition: 14, quantizeTexcoord: 14 }),
  dedup(),
  prune(),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'QUANTIZE' });
await io.write(ausgabe, doc);
