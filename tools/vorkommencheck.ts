/**
 * Wie viele Kreaturen stehen wo — und findet man beim Spielen ueberhaupt welche?
 *
 * Die Dichte ist der Unterschied zwischen „lebendige Region“ und „leerer Wald“.
 * Geraten wird sie nicht: Dieses Werkzeug zaehlt die Vorkommen je Linie und misst
 * den Weg vom Startpunkt bis zur naechsten Begegnung.
 *
 * `npm run vorkommen`
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { baueTerrain } from '../src/world/terrain.js';
import { verteileKreaturen, type KreaturSpawn } from '../src/world/vorkommen.js';

const { welt } = JSON.parse(readFileSync('public/world/oental.json', 'utf8'));
const t = baueTerrain(welt);

const kreaturen: KreaturSpawn[] = readdirSync('content/creatures')
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join('content/creatures', f), 'utf8')))
  .filter(k => k.ursprung === 'wildling');

const v = verteileKreaturen(welt, kreaturen, t.rasterZuWelt, t.hoeheAn,
                            t.breiteMeter, t.tiefeMeter);

const jeArt = new Map<string, number>();
for (const x of v) jeArt.set(x.kreatur, (jeArt.get(x.kreatur) ?? 0) + 1);

const flaecheKm2 = (t.breiteMeter * t.tiefeMeter) / 1e6;
console.log(`Region ${t.breiteMeter.toFixed(0)} x ${t.tiefeMeter.toFixed(0)} m = ${flaecheKm2.toFixed(1)} km²\n`);
console.log(`  ${'Linie'.padEnd(14)} ${'Anzahl'.padStart(6)}  je km²`);
for (const k of kreaturen) {
  const n = jeArt.get(k.id) ?? 0;
  const kennzeichen = n === 0 ? '  ✗ kommt nicht vor' : '';
  console.log(`  ${k.id.padEnd(14)} ${String(n).padStart(6)}  ${(n / flaecheKm2).toFixed(1).padStart(6)}${kennzeichen}`);
}
console.log(`  ${'GESAMT'.padEnd(14)} ${String(v.length).padStart(6)}  ${(v.length / flaecheKm2).toFixed(1).padStart(6)}`);

// Weg bis zur ersten Begegnung — die Zahl, die beim Spielen zaehlt
console.log('\nNaechste Kreatur ab Standort:');
for (const [x, z] of [[0, 0], [300, -300], [-350, 350], [450, 100]] as [number, number][]) {
  let besteD = Infinity, bester = v[0];
  for (const k of v) {
    const d = Math.hypot(k.position[0] - x, k.position[2] - z);
    if (d < besteD) { besteD = d; bester = k; }
  }
  console.log(`  (${String(x).padStart(4)},${String(z).padStart(5)})  ${besteD.toFixed(0).padStart(4)} m entfernt: ${bester.kreatur} S${bester.stufe + 1} bei ${bester.position[0].toFixed(1)} / ${bester.position[2].toFixed(1)}`);
}

const stufen = [0, 0, 0];
for (const k of v) stufen[k.stufe]++;
console.log(`\nStufen: S1 ${stufen[0]} · S2 ${stufen[1]} · S3 ${stufen[2]}`);
