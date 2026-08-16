/** Vollständige Szene headless bauen: Dreiecke, Props, Draw Calls, Budget. */
import { readFileSync, writeFileSync } from 'node:fs';
import { baueTerrain, baueGewaesser, baueGebaeude, baueWege } from '../src/world/terrain.js';
import { verteileProps, propGeometrie, zaehleProps, chunkeProps, PROP_FARBE, type PropArt } from '../src/world/props.js';

const { welt } = JSON.parse(readFileSync('public/world/oental.json', 'utf8'));
const t = baueTerrain(welt);
const tri = (g: any) => g ? g.getAttribute('position').count / 3 : 0;

const teile = {
  Terrain:  tri(t.geometrie),
  Wege:     tri(baueWege(welt, t)),
  Gewässer: tri(baueGewaesser(welt, t)),
  Gebäude:  tri(baueGebaeude(welt, t)),
};

const props = verteileProps(welt, t, 1);
const anzahl = zaehleProps(props);
let propTris = 0;
const propZeilen: string[] = [];
for (const [art, n] of Object.entries(anzahl)) {
  const g = propGeometrie(art as PropArt);
  const jeStueck = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
  propTris += jeStueck * n;
  propZeilen.push(`    ${art.padEnd(12)} ${String(n).padStart(6)} x ${String(jeStueck).padStart(3)} Tris = ${String(jeStueck * n).padStart(7)}`);
}

console.log('Szene Œntal\n');
for (const [k, v] of Object.entries(teile)) console.log(`  ${k.padEnd(10)} ${v.toLocaleString('de').padStart(9)} Dreiecke`);
console.log(`\n  Props (${props.length.toLocaleString('de')} Instanzen, ${Object.keys(anzahl).length} Draw Calls):`);
propZeilen.forEach(z => console.log(z));

const gesamt = Object.values(teile).reduce((a, b) => a + b, 0) + propTris;
console.log(`\n  Gesamt ohne Culling  ${Math.round(gesamt).toLocaleString('de').padStart(9)} Dreiecke`);

// Was tatsächlich gezeichnet wird: nur Chunks in Sichtweite der Kamera
const chunks = chunkeProps(props);
let besteSicht = 0;
for (const [kx, kz] of [[0, 0], [300, -300], [-350, 350], [450, 100]] as [number, number][]) {
  let tris = 0, calls = 0;
  for (const c of chunks) {
    const d = Math.hypot(c.mitte[0] - kx, c.mitte[1] - kz) - c.radius;
    if (d > c.sichtweite) continue;
    const g = propGeometrie(c.art);
    const je = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
    tris += je * c.instanzen.length; calls++;
  }
  const sichtbar = Object.values(teile).reduce((a, b) => a + b, 0) + tris;
  besteSicht = Math.max(besteSicht, sichtbar);
  console.log(`  Kamera (${String(kx).padStart(4)},${String(kz).padStart(5)})  ${Math.round(sichtbar).toLocaleString('de').padStart(9)} Dreiecke · ${String(4 + calls).padStart(4)} Draw Calls`);
}
console.log(`\n  Chunks gesamt ${chunks.length}`);
console.log(besteSicht < 400_000 ? '  ✓ im Budget (Handy verträgt ~400k)' : '  ✗ zu viel');

// Vorschau exportieren
const dump: any = { teile: [], props: [] };
const alle: [string, any][] = [
  ['terrain', t.geometrie], ['wege', baueWege(welt, t)],
  ['wasser', baueGewaesser(welt, t)], ['gebaeude', baueGebaeude(welt, t)],
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
console.log('\n  .cache/scene.json geschrieben');
