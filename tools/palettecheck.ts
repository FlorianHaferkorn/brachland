/**
 * BRACHLAND — Palette als Zahlen: `npm run palette`
 *
 * Liest **jede** Farbe aus `src/world/palette.ts` und gibt je Farbe die
 * lineare Leuchtdichte und die Saettigung aus, dazu die Bandkennzahlen der
 * Welt (p10, Median, p90). Das ist die Zahl, gegen die der Daempfer fuer
 * Fremdmodelle (`kreaturbau.py`) und jede Lichtentscheidung (D110, D114)
 * gehalten werden.
 *
 * Bis D117 lag dieses Werkzeug unter `.cache/` und trug eine **Kopie** der
 * Hausfarben — die seit zwei Wochen nicht mehr stimmte. Jetzt gibt es nur
 * noch die eine Quelle.
 *
 * Optional `--gruppe haus` fuer eine Gruppe, `--band` nur die Kennzahlen.
 */
import * as THREE from 'three';
import { PALETTE } from '../src/world/palette.js';

type Zeile = { name: string; hex: string; leucht: number; satt: number };
const zeilen: Zeile[] = [];
const nur = process.argv.includes('--gruppe') ? process.argv[process.argv.indexOf('--gruppe') + 1] : null;

for (const [gruppe, werte] of Object.entries(PALETTE)) {
  if (nur && gruppe !== nur) continue;
  for (const [name, hex] of Object.entries(werte as Record<string, unknown>)) {
    if (typeof hex !== 'string' || !hex.startsWith('#')) continue;
    const c = new THREE.Color(hex);
    const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
    zeilen.push({
      name: `${gruppe}/${name}`, hex,
      leucht: 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b,
      satt: max === 0 ? 0 : (max - min) / max,
    });
  }
}

zeilen.sort((a, b) => a.leucht - b.leucht);
if (!process.argv.includes('--band')) {
  for (const z of zeilen)
    console.log(`  ${z.name.padEnd(26)} ${z.hex}  Leuchtdichte ${z.leucht.toFixed(3)}  Saettigung ${z.satt.toFixed(2)}`);
  console.log();
}
const q = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const L = zeilen.map(z => z.leucht).sort((a, b) => a - b);
const S = zeilen.map(z => z.satt).sort((a, b) => a - b);
console.log(`${zeilen.length} Farben${nur ? ` in ${nur}` : ''}`);
console.log(`  Leuchtdichte  p10 ${q(L, 0.1).toFixed(3)} · Median ${q(L, 0.5).toFixed(3)} · p90 ${q(L, 0.9).toFixed(3)}`);
console.log(`  Saettigung    p10 ${q(S, 0.1).toFixed(2)} · Median ${q(S, 0.5).toFixed(2)} · p90 ${q(S, 0.9).toFixed(2)}`);
console.log(`  Kreaturband   ${PALETTE.kreaturBand.unten}–${PALETTE.kreaturBand.oben}`);
