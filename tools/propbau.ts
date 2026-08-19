/**
 * Kenney-Modelle in BRACHLAND-Props umbauen.
 *
 * Drei Dinge stimmten am bisherigen Bestand nicht, und alle drei sieht man:
 *
 *   1. **Keine Vertexfarben.** Die GLB tragen kein `COLOR_0`, gezeichnet werden sie
 *      aber mit `vertexColors: true`. Ein fehlendes Attribut liefert in WebGL den
 *      Vorgabewert (0,0,0) — die Büsche waren schwarz.
 *   2. **Kenneys Palette.** Gras `#73eddd` Minze, Rinde `#f2be9e` Pfirsich. Bunt und
 *      hübsch, aber quer zu einer Art Direction aus gedämpften Alpentönen. Wo das
 *      Material doch benutzt wurde (Findling, Totholz, Gras), stand Türkis im Bild.
 *   3. **Mehrere Primitive.** Ein Findling besteht aus Stein plus Gras plus Schnee.
 *      Die Szene nimmt das **erste** Mesh — der Rest fehlte.
 *
 * Dieses Werkzeug backt die Projektfarbe je Kenney-Materialrolle als Vertexfarbe
 * ein, verschmilzt alle Primitive zu einem, setzt das Modell auf reale Meter und
 * legt es unter `public/props` ab. Danach teilen sich alle Props **ein** Material,
 * und die Farbe ist nah und fern dieselbe.
 *
 * `npm run props:bau`
 */
import { Document, NodeIO, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, prune, weld } from '@gltf-transform/functions';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { VARIANTEN, KENNEY_FARBE, type PropArt } from '../src/world/props.js';

const QUELLE = '.cache/kenney/natur/Models/GLTF format';
const ZIEL = 'public/props';

if (!existsSync(QUELLE)) {
  console.error(`✗ ${QUELLE} fehlt.`);
  console.error('  Kenney Nature Kit (CC0) entpacken:');
  console.error('    curl -sSL -o .cache/kenney/nature-kit.zip \\');
  console.error('      https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip');
  console.error('    unzip -q .cache/kenney/nature-kit.zip -d .cache/kenney/natur');
  process.exit(1);
}
mkdirSync(ZIEL, { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** sRGB-Hex zu linearem Float — three.js rechnet Vertexfarben linear. */
function linear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const kanal = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [kanal((n >> 16) & 255), kanal((n >> 8) & 255), kanal(n & 255)];
}

const unbekannt = new Set<string>();

/** Farbe je Primitiv aus dem Materialnamen — die Rolle, nicht der Farbwert. */
function farbeFuer(prim: Primitive): [number, number, number] {
  const name = prim.getMaterial()?.getName() ?? '_defaultMat';
  const hex = KENNEY_FARBE[name];
  if (!hex) { unbekannt.add(name); return linear(KENNEY_FARBE._defaultMat); }
  return linear(hex);
}

/**
 * Alle Primitive eines Dokuments zu einem verschmelzen.
 *
 * Von Hand statt über `joinPrimitives`: Die Quellen haben unterschiedliche
 * Attributsätze (mal mit UV, mal ohne), und gebraucht werden am Ende nur Position
 * und Farbe. Alles andere fällt weg — das spart mehr als jede Kompression.
 */
function verschmelzen(doc: Document): { positionen: number[]; farben: number[] } {
  const positionen: number[] = [], farben: number[] = [];
  const p = [0, 0, 0];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const [r, g, b] = farbeFuer(prim);
      const idx = prim.getIndices();
      const anzahl = idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i < anzahl; i++) {
        pos.getElement(idx ? idx.getScalar(i) : i, p);
        positionen.push(p[0], p[1], p[2]);
        farben.push(r, g, b);
      }
    }
  }
  return { positionen, farben };
}

/**
 * Helligkeit über die Höhe des Modells — Bodenkontakt und Verlauf in einem.
 *
 * Kenney-Modelle tragen je Materialrolle **eine** flache Farbe. Gemessen hatten
 * 15 der 36 Modelle überhaupt keinen nennenswerten Helligkeitsunterschied in sich.
 * Das ist der Grund, warum ein Busch aussieht, als wäre er auf die Wiese geklebt:
 * Es fehlt der dunkle Fuß, den jeder Gegenstand hat, der auf etwas steht.
 *
 * Zwei Anteile, beide im Modell eingebacken und damit zur Laufzeit gratis:
 *
 *   - **Kontaktschatten** — die untersten 12 % der Höhe gehen auf 58 % Helligkeit
 *     hinunter. Bei einem 2,4-m-Busch sind das 29 cm, bei einem Grasbüschel 2 cm.
 *     Genau dort, wo in echt kein Licht hinkommt.
 *   - **Verlauf** — von 0,88 am Fuß auf 1,06 an der Spitze. Blätter oben bekommen
 *     mehr Himmel ab als Blätter unten, und ein Findling ist oben ausgebleicht.
 *
 * Preis: `weld()` zieht weniger Ecken zusammen, weil zwei Ecken mit gleicher
 * Position, aber verschiedener Höhenfarbe getrennt bleiben müssen. Das steht in
 * der KB-Spalte der Ausgabe.
 */
function schattierung(t: number): number {
  const kontakt = 0.58 + 0.42 * Math.min(1, t / 0.12);
  return (0.88 + 0.18 * t) * kontakt;
}

let gesamtKB = 0, gesamtTris = 0, gebaut = 0;
console.log('Props aus dem Kenney Nature Kit (CC0)\n');

for (const [art, varianten] of Object.entries(VARIANTEN) as [PropArt, typeof VARIANTEN[PropArt]][]) {
  if (!varianten.length) continue;
  console.log(`${art}`);
  for (const v of varianten) {
    const quelle = `${QUELLE}/${v.quelle}.glb`;
    if (!existsSync(quelle)) { console.log(`  ✗ ${v.quelle} fehlt im Kit`); continue; }

    const doc = await io.read(quelle);
    await doc.transform(flatten(), dedup());
    const { positionen, farben } = verschmelzen(doc);
    if (!positionen.length) { console.log(`  ✗ ${v.quelle} hat keine Geometrie`); continue; }

    // Auf reale Meter, Fuß auf y = 0, Mitte über dem Ursprung. Die Szene benutzt
    // die Geometrie danach unverändert — jede Normierung dort würde genau die
    // Höhenvielfalt wieder einebnen, für die diese Tabelle da ist.
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity,
        minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < positionen.length; i += 3) {
      minX = Math.min(minX, positionen[i]);     maxX = Math.max(maxX, positionen[i]);
      minY = Math.min(minY, positionen[i + 1]); maxY = Math.max(maxY, positionen[i + 1]);
      minZ = Math.min(minZ, positionen[i + 2]); maxZ = Math.max(maxZ, positionen[i + 2]);
    }
    const faktor = v.hoehe / Math.max(1e-6, maxY - minY);
    const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2;
    const spanne = Math.max(1e-6, maxY - minY);
    for (let i = 0; i < positionen.length; i += 3) {
      // Der Höhenanteil **vor** der Verschiebung — danach ist minY null.
      const t = (positionen[i + 1] - minY) / spanne;
      positionen[i]     = (positionen[i] - mx) * faktor;
      positionen[i + 1] = (positionen[i + 1] - minY) * faktor;
      positionen[i + 2] = (positionen[i + 2] - mz) * faktor;
      const s = schattierung(t);
      farben[i] *= s; farben[i + 1] *= s; farben[i + 2] *= s;
    }

    const raus = new Document();
    const puffer = raus.createBuffer();
    const prim = raus.createPrimitive()
      .setAttribute('POSITION', raus.createAccessor().setType('VEC3')
        .setArray(new Float32Array(positionen)).setBuffer(puffer))
      .setAttribute('COLOR_0', raus.createAccessor().setType('VEC3')
        .setArray(new Float32Array(farben)).setBuffer(puffer))
      .setMaterial(raus.createMaterial('prop')
        .setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0));
    const mesh = raus.createMesh(v.datei).addPrimitive(prim);
    raus.createScene().addChild(raus.createNode(v.datei).setMesh(mesh));
    // Schweißen zieht die doppelten Ecken wieder zusammen, die das Auflösen der
    // Indizes erzeugt hat. Die Farbe ist Teil des Vergleichs — zwei Ecken mit
    // gleicher Position, aber verschiedener Rolle bleiben getrennt, sonst
    // verschmierte der Übergang von Rinde zu Laub.
    await raus.transform(weld(), prune());

    const ziel = `${ZIEL}/${v.datei}.glb`;
    await io.write(ziel, raus);
    const kb = statSync(ziel).size / 1024;
    const tris = positionen.length / 9;
    gesamtKB += kb; gesamtTris += tris; gebaut++;
    console.log(`  ${v.datei.padEnd(18)} ${v.quelle.padEnd(24)} ${String(tris).padStart(4)} Tris`
      + ` · ${v.hoehe.toFixed(2).padStart(5)} m · ${kb.toFixed(1).padStart(5)} KB`);
  }
}

console.log(`\n${gebaut} Modelle · ${gesamtTris} Dreiecke · ${gesamtKB.toFixed(0)} KB gesamt`);
if (unbekannt.size)
  console.log(`\n⚠️  Materialrollen ohne Farbe in KENNEY_FARBE: ${[...unbekannt].join(', ')}`);
