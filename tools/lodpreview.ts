/** Nahansicht mit LOD-Kacheln exportieren — zum Vergleich mit dem alten Raster. */
import { readFileSync, writeFileSync } from 'node:fs';
import { baueHoehenfeld, baueKachelraster, lodFuerAbstand, baueKachelGeometrie } from '../src/world/lod.js';
import { verteileProps } from '../src/world/props.js';
import { baueTerrain, baueWege, baueGewaesser, baueGebaeude } from '../src/world/terrain.js';

const { welt } = JSON.parse(readFileSync('public/world/oental.json', 'utf8'));
const mikro = Number(process.argv[2] ?? 1.1);
const feld = baueHoehenfeld(welt, mikro);
const kacheln = baueKachelraster(feld);

const SP: [number, number] = [120, 40];
const dump: any = { teile: [], props: [], spielerY: feld.hoehe(SP[0], SP[1]) };

let tris = 0;
for (const k of kacheln) {
  const d = Math.max(0, Math.hypot(k.mitte[0] - SP[0], k.mitte[1] - SP[1]) - k.radius);
  if (d > 400) continue;
  const g = baueKachelGeometrie(feld, k, lodFuerAbstand(d));
  const p = g.getAttribute('position'), c = g.getAttribute('color');
  const pos: number[] = [], col: number[] = [];
  for (let i = 0; i < p.count; i++) {
    pos.push(p.getX(i), p.getY(i), p.getZ(i));
    col.push(c.getX(i), c.getY(i), c.getZ(i));
  }
  dump.teile.push({ name: 'terrain', pos, col });
  tris += p.count / 3;
}

// Wege, Wasser, Gebäude aus dem groben Terrain (Höhen weichen minimal ab, reicht für die Vorschau)
const t = baueTerrain(welt);
for (const [name, g] of [['wege', baueWege(welt, t)], ['wasser', baueGewaesser(welt, t)], ['gebaeude', baueGebaeude(welt, t)]] as any[]) {
  if (!g) continue;
  const p = g.getAttribute('position');
  const pos: number[] = [];
  for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
  dump.teile.push({ name, pos, col: null });
}

const props = verteileProps(welt, t as any, 1)
  .filter(p => Math.hypot(p.position[0] - SP[0], p.position[2] - SP[1]) < 260);
for (const p of props) dump.props.push([p.art, p.position[0], feld.hoehe(p.position[0], p.position[2]), p.position[2], p.drehung, p.skalierung]);
dump.farben = { nadelbaum:'#20351f', laubbaum:'#3a4d2c', busch:'#3f4f33', findling:'#6e7276', totholz:'#4a4239', grasbuschel:'#5c6b45' };
dump.spieler = SP;
writeFileSync('.cache/lodscene.json', JSON.stringify(dump));
console.log(`Terrain-Dreiecke im Umkreis 400 m: ${tris.toLocaleString('de')} · Props: ${props.length}`);
console.log(`Mikrorelief-Stärke: ${mikro}`);
