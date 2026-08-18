/**
 * Stehen Wasser, Wege und Häuser auf dem Boden, den man SIEHT?
 *
 * Zwei Fehlversuche stecken in diesem Werkzeug, und beide sind lehrreich:
 *
 *   1. Der erste Lauf verglich gegen `terrain.hoeheAn` — einen Pfad, den die Szene
 *      gar nicht benutzt. Gemessen wurde eine Rechnung, kein Bild (G-73).
 *   2. Der zweite verglich die *Formel*, mit der ein Band gelegt wird, gegen die
 *      Fläche. Das war richtig, aber es prüfte nicht, was am Ende im Puffer steht.
 *
 * Diese Fassung baut die Geometrie, die das Spiel baut, und misst **jeden Vertex**
 * gegen die Fläche, die unter ihm gezeichnet wird. Dazu werden vier Kamerastandorte
 * durchgespielt, weil die LOD-Stufe einer Kachel an der Entfernung hängt und es
 * ohne Standort keine Stufe gibt.
 *
 * `npm run aufsatz`
 */
import { readFileSync } from 'node:fs';
import type * as THREE from 'three';
import { entpackeWelt } from '../src/world/osm.js';
import { baueHoehenfeld, baueKachelraster, lodFuerAbstand, hoeheAufFlaeche,
         spiegelAufFlaeche, aufsatzboden, LOD_STUFEN } from '../src/world/lod.js';
import { zerlegeBaender, baueWegKachel, baueWasserKachel } from '../src/world/baender.js';
import { TERRAIN_SICHT } from '../src/scenes/sichtweiten.js';

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const feld = baueHoehenfeld(welt);
const kacheln = baueKachelraster(feld);
const satz = zerlegeBaender(welt, feld);
const boden = aufsatzboden(feld);

const STANDORTE: [number, number][] = [[0, 0], [300, -300], [-350, 350], [450, 100]];

/** Kennzahlen einer Liste, in Metern. */
function auswerten(name: string, werte: number[], grenze: number): void {
  if (!werte.length) { console.log(`  ${name.padEnd(20)} keine Proben`); return; }
  const s = [...werte].sort((a, b) => a - b);
  const p = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  const mittel = s.reduce((a, b) => a + b, 0) / s.length;
  console.log(`  ${name.padEnd(20)} ${String(s.length).padStart(7)} Vertices`
    + ` · Mittel ${mittel.toFixed(3).padStart(6)} m`
    + ` · 95. ${p(0.95).toFixed(3).padStart(6)} m`
    + ` · max ${s[s.length - 1].toFixed(2).padStart(6)} m`
    + ` · über ${grenze} m: ${(100 * s.filter(x => x > grenze).length / s.length).toFixed(2).padStart(5)} %`);
}

/**
 * Wie weit steht ein Vertex über der Fläche, die dort gezeichnet wird?
 *
 * Der beabsichtigte Aufschlag (6 bzw. 12 cm) wird abgezogen — er ist gewollt und
 * hält das Band davor, im Boden zu blitzen. Schürzenvertices liegen unter der
 * Fläche und ergeben negative Werte; gezählt wird nur, was **darüber** steht,
 * denn nur das hängt sichtbar in der Luft.
 */
function luftUeberFlaeche(
  g: THREE.BufferGeometry | null, s: number, ueber: number,
  flaeche: (f: typeof feld, x: number, z: number, s: number) => number, raus: number[],
): void {
  if (!g) return;
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const d = p.getY(i) - ueber - flaeche(feld, p.getX(i), p.getZ(i), s);
    if (d > 0) raus.push(d);
  }
}

console.log('Stehen die gebauten Bänder auf der gezeichneten Fläche?\n');
console.log('  Gemessen wird die fertige Geometrie, Vertex für Vertex, an vier');
console.log('  Kamerastandorten — die LOD-Stufe einer Kachel hängt an der Entfernung.\n');

for (const [kx, kz] of STANDORTE) {
  const wege: number[] = [], wasser: number[] = [];
  let kachelzahl = 0;
  for (const k of kacheln) {
    const d = Math.max(0, Math.hypot(k.mitte[0] - kx, k.mitte[1] - kz) - k.radius);
    if (d > TERRAIN_SICHT) continue;
    kachelzahl++;
    const lod = lodFuerAbstand(d);
    const s = LOD_STUFEN[lod].schritt;
    luftUeberFlaeche(baueWegKachel(feld, satz, k, lod), s, 0.12, hoeheAufFlaeche, wege);
    luftUeberFlaeche(baueWasserKachel(feld, satz, k, lod), s, 0.06, spiegelAufFlaeche, wasser);
  }
  console.log(`Standort (${String(kx).padStart(4)}, ${String(kz).padStart(5)}) · ${kachelzahl} Kacheln in Sicht`);
  auswerten('Wegband über Grund', wege, 0.5);
  auswerten('Gewässer über Grund', wasser, 0.5);
}

// ---- Häuser ---------------------------------------------------------------
//
// Häuser sind Körper, keine Auflagen — sie werden nicht je Kachel gebaut. Zwei
// Fragen bleiben trotzdem: Steht die Wand auf dem Boden, und passt das Dach zum
// Haus darunter?
console.log('\nGebäude');
const [sued, west, nord, ost] = welt.bbox;
const nachWelt = ([lat, lon]: number[]): [number, number] => [
  (((lon - west) / (ost - west)) - 0.5) * feld.breiteMeter,
  (((nord - lat) / (nord - sued)) - 0.5) * feld.tiefeMeter,
];
const HALB_B = feld.breiteMeter / 2, HALB_T = feld.tiefeMeter / 2;
const luecke: number[] = [], achsparallelF: number[] = [], orientiertF: number[] = [];
for (const g of welt.gebaeude) {
  const p = g.punkte.map(nachWelt);
  if (p.length < 3 || !p.every(([x, z]) => Math.abs(x) < HALB_B - 5 && Math.abs(z) < HALB_T - 5)) continue;

  let sockel = Infinity, unterkante = Infinity, tiefste = Infinity;
  for (let k = 0; k < p.length - 1; k++) {
    const [ax, az] = p[k], [bx, bz] = p[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
      sockel = Math.min(sockel, boden.hoeheAn(x, z));
      unterkante = Math.min(unterkante, boden.tiefsteFlaeche(x, z));
      tiefste = Math.min(tiefste, hoeheAufFlaeche(feld, x, z));
    }
  }
  const fuss = sockel - Math.min(2.5, Math.max(0, sockel - unterkante));
  luecke.push(fuss - tiefste);

  const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
  const achsparallel = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
  let achse = 0, laengste = 0;
  for (let k = 0; k < p.length - 1; k++) {
    const dx = p[k + 1][0] - p[k][0], dz = p[k + 1][1] - p[k][1];
    const l = Math.hypot(dx, dz);
    if (l > laengste) { laengste = l; achse = Math.atan2(dz, dx); }
  }
  const c = Math.cos(achse), si = Math.sin(achse);
  const us = p.map(([x, z]) => x * c + z * si), vs = p.map(([x, z]) => -x * si + z * c);
  const orientiert = (Math.max(...us) - Math.min(...us)) * (Math.max(...vs) - Math.min(...vs));
  let a = 0;
  for (let k = 0; k < p.length - 1; k++) a += p[k][0] * p[k + 1][1] - p[k + 1][0] * p[k][1];
  a = Math.abs(a) / 2;
  if (a > 1) { achsparallelF.push(achsparallel / a); orientiertF.push(orientiert / a); }
}
const schwebend = luecke.filter(x => x > 0.05).length;
console.log(`  ${'Wandunterkante'.padEnd(20)} ${schwebend} von ${luecke.length} Häusern`
  + ' haben mehr als 5 cm Luft unter mindestens einer Wand');
const kennzahl = (name: string, werte: number[]) => {
  const s = [...werte].sort((x, y) => x - y);
  console.log(`  ${name.padEnd(20)} Median ${s[Math.floor(s.length / 2)].toFixed(2)}x`
    + ` · 95. ${s[Math.floor(s.length * 0.95)].toFixed(2)}x`
    + ` · max ${s[s.length - 1].toFixed(1)}x`);
};
console.log('  Dachhülle gegen Grundrissfläche:');
kennzahl('achsparallel (alt)', achsparallelF);
kennzahl('orientiert (jetzt)', orientiertF);
