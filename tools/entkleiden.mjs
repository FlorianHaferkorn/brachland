#!/usr/bin/env node
/**
 * BRACHLAND — Kreatur entkleiden: Textur raus, Farbe als Vertexattribut rein
 *
 * ## Warum es diesen Schritt gibt
 *
 * Die Asset-Kette wurde fuer **texturierte** Kreaturmodelle gebaut. Die Art
 * Direction, die sich seither herausgebildet hat, ist **untexturiert**: Seit D74
 * tragen alle 36 Props ihre Farbe als `COLOR_0`, teilen sich ein Material und
 * werden flach schattiert; EZ-Tree wurde 2026-08-16 verworfen, weil seine 4 MB
 * eingebettete Rinden- und Blatttexturen „genau das sind, was diese Art
 * Direction nicht benutzt" (G-33). Eine texturierte Kreatur waere der einzige
 * texturierte Gegenstand im ganzen Spiel.
 *
 * Dazu kommt das Budget. `quality.ts` laesst 120 KB je Kreatur zu. Gemessen am
 * Fuchs, jeweils bei 4.464 Flaechen:
 *
 *   mit Textur, verlustfreies WebP   6.733 KB   ← was die Kette vor heute lieferte
 *   mit Textur, q90                    900 KB
 *   mit Textur, q80 auf 512 px         221 KB
 *   **ohne Textur, Farbe je Vertex      90 KB**  ← das hier
 *
 * Nur die letzte Variante haelt das Budget, und sie ist zugleich die einzige,
 * die dieselbe Sprache spricht wie der Rest der Welt.
 *
 * ## Warum **nach** dem Rigging
 *
 * Aus demselben Grund, aus dem `nachbereiten.mjs` nach dem Rigging laeuft:
 * Blender schreibt die Datei in `autorig.py` vollstaendig neu. Ein `COLOR_0`,
 * das davor entstuende, muesste den Import und den Export unbeschadet
 * ueberstehen — das haengt an Materialknoten und Exporteinstellungen und ist
 * genau die Art stiller Abhaengigkeit, die schon zweimal Stunden gekostet hat.
 * Nach dem Rigging sind Textur und UV noch da, und danach braucht sie niemand
 * mehr.
 *
 * Aufruf: node entkleiden.mjs <in.glb> [out.glb]
 * Ohne `out` wird die Datei an Ort und Stelle ersetzt.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import { statSync, renameSync, openSync, readSync, closeSync } from 'node:fs';
import sharp from 'sharp';

const [, , INPUT, OUTPUT] = process.argv;
if (!INPUT) { console.error('Aufruf: node entkleiden.mjs <in.glb> [out.glb]'); process.exit(1); }

// Die Endung muss `.glb` bleiben — `NodeIO.write()` entscheidet an ihr, ob ein
// Container oder ein JSON-plus-Beidateien-Satz entsteht. Ein `.tmp` hat hier
// schon einmal eine unvollstaendige Datei erzeugt, die das Tor gruen passierte,
// weil sie kleiner war (siehe nachbereiten.mjs).
const ziel = OUTPUT ?? INPUT.replace(/\.glb$/, '.entkleidet.glb');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(INPUT);
const wurzel = doc.getRoot();
const vorherBytes = statSync(INPUT).size;

/** sRGB-Byte zu linearem Float — three.js rechnet Vertexfarben linear. */
const linear = v => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** Ein dekodiertes Bild, damit dieselbe Textur nicht mehrfach entpackt wird. */
const bildCache = new Map();
async function entpacke(tex) {
  const roh = tex?.getImage();
  if (!roh) return null;
  if (bildCache.has(tex)) return bildCache.get(tex);
  const { data, info } = await sharp(Buffer.from(roh)).raw().toBuffer({ resolveWithObject: true });
  const b = { data, w: info.width, h: info.height, k: info.channels };
  bildCache.set(tex, b);
  return b;
}

/**
 * Farbe an einer UV-Koordinate, gemittelt ueber ein kleines Fenster.
 *
 * **Nicht** der naechste Texel: Nach der Reduktion tragen rund 5.000 Vertices
 * eine 1024er-Textur, jeder von ihnen steht also fuer hunderte Texel. Ein
 * einzelner Griff traefe dann mit voller Wucht jedes JPEG-Artefakt und jeden
 * Ausreisser — bei fotografischem Quellmaterial genau die Sprenkel, die man
 * hinterher als Rauschen im Fell sieht. Fuenf mal fuenf ist billig und genuegt.
 */
function farbeAn(bild, u, v) {
  const F = 2;                                  // Fensterradius in Texeln
  const px = Math.round(u * (bild.w - 1));
  const py = Math.round(v * (bild.h - 1));
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -F; dy <= F; dy++)
    for (let dx = -F; dx <= F; dx++) {
      const x = Math.min(bild.w - 1, Math.max(0, px + dx));
      const y = Math.min(bild.h - 1, Math.max(0, py + dy));
      const o = (y * bild.w + x) * bild.k;
      r += bild.data[o]; g += bild.data[o + 1]; b += bild.data[o + 2]; n++;
    }
  return [linear(r / n), linear(g / n), linear(b / n)];
}

let vertices = 0, ohneTextur = 0;
for (const mesh of wurzel.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const uv = prim.getAttribute('TEXCOORD_0');
    const mat = prim.getMaterial();
    const bild = await entpacke(mat?.getBaseColorTexture());
    const farben = new Float32Array(pos.getCount() * 3);

    if (bild && uv) {
      const e = [0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        uv.getElement(i, e);
        // UV laeuft in glTF von oben nach unten, das Rohbild ebenfalls — kein
        // Umdrehen noetig, aber Wiederholung ausserhalb 0…1 abfangen.
        const [r, g, b] = farbeAn(bild, e[0] - Math.floor(e[0]), e[1] - Math.floor(e[1]));
        farben[i * 3] = r; farben[i * 3 + 1] = g; farben[i * 3 + 2] = b;
      }
    } else {
      // Ohne Textur bleibt der Grundfarbfaktor — besser als Schwarz. Ein
      // fehlendes COLOR_0 bei `vertexColors: true` liefert in WebGL (0,0,0),
      // und genau daran waren 22.638 Buesche unsichtbar schwarz (G-76).
      const f = mat?.getBaseColorFactor() ?? [1, 1, 1, 1];
      for (let i = 0; i < pos.getCount(); i++) {
        farben[i * 3] = f[0]; farben[i * 3 + 1] = f[1]; farben[i * 3 + 2] = f[2];
      }
      ohneTextur++;
    }
    vertices += pos.getCount();

    prim.setAttribute('COLOR_0', doc.createAccessor()
      .setType('VEC3').setArray(farben).setBuffer(wurzel.listBuffers()[0]));
    // UV und Normalen fallen weg. Die Normalen, weil die Szene ueberall
    // `flatShading` benutzt und sie dann im Fragment-Shader aus der Ableitung
    // der Position entstehen — dasselbe, was `propbau.ts` fuer die Props tut.
    prim.setAttribute('TEXCOORD_0', null);
    prim.setAttribute('TEXCOORD_1', null);
    prim.setAttribute('NORMAL', null);
    prim.setAttribute('TANGENT', null);
  }
}

// Texturen loesen und die Materialien auf die Sprache des Spiels stellen:
// weisser Grundfarbfaktor, rau, unmetallisch — die Farbe kommt jetzt aus dem
// Vertexattribut, genau wie bei jedem Prop.
const texturen = wurzel.listTextures().length;
let texturBytes = 0;
for (const t of wurzel.listTextures()) { texturBytes += t.getImage()?.byteLength ?? 0; t.dispose(); }
for (const m of wurzel.listMaterials()) {
  m.setBaseColorTexture(null).setNormalTexture(null).setEmissiveTexture(null)
   .setOcclusionTexture(null).setMetallicRoughnessTexture(null)
   .setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0);
}

// `keepAttributes`, weil JOINTS und WEIGHTS eines geriggten Modells fuer den
// Pruner wie ungenutzte Attribute aussehen; `keepLeaves`, weil Knochen ohne
// eigenes Mesh wie leere Blaetter aussehen. Beides wegzuwerfen bricht den Skin.
const geriggt = wurzel.listSkins().length > 0;
await doc.transform(dedup(), prune({ keepAttributes: geriggt, keepLeaves: geriggt }));

await io.write(ziel, doc);

// Magic-Pruefung wie in nachbereiten.mjs: Eine unvollstaendige Datei ist kleiner
// als eine gute und sieht in jeder Groessenmessung nach Erfolg aus.
const fd = openSync(ziel, 'r');
const magic = Buffer.alloc(4);
readSync(fd, magic, 0, 4, 0);
closeSync(fd);
if (magic.toString('latin1') !== 'glTF') {
  console.error(`  ✗ ${ziel} ist kein GLB (Magic '${magic.toString('latin1')}') — abgebrochen`);
  process.exit(1);
}
if (!OUTPUT) renameSync(ziel, INPUT);

const nachherBytes = statSync(OUTPUT ?? INPUT).size;
const kb = b => (b / 1024).toFixed(0);
console.log(`  ${INPUT.split('/').pop().padEnd(32)} `
  + `${kb(vorherBytes).padStart(5)} → ${kb(nachherBytes).padStart(4)} KB`
  + `   ${texturen} Texturen (${kb(texturBytes)} KB) → Farbe an ${vertices.toLocaleString('de')} Vertices`
  + (ohneTextur ? `   ⚠️  ${ohneTextur} Primitive ohne Basisfarbtextur — Grundfarbfaktor genommen` : ''));
