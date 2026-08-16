/** LOD-Budget prüfen: wie viele Dreiecke sieht die Kamera an typischen Standorten? */
import { readFileSync } from 'node:fs';
import { baueHoehenfeld, baueKachelraster, lodFuerAbstand, dreieckeJeKachel,
         baueKachelGeometrie, LOD_STUFEN, KACHEL } from '../src/world/lod.js';

const { welt } = JSON.parse(readFileSync('public/world/oental.json', 'utf8'));
const feld = baueHoehenfeld(welt);
const kacheln = baueKachelraster(feld);

console.log(`Kachelraster ${KACHEL} m · ${kacheln.length} Kacheln · Welt ${feld.breiteMeter.toFixed(0)} x ${feld.tiefeMeter.toFixed(0)} m\n`);
console.log('LOD-Stufen:');
LOD_STUFEN.forEach((s, i) =>
  console.log(`  LOD${i}  bis ${String(s.bisMeter === Infinity ? '∞' : s.bisMeter).padStart(4)} m · ${String(s.schritt).padStart(2)} m Vertexabstand · ${String(dreieckeJeKachel(i)).padStart(5)} Dreiecke/Kachel`));

console.log('\nSichtbare Dreiecke je Standort (Nebel 380 m):');
for (const [kx, kz] of [[0,0],[300,-300],[-350,350],[450,100]] as [number,number][]) {
  let tris = 0, calls = 0;
  const proLod = [0,0,0,0,0];
  for (const k of kacheln) {
    const d = Math.max(0, Math.hypot(k.mitte[0]-kx, k.mitte[1]-kz) - k.radius);
    if (d > 380) continue;
    const lod = lodFuerAbstand(d);
    tris += dreieckeJeKachel(lod); calls++; proLod[lod]++;
  }
  console.log(`  (${String(kx).padStart(4)},${String(kz).padStart(5)})  ${tris.toLocaleString('de').padStart(8)} Dreiecke · ${String(calls).padStart(3)} Kacheln  [${proLod.map((n,i)=>`L${i}:${n}`).join(' ')}]`);
}

// Vorher-Nachher am Detailgrad direkt unter dem Spieler
console.log('\nDetail direkt vor dem Spieler (6 m Umkreis):');
console.log(`  altes Raster 96x96:  ${(feld.breiteMeter/95).toFixed(1)} m je Vertex  → 0–1 Dreiecke sichtbar`);
console.log(`  LOD0:                ${LOD_STUFEN[0].schritt} m je Vertex  → ~${Math.round((12/LOD_STUFEN[0].schritt)**2*2)} Dreiecke sichtbar`);

// Mikrorelief-Wirkung messen
const proben = 400;
let ohne = 0, mit = 0;
for (let i = 0; i < proben; i++) {
  const x = (Math.random()-0.5)*feld.breiteMeter*0.8, z = (Math.random()-0.5)*feld.tiefeMeter*0.8;
  const a = feld.hoehe(x, z), b = feld.hoehe(x+2, z), c = feld.hoehe(x, z+2);
  mit += Math.abs(a-b) + Math.abs(a-c);
}
const feldOhne = baueHoehenfeld(welt, 0);
for (let i = 0; i < proben; i++) {
  const x = (Math.random()-0.5)*feld.breiteMeter*0.8, z = (Math.random()-0.5)*feld.tiefeMeter*0.8;
  const a = feldOhne.hoehe(x, z), b = feldOhne.hoehe(x+2, z), c = feldOhne.hoehe(x, z+2);
  ohne += Math.abs(a-b) + Math.abs(a-c);
}
console.log(`\nHöhenunterschied auf 2 m Distanz:`);
console.log(`  ohne Mikrorelief  ${(ohne/proben/2*100).toFixed(1)} cm`);
console.log(`  mit  Mikrorelief  ${(mit/proben/2*100).toFixed(1)} cm`);

const g = baueKachelGeometrie(feld, kacheln[Math.floor(kacheln.length/2)], 0);
console.log(`\nBeispielkachel LOD0: ${g.getAttribute('position').count/3} Dreiecke, ${(JSON.stringify(Array.from(g.getAttribute('position').array)).length/1024).toFixed(0)} KB roh`);
