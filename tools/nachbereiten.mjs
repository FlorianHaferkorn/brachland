#!/usr/bin/env node
/**
 * BRACHLAND — Nachbereitung geriggter Kreatur-GLB
 *
 * ## Warum es diesen Schritt gibt
 *
 * `reduce.mjs` quantisiert, dünnt Animationskeys aus und wandelt Texturen — und
 * **nichts davon war in den Auslieferungsdateien zu sehen.** Die sechs
 * Grathorn-GLB standen bei 163–167 KB gegen 120 KB Budget (Ledger A-6), und der
 * Grund war keine zu schwache Kompression, sondern die **Reihenfolge**:
 *
 *   raw.glb → reduce.mjs (quantisiert, resampled) → autorig.py → final.glb
 *                                                    ^^^^^^^^^^
 *
 * Blender schreibt die Datei am Ende neu. Dabei geht die Quantisierung verloren
 * (Export als f32), die Textur kommt als PNG zurück — und die Animationen, die
 * `autorig.py` überhaupt erst anlegt, hat `resample()` nie gesehen, weil es lief,
 * bevor es sie gab. Gemessen an `Grathorn_v2_S3.glb`: „Survey" trug 1.743
 * Keyframes auf 3 Sekunden, also **581 Keys je Sekunde** für einen Zyklus, der
 * mit einer Handvoll auskommt.
 *
 * Deshalb dieser Schritt: derselbe Werkzeugkasten, aber **nach** dem Rigging.
 * Geometrie wird hier nicht mehr angefasst — `simplify` würde die Skin-Gewichte
 * ein zweites Mal verschieben, und die Flächenzahl stimmt bereits.
 *
 * Aufruf: node nachbereiten.mjs <in.glb> [out.glb]
 * Ohne `out` wird die Datei an Ort und Stelle ersetzt.
 */
import { NodeIO } from '@gltf-transform/core';
// ALL_EXTENSIONS, nicht KHRONOS_EXTENSIONS: `EXT_texture_webp` ist ein EXT und
// steht nicht in der Khronos-Liste. Mit der kleineren Liste meldet der Writer
// „Some extensions were not registered for I/O" — als Hinweis, nicht als Fehler —
// und schreibt die Datei ohne die Wandlung. Genau das ist `reduce.mjs` passiert:
// Die Textur blieb PNG, und niemand hat es gemerkt, weil der Lauf grün aussah.
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, quantize, textureCompress } from '@gltf-transform/functions';
import { statSync, renameSync, readSync, openSync, closeSync } from 'node:fs';
import sharp from 'sharp';

const [, , INPUT, OUTPUT] = process.argv;
if (!INPUT) { console.error('Aufruf: node nachbereiten.mjs <in.glb> [out.glb]'); process.exit(1); }

/**
 * Zwischendatei — die Endung muss `.glb` bleiben.
 *
 * Hier stand einmal `${INPUT}.tmp`, und das hat den bisher unangenehmsten Fehler
 * dieser Runde erzeugt: `NodeIO.write()` entscheidet **an der Dateiendung**, ob
 * es GLB (ein Container) oder glTF (JSON plus `.bin` plus Bilddateien daneben)
 * schreibt. Bei `.tmp` fiel es auf glTF zurück, das Umbenennen machte daraus
 * scheinbar wieder ein `.glb` — und `npm run quality` meldete **0 Blocker**,
 * weil die Datei von 163 KB auf 39 KB gefallen war. Sie war nicht kleiner, sie
 * war nur unvollständig; die Nutzdaten lagen als `.bin` daneben.
 *
 * Ein grünes Tor für eine kaputte Datei ist schlimmer als ein rotes für eine
 * gute. Deshalb unten zusätzlich die Magic-Prüfung.
 */
const ziel = OUTPUT ?? INPUT.replace(/\.glb$/, '.nachbereitet.glb');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(INPUT);

const zaehleKeys = d => d.getRoot().listAnimations()
  .flatMap(a => a.listSamplers())
  .reduce((n, s) => n + (s.getInput()?.getCount() ?? 0), 0);

const vorher = { bytes: statSync(INPUT).size, keys: zaehleKeys(doc) };

await doc.transform(
  dedup(),
  // Der eigentliche Hebel. Entfernt Keyframes, die sich aus ihren Nachbarn
  // ergeben — bei gebackenen Blender-Aktionen ist das die große Mehrheit.
  resample(),
  // `keepAttributes`/`keepLeaves`, weil das Modell geriggt ist: JOINTS und
  // WEIGHTS sehen für den Pruner wie ungenutzte Attribute aus, und Knochen ohne
  // eigenes Mesh wie leere Blätter. Beides wegzuwerfen bricht den Skin.
  prune({ keepAttributes: true, keepLeaves: true }),
  /**
   * Textur — und zwar **verlustfrei** und in **voller Auflösung**. Beides
   * gegen die Intuition, beides gemessen an der Grathorn-Textur (1024², drei
   * Kanäle, Entropie 1,76 — also im Kern eine Handvoll Flächen):
   *
   *   PNG 1024, wie geliefert     26,1 KB
   *   webp verlustbehaftet q85    37,4 KB   ← 43 % GRÖSSER
   *   PNG 1024 mit Palette        19,5 KB
   *   **webp verlustfrei 1024     17,0 KB** ← genommen
   *   PNG 512                     27,3 KB   ← größer als 1024
   *   webp verlustfrei 512        40,7 KB   ← mehr als doppelt so groß
   *
   * Die beiden naheliegenden Griffe — „lossy" und „kleiner rechnen" — machen die
   * Datei also beide **größer**. Der Grund ist derselbe: Eine Fläche aus wenigen
   * Volltönen komprimiert sich über Wiederholung, und sowohl DCT-Quantisierung
   * als auch das Interpolieren beim Verkleinern zerlegen genau diese Wiederholung
   * in Zwischentöne. `reduce.mjs` stand auf `quality: 85` — hätte das je gegriffen
   * (siehe ALL_EXTENSIONS oben), wäre die Datei dadurch gewachsen.
   *
   * EXT_texture_webp liest der GLTFLoader von three.js von Haus aus.
   *
   * `effort: 100` und nicht `6`: `textureCompress` skaliert den Wert intern von
   * 0…100 auf die 0…6 von sharp. Eine 6 landet dort als 0 — also der schwächste
   * Anlauf statt des stärksten. Kostet ~8 KB je Datei und sieht in keinem Log auf.
   */
  textureCompress({ encoder: sharp, targetFormat: 'webp', lossless: true, effort: 100 }),
  // KHR_mesh_quantization — three.js liest das im GLTFLoader von Haus aus.
  // 14 Bit auf die Position sind bei einer Kreatur von 1 m rund 0,06 mm.
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12,
             quantizeWeight: 8, quantizeGeneric: 12 }),
);

await io.write(ziel, doc);

/**
 * Ist das Ergebnis wirklich ein GLB? Die ersten vier Bytes sagen es: `glTF`.
 *
 * Diese Zeile ist die Lehre aus dem `.tmp`-Fehler oben. Eine Größenmessung
 * allein kann eine unvollständige Datei nicht von einer gut komprimierten
 * unterscheiden — sie sieht in beiden Fällen nach Erfolg aus.
 */
const fd = openSync(ziel, 'r');
const magic = Buffer.alloc(4);
readSync(fd, magic, 0, 4, 0);
closeSync(fd);
if (magic.toString('latin1') !== 'glTF') {
  console.error(`  ✗ ${ziel} ist kein GLB (Magic '${magic.toString('latin1')}') — abgebrochen, Eingabe bleibt unangetastet`);
  process.exit(1);
}

if (!OUTPUT) renameSync(ziel, INPUT);

const nachher = { bytes: statSync(OUTPUT ?? INPUT).size, keys: zaehleKeys(doc) };
const kb = b => (b / 1024).toFixed(0);
console.log(`  ${INPUT.split('/').pop().padEnd(32)} `
  + `${kb(vorher.bytes).padStart(4)} → ${kb(nachher.bytes).padStart(4)} KB`
  + `   Keys ${String(vorher.keys).padStart(5)} → ${String(nachher.keys).padStart(4)}`);
