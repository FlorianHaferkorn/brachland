/**
 * Wie einförmig steht der Bewuchs im Bild?
 *
 * Die erste Fassung inventarisierte nur Dateien — und tat das aus `assets/props`,
 * einem Ordner, den es seit dem Umbau auf `propbau.ts` gar nicht mehr gibt. Der
 * Check lief ins Leere, ohne es zu sagen.
 *
 * Die Frage, die er jetzt beantwortet, ist die, die man im Bild sieht: **Wie viele
 * Props sehen genau gleich aus?** Ein Busch mit 20 Dreiecken liest sich auf 30 m
 * Entfernung gut. Zweitausend Büsche in exakt demselben Grün nicht — Gleichfarbigkeit
 * ist der auffälligste Billig-Tell, und sie zu beheben kostet nichts.
 *
 * Gezählt wird deshalb nicht je Datei, sondern je **Erscheinung**: Geometrie mal
 * Farbe. Zwei Instanzen mit derselben Geometrie und derselben Farbe sind dieselbe
 * Erscheinung, egal wie sie gedreht und skaliert sind.
 *
 * `npm run props`
 */
import { readFileSync, statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { entpackeWelt } from '../src/world/osm.js';
import { baueTerrain } from '../src/world/terrain.js';
import { verteileProps, VARIANTEN, variantenZahl, propTon,
         type PropArt } from '../src/world/props.js';

const ORDNER = 'public/props';
const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

/** linear zurück nach sRGB-Hex — zum Lesen, nicht zum Rechnen. */
function hex(r: number, g: number, b: number): string {
  const k = (v: number) => {
    const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0');
  };
  return `#${k(r)}${k(g)}${k(b)}`;
}

interface Modell { tris: number; kb: number; hoehe: number; farben: number; spanne: number }

/** Ein Modell einlesen: Dreiecke, Höhe, und **wie viel Farbe** darin steckt. */
async function lies(datei: string): Promise<Modell> {
  const doc = await io.read(`${ORDNER}/${datei}.glb`);
  let tris = 0, minY = Infinity, maxY = -Infinity;
  const farben = new Set<string>();
  let hell = -Infinity, dunkel = Infinity;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const pos = p.getAttribute('POSITION')!;
      const col = p.getAttribute('COLOR_0');
      const idx = p.getIndices();
      tris += (idx ? idx.getCount() : pos.getCount()) / 3;
      const e = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, e);
        minY = Math.min(minY, e[1]); maxY = Math.max(maxY, e[1]);
      }
      if (!col) continue;
      for (let i = 0; i < col.getCount(); i++) {
        col.getElement(i, e);
        farben.add(hex(e[0], e[1], e[2]));
        const l = 0.2126 * e[0] + 0.7152 * e[1] + 0.0722 * e[2];
        hell = Math.max(hell, l); dunkel = Math.min(dunkel, l);
      }
    }
  return {
    tris, kb: statSync(`${ORDNER}/${datei}.glb`).size / 1024, hoehe: maxY - minY,
    farben: farben.size,
    // Helligkeitsspanne im Modell, **relativ**: um wie viel dunkler die dunkelste
    // Stelle gegenüber der hellsten ist. Null heißt eine flache Farbe — kein Verlauf
    // von der Wurzel zur Spitze und kein dunkler Fuß, der den Bodenkontakt zeigt.
    // Absolut gemessen wäre die Zahl unlesbar: Bei einem Laubgrün mit Luminanz 0,08
    // ist ein voller Verlauf auf die halbe Helligkeit gerade einmal 0,04.
    spanne: farben.size && hell > 0 ? 1 - dunkel / hell : 0,
  };
}

// --------------------------------------------------------------- Modelltabelle
console.log('Prop-Modelle\n');
console.log(`  ${'Datei'.padEnd(20)} ${'Tris'.padStart(5)} ${'KB'.padStart(6)} ${'Höhe'.padStart(6)}`
  + ` ${'Farben'.padStart(7)} ${'Hell-Spanne'.padStart(12)}`);
console.log('  ' + '-'.repeat(62));

const modelle = new Map<string, Modell>();
let gesamtTris = 0, gesamtKB = 0, flach = 0;
for (const liste of Object.values(VARIANTEN)) {
  if (!liste.length) continue;
  for (const v of liste) {
    const m = await lies(v.datei);
    modelle.set(v.datei, m);
    gesamtTris += m.tris; gesamtKB += m.kb;
    if (m.spanne < 0.15) flach++;
    console.log(`  ${v.datei.padEnd(20)} ${String(Math.round(m.tris)).padStart(5)}`
      + ` ${m.kb.toFixed(1).padStart(6)} ${m.hoehe.toFixed(2).padStart(6)} m`
      + ` ${String(m.farben).padStart(5)} ${m.spanne.toFixed(3).padStart(12)}`);
  }
}
console.log(`\n  ${modelle.size} Modelle · ${Math.round(gesamtTris).toLocaleString('de')} Dreiecke`
  + ` · ${gesamtKB.toFixed(0)} KB · ${flach} ohne nennenswerten Helligkeitsverlauf`);
console.log('  Lizenz: CC0 (Kenney Nature Kit 2.1) — keine Namensnennung nötig, aber fair.');

// ------------------------------------------------------- Erscheinungen im Bild
//
// Jetzt die eigentliche Frage: Wie viele der 167.823 Props in der echten Region
// sehen genau gleich aus? Geometrie kommt aus (art, variante), Farbe aus `propTon`
// — solange die Tönung 1,0 liefert, ist die Farbe je Geometrie eine einzige.
const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const props = verteileProps(welt, baueTerrain(welt), 1);

/** Farbe auf drei Stellen — feiner unterscheidet das Auge im Feld ohnehin nicht. */
const tonSchluessel = (p: { art: PropArt; variante: number; drehung: number }) => {
  const t = propTon(p.art, p.variante, p.drehung);
  return `${t[0].toFixed(2)}/${t[1].toFixed(2)}/${t[2].toFixed(2)}`;
};

const jeArt = new Map<PropArt, { anzahl: number; ohne: Map<number, number>;
                                 mit: Map<string, number> }>();
for (const p of props) {
  let e = jeArt.get(p.art);
  if (!e) { e = { anzahl: 0, ohne: new Map(), mit: new Map() }; jeArt.set(p.art, e); }
  e.anzahl++;
  // Ohne Tönung ist die Erscheinung allein die Form — genau der Zustand vor D79.
  e.ohne.set(p.variante, (e.ohne.get(p.variante) ?? 0) + 1);
  const k = `${p.variante}|${tonSchluessel(p)}`;
  e.mit.set(k, (e.mit.get(k) ?? 0) + 1);
}

console.log(`\nErscheinungen in der Region — ${props.length.toLocaleString('de')} Props`);
console.log('\n  Eine Erscheinung ist Form × Farbe. Zwei Instanzen mit derselben');
console.log('  Erscheinung sind im Bild derselbe Gegenstand, egal wie gedreht.\n');
console.log(`  ${'Art'.padEnd(13)} ${'Instanzen'.padStart(10)} ${'Formen'.padStart(7)}`
  + `   ${'Erscheinungen'.padStart(21)}   ${'größte gleiche Gruppe'.padStart(23)}`);
console.log(`  ${''.padEnd(13)} ${''.padStart(10)} ${''.padStart(7)}`
  + `   ${'ohne Ton'.padStart(10)} ${'mit Ton'.padStart(10)}`
  + `   ${'ohne Ton'.padStart(11)} ${'mit Ton'.padStart(11)}`);
console.log('  ' + '-'.repeat(88));
let groesste = 0, groessteArt = '', groessteAlt = 0;
for (const [art, e] of [...jeArt].sort((a, b) => b[1].anzahl - a[1].anzahl)) {
  const alt = Math.max(...e.ohne.values()), neu = Math.max(...e.mit.values());
  if (alt > groessteAlt) { groessteAlt = alt; groessteArt = art; groesste = neu; }
  console.log(`  ${art.padEnd(13)} ${e.anzahl.toLocaleString('de').padStart(10)}`
    + ` ${String(variantenZahl(art)).padStart(7)}`
    + `   ${String(e.ohne.size).padStart(10)} ${e.mit.size.toLocaleString('de').padStart(10)}`
    + `   ${alt.toLocaleString('de').padStart(11)} ${neu.toLocaleString('de').padStart(11)}`);
}
console.log(`\n  Größte visuell identische Gruppe: ${groessteAlt.toLocaleString('de')}`
  + ` → ${groesste.toLocaleString('de')} × ${groessteArt}`);
