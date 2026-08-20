#!/usr/bin/env node
/**
 * BRACHLAND — Kreatur-Reduktionspipeline
 * KI-generiertes GLB (Tripo/Hunyuan3D) -> spieltaugliches Low-Poly-GLB fuer die Offline-PWA
 *
 * Aufruf: node reduce.mjs <input.glb> <output.glb> [zielTris]
 */
import { NodeIO } from '@gltf-transform/core';
// ALL_EXTENSIONS statt KHRONOS_EXTENSIONS: `EXT_texture_webp` steht nicht in der
// Khronos-Liste. Mit der kleineren Liste hat der Writer die Wandlung unten still
// verworfen ("Some extensions were not registered for I/O") — die Textur blieb
// PNG, und der Lauf sah trotzdem grün aus.
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, prune, weld, simplify, resample,
  flatten, join, quantize
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [,, INPUT, OUTPUT, TARGET = '4000'] = process.argv;
if (!INPUT || !OUTPUT) { console.error('Aufruf: node reduce.mjs <in.glb> <out.glb> [zielTris]'); process.exit(1); }
const targetTris = parseInt(TARGET, 10);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(INPUT);

const stats = (d) => {
  let tris = 0, verts = 0;
  d.getRoot().listMeshes().forEach(m => m.listPrimitives().forEach(p => {
    const idx = p.getIndices();
    tris += idx ? idx.getCount() / 3 : p.getAttribute('POSITION').getCount() / 3;
    verts += p.getAttribute('POSITION').getCount();
  }));
  return { tris: Math.round(tris), verts,
           tex: d.getRoot().listTextures().length,
           anims: d.getRoot().listAnimations().length };
};

/**
 * Geometrie und Textur **getrennt** ausweisen.
 *
 * Vorher stand hier nur die Dateigroesse, und die meldete am Fuchs
 * „6.76 MB -> 6.58 MB (Faktor 1.0x)". Das liest sich, als sei nichts passiert.
 * In Wahrheit war die Geometrie um den Faktor 56 geschrumpft und die Textur um
 * den Faktor 8 gewachsen — zwei grosse, gegenlaeufige Bewegungen, die sich in
 * der Summe fast aufhoben. Eine Kennzahl, die zwei Dinge addiert, kann nicht
 * zeigen, dass eines davon kaputt ist.
 */
const gewicht = d => {
  let geo = 0, tex = 0;
  for (const m of d.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      geo += p.getIndices()?.getArray().byteLength ?? 0;
      for (const s of p.listSemantics()) geo += p.getAttribute(s).getArray().byteLength;
    }
  for (const t of d.getRoot().listTextures()) tex += t.getImage()?.byteLength ?? 0;
  return { geo, tex };
};

/** Was die Texturpackung getan hat — wandert unten in die Ausgabe. */
const texturNotiz = [];

/**
 * Textur packen — **gemessen statt gesetzt**.
 *
 * Hier stand `textureCompress({ lossless: true })`, wortgleich aus
 * `nachbereiten.mjs` uebernommen. Dort ist es richtig und sauber belegt: Die
 * Grathorn-Textur kommt aus Blender als PNG, traegt eine Handvoll Volltoene
 * (Entropie 1,76), und verlustfreies WebP schlaegt jede verlustbehaftete
 * Variante — 17,0 gegen 37,4 KB.
 *
 * Hier ist es falsch, und zwar teuer. `reduce.mjs` steht am **Anfang** der Kette
 * und bekommt die KI-Ausgabe: Tripo liefert **JPEG**, fotografisch, hohe
 * Entropie. Verlustfreies WebP muss dann jedes JPEG-Artefakt bitgenau
 * mitnehmen. Gemessen am Fuchs: **0,79 MB → 6,45 MB**, eine einzelne Basisfarbe
 * von 375 auf 2.764 KB. Die Datei landete bei 6.580 KB gegen 120 KB Budget, und
 * die Ausgabe des Werkzeugs meldete dazu „Faktor 1.0x" — was sich liest, als
 * waere nichts passiert, und in Wahrheit hiess: Geometrie 56x kleiner, Texturen
 * 8x groesser.
 *
 * Der Fehler war nicht die Zahl, sondern dass eine an **einem** Eingabeformat
 * gemessene Entscheidung unbesehen auf ein anderes uebertragen wurde. Deshalb
 * raet dieser Schritt jetzt nicht mehr, sondern **rechnet beide Varianten und
 * nimmt die kleinere**. Bei flaechigem Material gewinnt verlustfrei von selbst,
 * bei fotografischem die verlustbehaftete — ohne dass irgendwo eine Annahme
 * ueber die Herkunft der Datei steht.
 *
 * Verkleinert wird bewusst **nicht** automatisch: Bei der Grathorn-Textur machte
 * 512 die Datei groesser statt kleiner, und ob eine Textur an Aufloesung
 * verlieren darf, ist eine Frage der Art Direction und keine der Bytes.
 */
async function packeTexturen(d) {
  for (const t of d.getRoot().listTextures()) {
    const roh = t.getImage();
    if (!roh) continue;
    // `effort: 6` ist sharps eigene Skala (0…6). `textureCompress` skaliert von
    // 0…100 herunter, weshalb dort 100 steht und hier 6 — dieselbe Einstellung.
    const [frei, lossy] = await Promise.all([
      sharp(roh).webp({ lossless: true, effort: 6 }).toBuffer(),
      sharp(roh).webp({ quality: 90, effort: 6 }).toBuffer(),
    ]);
    const besser = frei.byteLength <= lossy.byteLength ? frei : lossy;
    texturNotiz.push(`${t.getName() || 'Textur'}: ${(roh.byteLength/1024).toFixed(0)}`
      + ` → ${(besser.byteLength/1024).toFixed(0)} KB`
      + ` (${frei.byteLength <= lossy.byteLength ? 'verlustfrei' : 'q90'})`);
    t.setImage(besser).setMimeType('image/webp');
  }
}

const before = stats(doc);
const vorher = gewicht(doc);
await MeshoptSimplifier.ready;

// Geriggte Modelle: flatten/join zerstoeren Skins -> nur bei statischen Meshes anwenden
const isRigged = doc.getRoot().listSkins().length > 0 || before.anims > 0;
if (isRigged) console.log('  [Info] Rig/Animation erkannt -> schonender Modus (kein flatten/join)');

// Zielverhaeltnis aus Ist-Stand ableiten
const ratio = Math.min(1, targetTris / Math.max(1, before.tris));

await doc.transform(
  dedup(),                                    // doppelte Accessors/Meshes zusammenfassen
  ...(isRigged ? [] : [flatten(), join()]),   // nur bei statischen Meshes sicher
  weld({ tolerance: 0.0001 }),                // Vertices verschweissen (Pflicht vor simplify)
  simplify({ simplifier: MeshoptSimplifier,   // Quadric Edge Collapse
             ratio, error: 0.005, lockBorder: false }),
  // Greift hier nur, wenn das Rohmodell schon Animationen mitbringt. Die des
  // Spiels entstehen erst in autorig.py — die duennt `nachbereiten.mjs` aus.
  resample(),
  prune({ keepAttributes: isRigged,           // JOINTS/WEIGHTS nicht wegwerfen
          keepLeaves: isRigged }),            // Knochen-Nodes ohne Mesh erhalten
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12,
             quantizeWeight: 8, quantizeGeneric: 12 })
);

await packeTexturen(doc);

await io.write(OUTPUT, doc);
const after = stats(doc);
const skinsAfter = doc.getRoot().listSkins().length;

const { statSync } = await import('node:fs');
const mb = f => (statSync(f).size / 1024 / 1024);

const nachher = gewicht(doc);
const kb = b => (b / 1024).toFixed(0);

console.log(`
  Flaechen    ${before.tris.toLocaleString('de')}  ->  ${after.tris.toLocaleString('de')}   (${(100*after.tris/before.tris).toFixed(1)} %)
  Vertices    ${before.verts.toLocaleString('de')}  ->  ${after.verts.toLocaleString('de')}
  Texturen    ${before.tex}  ->  ${after.tex}
  Animationen ${before.anims}  ->  ${after.anims}
  Skins/Rigs  ${skinsAfter}  (erhalten: ${!isRigged || skinsAfter > 0 ? 'ja' : 'NEIN'})

  Geometrie   ${kb(vorher.geo).padStart(6)} KB  ->  ${kb(nachher.geo).padStart(6)} KB
  Textur      ${kb(vorher.tex).padStart(6)} KB  ->  ${kb(nachher.tex).padStart(6)} KB${texturNotiz.length ? '\n' + texturNotiz.map(z => `                ${z}`).join('\n') : ''}
  Datei        ${mb(INPUT).toFixed(2)} MB  ->  ${mb(OUTPUT).toFixed(2)} MB   (Faktor ${(mb(INPUT)/mb(OUTPUT)).toFixed(1)}x)
`);
