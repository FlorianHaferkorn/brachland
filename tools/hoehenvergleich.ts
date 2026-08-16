/**
 * Was bringt DGM1 gegenüber EU-DEM — in Metern, nicht in Adjektiven.
 *
 * Gemessen wird das, worauf es beim Gehen ankommt: die **lokale Steigung**. Ein
 * gröberes Modell glättet Geländekanten weg; der Höhenunterschied zwischen zwei
 * benachbarten Rasterpunkten sinkt. Wer ein Tal sucht, findet es in beiden Modellen —
 * wer eine Böschung sucht, nur im feineren.
 *
 * `npm run hoehen`
 */
import { readFileSync } from 'node:fs';
import { holeHoehenDgm1 } from './dgm1.js';
import type { BBox } from '../src/world/osm.js';

const r = JSON.parse(readFileSync('content/regions/oental.json', 'utf8'));
const bbox = r.bbox as BBox;

function kennzahlen(raster: number[][], meterJeZelle: number) {
  const n = raster.length;
  let summe = 0, max = 0, zahl = 0;
  const werte: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const h = raster[i][j];
      if (Number.isNaN(h)) continue;
      werte.push(h);
      for (const [di, dj] of [[0, 1], [1, 0]] as [number, number][]) {
        const k = raster[i + di]?.[j + dj];
        if (k === undefined || Number.isNaN(k)) continue;
        const d = Math.abs(k - h);
        summe += d; max = Math.max(max, d); zahl++;
      }
    }
  }
  werte.sort((a, b) => a - b);
  return {
    min: werte[0], max: werte[werte.length - 1],
    stufeMittel: summe / zahl, stufeMax: max,
    neigungMittel: Math.atan((summe / zahl) / meterJeZelle) * 180 / Math.PI,
  };
}

const BREITE_M = 3968;

console.log('Höhenmodelle im Vergleich — Œntal\n');
for (const aufl of [96, 192, 256]) {
  const e = await holeHoehenDgm1(bbox, aufl, () => {});
  const k = kennzahlen(e.raster, BREITE_M / (aufl - 1));
  console.log(`  DGM1 ${String(aufl).padStart(3)}x${aufl}  ` +
    `${(BREITE_M / (aufl - 1)).toFixed(1).padStart(5)} m je Zelle  ` +
    `Hoehe ${k.min.toFixed(0)}-${k.max.toFixed(0)} m  ` +
    `Stufe im Mittel ${k.stufeMittel.toFixed(2).padStart(5)} m, max ${k.stufeMax.toFixed(1).padStart(5)} m  ` +
    `mittlere Neigung ${k.neigungMittel.toFixed(1)}°`);
}

// Das alte Modell zum Vergleich, falls es noch im Zwischenspeicher liegt.
try {
  const alt = JSON.parse(readFileSync('.cache/dem-oental-96.json', 'utf8')) as number[][];
  const k = kennzahlen(alt, BREITE_M / 95);
  console.log(`\n  EU-DEM  96x96  ${(BREITE_M / 95).toFixed(1)} m je Zelle  ` +
    `Hoehe ${k.min.toFixed(0)}-${k.max.toFixed(0)} m  ` +
    `Stufe im Mittel ${k.stufeMittel.toFixed(2)} m, max ${k.stufeMax.toFixed(1)} m  ` +
    `mittlere Neigung ${k.neigungMittel.toFixed(1)}°`);
} catch {
  console.log('\n  (EU-DEM-Zwischenspeicher nicht vorhanden — kein direkter Vergleich)');
}
