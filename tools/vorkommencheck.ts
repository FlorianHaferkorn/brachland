/**
 * Wie viele Kreaturen stehen wo — und findet man beim Spielen ueberhaupt welche?
 *
 * Die Dichte ist der Unterschied zwischen „lebendige Region“ und „leerer Wald“.
 * Geraten wird sie nicht: Dieses Werkzeug zaehlt die Vorkommen je Linie und misst
 * den Weg vom Startpunkt bis zur naechsten Begegnung.
 *
 * `npm run vorkommen`
 */
import { entpackeWelt } from '../src/world/osm.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { baueTerrain } from '../src/world/terrain.js';
import { verteileKreaturen, type KreaturSpawn } from '../src/world/vorkommen.js';

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const t = baueTerrain(welt);

const kreaturen: KreaturSpawn[] = readdirSync('content/creatures')
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join('content/creatures', f), 'utf8')))
  // Nicht nach Herkunft filtern, sondern nach Häufigkeit: `fest` steht an einer
  // Position und wird nicht verteilt, alles andere streift. Vorher stand hier
  // `ursprung === 'wildling'` — dadurch fehlte die erste Zuchtlinie in dieser
  // Zählung, und genau diese Zählung hätte sie finden müssen.
  .filter(k => k.spawn.haeufigkeit !== 'fest');

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

// Die Zahl, die beim Spielen zaehlt: Wie viele stehen ueberhaupt in Sichtweite,
// und wie weit muss man laufen, bis die naechste auftaucht?
const SICHT = 140;
console.log(`\nIn Sichtweite (${SICHT} m) — 400 Stichproben ueber die Region:`);
let summe = 0, leer = 0, maxD = 0, summeD = 0;
const zufall = (() => { let a = 4711; return () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}; })();
for (let n = 0; n < 400; n++) {
  const px = (zufall() - 0.5) * t.breiteMeter * 0.9;
  const pz = (zufall() - 0.5) * t.tiefeMeter * 0.9;
  let inSicht = 0, naechste = Infinity;
  for (const k of v) {
    const d = Math.hypot(k.position[0] - px, k.position[2] - pz);
    if (d <= SICHT) inSicht++;
    if (d < naechste) naechste = d;
  }
  summe += inSicht;
  if (inSicht === 0) leer++;
  summeD += naechste;
  maxD = Math.max(maxD, naechste);
}
console.log(`  im Schnitt      ${(summe / 400).toFixed(1)} Kreaturen sichtbar`);
console.log(`  gar keine       ${(100 * leer / 400).toFixed(0)} % der Standorte`);
console.log(`  naechste im Schnitt ${(summeD / 400).toFixed(0)} m, schlimmster Fall ${maxD.toFixed(0)} m`);

// Stufenverteilung: Die Erfahrungsstufe folgt der Entfernung, die Mutation der Stufe.
const eimer = [0, 0, 0, 0];
let minS = 99, maxS = 0;
for (const k of v) {
  minS = Math.min(minS, k.stufe); maxS = Math.max(maxS, k.stufe);
  eimer[Math.min(3, Math.floor(k.stufe / 10))]++;
}
console.log(`\nErfahrungsstufen ${minS}-${maxS}:`);
console.log(`  1-9   ${String(eimer[0]).padStart(4)}`);
console.log(`  10-19 ${String(eimer[1]).padStart(4)}`);
console.log(`  20-29 ${String(eimer[2]).padStart(4)}`);
console.log(`  30+   ${String(eimer[3]).padStart(4)}`);
