/**
 * Wie teuer ist eine Kreatursilhouette — und sieht man ihr die Herkunft an?
 *
 * Anlass ist ein Befund, den niemand gemeldet hat: Der Dateikopf von
 * `kreaturgestalt.ts` versprach „unter 250 Dreiecken". Beim ersten Messen standen
 * dort 436 und 492 — der Pilzfächer (Stilreferenz v1) hatte das Budget längst
 * gesprengt, und die Zusage war einfach stehengeblieben. Eine Zahl im Kommentar
 * altert lautlos; eine Zahl, die ein Werkzeug ausgibt, nicht.
 *
 * Deshalb misst dieses Werkzeug beides:
 * 1. **Dreiecke je Linie und Mutationsstufe** gegen die Obergrenze.
 * 2. **Ob die drei Herkünfte sich unterscheiden** — gleiche Bauform, gleiche
 *    Elemente, nur andere Herkunft: Kommt dieselbe Geometrie heraus, ist die
 *    Regel aus der Creature Design Bible §1 nicht umgesetzt, egal was im Code steht.
 *
 * `npm run gestalt`
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { baueKreaturGeometrie, saatAusId } from '../src/world/kreaturgestalt.js';
import type { Ursprung } from '../src/data/schema.js';

/** Obergrenze je Silhouette. Platzhalter bis ADR-0002 fällt — nicht das Modellbudget. */
const GRENZE = 600;

const dreiecke = (g: { getAttribute: (n: string) => { count: number } }) =>
  g.getAttribute('position').count / 3;

const kreaturen = readdirSync('content/creatures')
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join('content/creatures', f), 'utf8')));

console.log(`Dreiecke je Silhouette (Grenze ${GRENZE})\n`);
console.log(`  ${'Linie'.padEnd(14)} ${'Herkunft'.padEnd(13)} ${'Bauform'.padEnd(16)} je Stufe`);
let hoechst = 0, ueber = 0;
for (const k of kreaturen) {
  const je: number[] = [];
  for (let m = 0; m < k.stufen.length; m++)
    je.push(dreiecke(baueKreaturGeometrie(k.basisRig, k.elemente, m, k.ursprung, saatAusId(k.id))));
  const spitze = Math.max(...je);
  hoechst = Math.max(hoechst, spitze);
  if (spitze > GRENZE) ueber++;
  console.log(`  ${k.id.padEnd(14)} ${k.ursprung.padEnd(13)} ${k.basisRig.padEnd(16)} ${je.join(' / ')}`
    + (spitze > GRENZE ? '   ✗ ueber der Grenze' : ''));
}
console.log(`\n  Hoechstwert ${hoechst}, ${ueber} Linien ueber der Grenze`);

/**
 * Der zweite Teil ist der wichtigere: Eine Herkunftsregel, die man nicht sieht,
 * ist keine. Verglichen wird die **Punktwolke**, nicht die Dreieckszahl — der
 * Wildling hat gleich viele Dreiecke wie die Zuchtlinie, sie stehen nur anders.
 */
console.log('\nUnterscheiden sich die Herkuenfte? (quadruped, Element stein, Stufe 1)\n');
const ARTEN: Ursprung[] = ['wildling', 'zuchtlinie', 'verwachsener'];
const abdruck = (u: Ursprung) => {
  const g = baueKreaturGeometrie('quadruped', ['stein'], 1, u, saatAusId('probe'));
  const p = g.getAttribute('position').array;
  let s = 0;
  for (let i = 0; i < p.length; i++) s += Math.abs(p[i]) * (i % 7 + 1);
  return { tris: p.length / 9, summe: s };
};
const werte = ARTEN.map(u => ({ u, ...abdruck(u) }));
for (const w of werte) console.log(`  ${w.u.padEnd(13)} ${String(w.tris).padStart(4)} Dreiecke  Abdruck ${w.summe.toFixed(2)}`);
let gleich = 0;
for (let i = 0; i < werte.length; i++)
  for (let j = i + 1; j < werte.length; j++)
    if (Math.abs(werte[i].summe - werte[j].summe) < 1e-6) {
      console.log(`  ✗ ${werte[i].u} und ${werte[j].u} bauen identisch`);
      gleich++;
    }
console.log(gleich === 0
  ? '  ✓ alle drei Herkuenfte bauen verschieden'
  : `  ${gleich} Paare sind nicht unterscheidbar`);

// Und die Streuung muss ueber Sitzungen halten, sonst steht dieselbe Kreatur
// jedes Mal anders da. Zweimal bauen, Abdruck vergleichen.
const a = baueKreaturGeometrie('quadruped', ['stein'], 1, 'wildling', saatAusId('grathorn'));
const b = baueKreaturGeometrie('quadruped', ['stein'], 1, 'wildling', saatAusId('grathorn'));
const gleichLang = a.getAttribute('position').array.length === b.getAttribute('position').array.length;
let identisch = gleichLang;
if (gleichLang) {
  const pa = a.getAttribute('position').array, pb = b.getAttribute('position').array;
  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) { identisch = false; break; }
}
console.log(`\n  ${identisch ? '✓' : '✗'} derselbe Seed ergibt dieselbe Gestalt`);
if (ueber > 0 || gleich > 0 || !identisch) process.exit(1);
