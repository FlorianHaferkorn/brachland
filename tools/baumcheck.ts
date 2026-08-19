/**
 * Was kosten die prozeduralen Bäume — und treffen sie die Art?
 *
 * `npm run baum`
 */
import { baueBaum, BAUM, type BaumArt, type BaumDetail } from '../src/world/baum.js';
import { propGeometrie, type PropArt } from '../src/world/props.js';

const tri = (g: any) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

console.log('Prozedurale Bäume\n');
console.log(`  ${'Art'.padEnd(10)} ${'Detail'.padEnd(7)} ${'Var'.padStart(3)} ${'Dreiecke'.padStart(9)} ${'Hoehe m'.padStart(8)} ${'Bau ms'.padStart(7)}`);
for (const art of Object.keys(BAUM) as BaumArt[]) {
  for (const detail of ['voll', 'mittel'] as BaumDetail[]) {
  for (let v = 0; v < 2; v++) {
    const t0 = process.hrtime.bigint();
    const g = baueBaum(art, v, detail);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    console.log(`  ${art.padEnd(10)} ${detail.padEnd(7)} ${String(v).padStart(3)} ${String(tri(g)).padStart(9)} ` +
                `${(bb.max.y - bb.min.y).toFixed(1).padStart(8)} ${ms.toFixed(1).padStart(7)}`);
  }
  }
}

console.log('\nZum Vergleich, die Rueckfall-Primitive:');
for (const art of ['nadelbaum', 'laubbaum'] as PropArt[]) {
  const g = propGeometrie(art);
  console.log(`  ${art.padEnd(10)} ${String(tri(g)).padStart(13)} Dreiecke`);
}
console.log('\n  Die umgebauten Kenney-GLB liegen laut npm run props bei 16-154 Dreiecken.');
console.log('  EZ-Tree gemessen: +4,0 MB Bundle, Precache 2,4 -> 6,3 MB.');
