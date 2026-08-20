/** Vollständige Szene headless bauen: Dreiecke, Props, Draw Calls, Budget. */
import { entpackeWelt } from '../src/world/osm.js';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { baueTerrain, baueGebaeude } from '../src/world/terrain.js';
import { baueHoehenfeld, baueKachelraster, lodFuerAbstand, aufsatzboden } from '../src/world/lod.js';
import { zerlegeBaender, baueBaenderStufe, baueWegKachel, baueWasserKachel,
         baueFallKachel, baueGartenKachel } from '../src/world/baender.js';
import { TERRAIN_SICHT } from '../src/scenes/sichtweiten.js';
import { verteileProps, propGeometrie, attrappeGeometrie, zaehleProps, chunkeProps,
         PROP_FARBE, VARIANTEN, variantenZahl, type PropArt } from '../src/world/props.js';
import * as THREE from 'three';
import { baueBaum } from '../src/world/baum.js';
import { ATTRAPPE_AB, MITTEL_AB } from '../src/scenes/sichtweiten.js';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';

/**
 * Dreiecke einer Prop-Erscheinung — **so, wie die Szene sie zeichnet**.
 *
 * Zwei Fehler steckten hier vorher drin, und beide gingen in dieselbe Richtung wie
 * G-73: gemessen wurde ein Pfad, den das Spiel nicht benutzt.
 *
 *   1. **`MITTEL_AB` fehlte.** Gezählt wurde nur nah gegen Attrappe, die Szene hat
 *      aber drei Stufen: bis 45 m das volle Modell, bis 110 m die Mittelstufe, dann
 *      das Primitiv. Bei der Fichte sind das 2.152 gegen 174 Dreiecke — jeder Baum
 *      zwischen 45 und 110 m wurde zwölffach zu teuer berechnet.
 *   2. **Nicht-Bäume kamen aus `propGeometrie`**, dem Rückfall-Primitiv, nicht aus
 *      der GLB. Ein Busch stand mit 20 Dreiecken in der Rechnung; die sechs echten
 *      Modelle haben 16 bis 104, je nach Variante — und die Variante stand im Chunk.
 *
 * Beide Fehler heben sich nicht auf: Der erste überschätzt Bäume grob, der zweite
 * unterschätzt alles andere. Wer auf dieser Grundlage über Baumdetails entscheidet,
 * entscheidet über eine Rechnung.
 */
const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const glbTris = new Map<string, number>();
for (const liste of Object.values(VARIANTEN))
  for (const v of liste) {
    const doc = await io.read(`public/props/${v.datei}.glb`);
    let n = 0;
    for (const m of doc.getRoot().listMeshes())
      for (const p of m.listPrimitives()) {
        const idx = p.getIndices();
        n += (idx ? idx.getCount() : p.getAttribute('POSITION')!.getCount()) / 3;
      }
    glbTris.set(v.datei, n);
  }

const baumCache = new Map<string, number>();
const zaehle = (g: THREE.BufferGeometry) =>
  g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;

/** `nah` = volles Modell, `mittel` = vereinfachtes, `fern` = Primitiv. */
function propTrisFuer(art: PropArt, variante: number, stufe: 'nah' | 'mittel' | 'fern'): number {
  if (stufe === 'fern') return zaehle(attrappeGeometrie(art));
  if (art === 'nadelbaum' || art === 'laubbaum') {
    const eigen = art === 'nadelbaum' ? 'fichte' : 'buche';
    const k = `${eigen}:${variante}:${stufe}`;
    let n = baumCache.get(k);
    if (n === undefined) {
      n = zaehle(baueBaum(eigen, variante, stufe === 'nah' ? 'voll' : 'mittel'));
      baumCache.set(k, n);
    }
    return n;
  }
  // GLB-Props haben keine Mittelstufe — `useNormiertesPropMesh` wertet `stufe` nur
  // für Bäume aus. Zwischen 45 und 110 m steht also weiter das volle Modell.
  const datei = (VARIANTEN[art][variante] ?? VARIANTEN[art][0])?.datei;
  return datei ? glbTris.get(datei) ?? zaehle(propGeometrie(art)) : zaehle(propGeometrie(art));
}

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const t = baueTerrain(welt);
// Dieselbe Hoehenquelle wie die Szene (G-73).
const feld = baueHoehenfeld(welt);
const boden = aufsatzboden(feld);
const satz = zerlegeBaender(welt, feld);
const kacheln = baueKachelraster(feld);
const tri = (g: any) => g ? g.getAttribute('position').count / 3 : 0;

// Bänder liegen seit D73 je Kachel auf ihrer eigenen LOD-Stufe. Die Zahl hier ist
// die Obergrenze: alles auf LOD0, als stünde man überall gleichzeitig. Was wirklich
// gezeichnet wird, steht weiter unten je Kamerastandort — und nur das zählt.
const ganz = baueBaenderStufe(feld, satz, kacheln, 0);
const teile = {
  Terrain:  tri(t.geometrie),
  Wege:     ganz.wege.reduce((a, g) => a + tri(g), 0),
  Gewässer: [...ganz.wasser, ...ganz.faelle].reduce((a, g) => a + tri(g), 0),
  Gebäude:  tri(baueGebaeude(welt, boden)),
  Gärten:   kacheln.reduce((a, k) => a + tri(baueGartenKachel(feld, satz, k, 0)), 0),
};

const props = verteileProps(welt, t, 1);
const anzahl = zaehleProps(props);
let propTris = 0;
const propZeilen: string[] = [];
for (const [art, n] of Object.entries(anzahl)) {
  // Mittel ueber die Varianten — die sechs Buschmodelle haben 16 bis 104 Dreiecke.
  const zahl = variantenZahl(art as PropArt);
  let summe = 0;
  for (let v = 0; v < zahl; v++) summe += propTrisFuer(art as PropArt, v, 'nah');
  const jeStueck = Math.round(summe / zahl);
  propTris += jeStueck * n;
  propZeilen.push(`    ${art.padEnd(12)} ${String(n).padStart(6)} x ${String(jeStueck).padStart(4)} Tris = ${String(jeStueck * n).padStart(8)}`);
}

console.log('Szene Œntal\n');
for (const [k, v] of Object.entries(teile)) console.log(`  ${k.padEnd(10)} ${v.toLocaleString('de').padStart(9)} Dreiecke`);
console.log(`\n  Props (${props.length.toLocaleString('de')} Instanzen, ${Object.keys(anzahl).length} Draw Calls):`);
propZeilen.forEach(z => console.log(z));

const gesamt = Object.values(teile).reduce((a, b) => a + b, 0) + propTris;
console.log(`\n  Gesamt ohne Culling  ${Math.round(gesamt).toLocaleString('de').padStart(9)} Dreiecke`);

// Was tatsächlich gezeichnet wird: Chunks in Sichtweite, ab ATTRAPPE_AB als Primitiv.
//
// Ohne den Attrappen-Schritt misst dieses Werkzeug etwas, das die Szene nie zeichnet —
// und meldet Millionen Dreiecke, wo im Spiel Hunderttausende stehen. Das war der Kern
// von Ledger G-18: nicht die Zahl war falsch, sondern die gemessene Größe.

const chunks = chunkeProps(props);
let besteSicht = 0;
/** Bandbreiecke, die von diesem Standort aus wirklich gebaut würden. */
function baenderSichtbar(kx: number, kz: number): number {
  let summe = 0;
  for (const k of kacheln) {
    const d = Math.max(0, Math.hypot(k.mitte[0] - kx, k.mitte[1] - kz) - k.radius);
    if (d > TERRAIN_SICHT) continue;
    const lod = lodFuerAbstand(d);
    const haeuser = satz.gebaeude.get(`${k.ix}:${k.iz}`) ?? [];
    summe += tri(baueWegKachel(feld, satz, k, lod))
           + tri(baueWasserKachel(feld, satz, k, lod))
           + tri(baueFallKachel(feld, satz, k, lod))
           + tri(baueGartenKachel(feld, satz, k, lod))
           + (haeuser.length ? tri(baueGebaeude(welt, boden, haeuser.map(i => welt.gebaeude[i]))) : 0);
  }
  return summe;
}

for (const [kx, kz] of [[0, 0], [300, -300], [-350, 350], [450, 100]] as [number, number][]) {
  let tris = 0, calls = 0;
  for (const c of chunks) {
    const d = Math.hypot(c.mitte[0] - kx, c.mitte[1] - kz) - c.radius;
    if (d > c.sichtweite) continue;
    const stufe = d > ATTRAPPE_AB ? 'fern' : d > MITTEL_AB ? 'mittel' : 'nah';
    tris += propTrisFuer(c.art, c.variante, stufe) * c.instanzen.length; calls++;
  }
  // Häuser und Gärten hängen seit D75 mit an den Kacheln — sie stecken in
  // `baenderSichtbar` und dürfen nicht zusätzlich pauschal gezählt werden.
  const baender = baenderSichtbar(kx, kz);
  const sichtbar = teile.Terrain + baender + tris;
  besteSicht = Math.max(besteSicht, sichtbar);
  console.log(`  Kamera (${String(kx).padStart(4)},${String(kz).padStart(5)})  ${Math.round(sichtbar).toLocaleString('de').padStart(9)} Dreiecke · ${String(4 + calls).padStart(4)} Draw Calls`
    + `   davon Aufsätze ${Math.round(baender).toLocaleString('de').padStart(7)}`);
}
console.log(`\n  Chunks gesamt ${chunks.length}`);
console.log(`\n  Die Zahlen oben sind der **Rundum-Fall**: alles in Sichtweite, in alle`);
console.log(`  Richtungen. Gezeichnet wird nur, was im Blickfeld liegt — auf dem Gerät`);
console.log(`  gemessen 200.000 bis 280.000 Dreiecke bei 60 B/s (Ledger G-31).`);
console.log(`  Ein Urteil gibt dieses Werkzeug deshalb nicht mehr ab: Das 400k-Budget war`);
console.log(`  nie gemessen, sondern ein Literal (Ledger G-18). Die Bildrate im Spiel ist`);
console.log(`  die Instanz, nicht diese Datei.`);

/**
 * Vorschau exportieren — **nur auf Verlangen** (`npm run szene -- --dump`).
 *
 * Dieser Block lief bedingungslos und schrieb bei jedem Lauf **235 MB**:
 * 216,9 MB `teile` und 17,6 MB `props`, beides Vertexkoordinaten als
 * JSON-Fließkommatext in voller Genauigkeit (`-1984.116455078125` — achtzehn
 * Stellen für einen Wert, der auf den Millimeter genau wäre, wenn drei davon
 * blieben). `.cache/scene.json` war damit das größte Objekt im ganzen Repo,
 * 26-mal so groß wie die Weltdatei, die es beschreibt.
 *
 * Gelesen hat es **niemand**: Ein `grep` über das gesamte Repo findet genau die
 * Zeile, die es schreibt, und keine, die es öffnet. Es ist eine Vorschau für
 * einen Betrachter, den es hier nicht gibt.
 *
 * Der Ausgang bleibt trotzdem stehen, weil die Fähigkeit gelegentlich gebraucht
 * wird — sie kostet nur ab jetzt nichts mehr, wenn niemand danach fragt.
 * Dasselbe Muster steckt in `lodpreview.ts` (`lodscene.json`) und
 * `terraincheck.ts` (`preview.json`); beide sind kleiner und bleiben vorerst.
 */
const DUMP = process.argv.includes('--dump');
const dump: any = { teile: [], props: [] };
if (DUMP) {
const alle: [string, any][] = [
  ['terrain', t.geometrie], ['gebaeude', baueGebaeude(welt, boden)],
  ...ganz.wege.map((g, i) => [`wege${i}`, g] as [string, any]),
  ...[...ganz.wasser, ...ganz.faelle].map((g, i) => [`wasser${i}`, g] as [string, any]),
];
for (const [name, g] of alle) {
  if (!g) continue;
  const p = g.getAttribute('position');
  const c = g.getAttribute('color');
  const pos: number[] = [], col: number[] = [];
  for (let i = 0; i < p.count; i++) {
    pos.push(p.getX(i), p.getY(i), p.getZ(i));
    if (c) col.push(c.getX(i), c.getY(i), c.getZ(i));
  }
  dump.teile.push({ name, pos, col: col.length ? col : null });
}
for (const p of props) dump.props.push([p.art, ...p.position, p.drehung, p.skalierung]);
dump.farben = PROP_FARBE;
writeFileSync('.cache/scene.json', JSON.stringify(dump));
const mb = statSync('.cache/scene.json').size / 1024 / 1024;
console.log(`\n  .cache/scene.json geschrieben — ${mb.toFixed(0)} MB`);
} else {
  console.log('\n  Keine Vorschau geschrieben. Wer sie braucht: npm run szene -- --dump');
  console.log('  (sie waere rund 235 MB gross und wird von nichts im Repo gelesen)');
}
